import { v } from 'convex/values'
import { zodToConvexFields } from 'convex-helpers/server/zod4'
import {
  authoredDeleteActiveInputSchema,
  type AuthoredDeleteActiveInput
} from '@artificer-toolkit/schema/api/authoredPublication'
import type { MutationCtx } from '../_generated/server'
import type { Doc } from '../_generated/dataModel'
import { internalMutation, mutation } from '../lib/mutations'
import {
  ACCOUNT_DELETION_BATCH,
  accountDeletionStepArgs,
  continueAccountDeletion,
  readAccountDeletionStep
} from '../accountDeletionJobs'
import { requireIdentity } from '../lib/identity'
import {
  canReadAuthoredRoot,
  deleteAuthoredVersion,
  deleteDraftPayload,
  readAuthoredVersion,
  readDraft,
  readPublishedDocument
} from './documents'
import { dropImageSlot } from './imageSlots'
import {
  authoredCatalogueMetadataSchema,
  authoredDeletedReferenceSchema
} from '@artificer-toolkit/schema/api/authoredCatalogue'
import { removeCatalogueMetadata } from './catalogueMetadata'
import {
  prepareAuthoredDeletionRetention,
  reconcileAuthoredDeletionDependencies
} from './authoredDeletionCleanup'
import { syncAccountUsage } from '../lib/accountUsage'
import { isImportRowVisible } from '../imports/visibility'
import { readVisibleAuthoredRouteId } from './routeIds'

export const deleteActive = mutation({
  args: zodToConvexFields(authoredDeleteActiveInputSchema.shape),
  returns: v.null(),
  handler: async (ctx, args) => {
    const { userId } = await requireIdentity(ctx)
    return deleteOwnedActiveAuthoredContent(
      ctx,
      authoredDeleteActiveInputSchema.parse(args),
      userId
    )
  }
})

async function deleteOwnedActiveAuthoredContent(
  ctx: MutationCtx,
  input: AuthoredDeleteActiveInput,
  userId: string
) {
  const root = await ctx.db
    .query('authoredRoots')
    .withIndex('by_publicId', (q) => q.eq('id', input.subjectId))
    .unique()
  if (
    !root ||
    root.subjectKind !== input.subjectKind ||
    root.ownerUserId !== userId ||
    !(await canReadAuthoredRoot(ctx, root, userId))
  ) {
    throw new Error('Authored content cannot be deleted by the current user.')
  }
  const [version, draft, route] = await Promise.all([
    readAuthoredVersion(ctx, root),
    ctx.db
      .query('authoredDrafts')
      .withIndex('by_subjectId', (q) => q.eq('subjectId', root.id))
      .unique(),
    readVisibleAuthoredRouteId(ctx, { subjectId: root.id })
  ])
  await readPublishedDocument(ctx, root, version)
  if (!route || route.subjectKind !== input.subjectKind)
    throw new Error('Stored authored route mismatch.')
  if (
    draft &&
    (draft.userId !== userId ||
      draft.subjectKind !== root.subjectKind ||
      draft.systemId !== root.systemId ||
      draft.publicId !== route.publicId)
  )
    throw new Error('Stored draft identity mismatch.')
  const retainedStateByCharacterId = await prepareAuthoredDeletionRetention({
    ctx,
    ownerUserId: userId,
    systemId: root.systemId,
    subjectKind: root.subjectKind,
    subjectId: root.id
  })
  await retainDeletedAuthoredReferences(ctx, root)
  await removeCatalogueMetadata(ctx, root)
  await ctx.db.delete(root._id)
  await deleteAuthoredVersion(ctx, version)
  await reconcileAuthoredDeletionDependencies({
    ctx,
    ownerUserId: userId,
    systemId: root.systemId,
    subjectKind: root.subjectKind,
    subjectId: root.id,
    retainedStateByCharacterId
  })
  await dropImageSlot(ctx, root.id, 'ACTIVE')
  if (draft) {
    // Deleting active content does not discard the author's working draft.
    await ctx.db.patch(draft._id, {
      draftState: 'DRAFT_ONLY',
      baseActiveUpdatedAt: null,
      basePublishedChecksum: null,
      updatedAt: new Date(
        Math.max(Date.now(), (draft.updatedAt ? Date.parse(draft.updatedAt) : 0) + 1)
      ).toISOString()
    })
  } else {
    await ctx.db.delete(route._id)
  }
  await syncAccountUsage(ctx, 'homebrewRoots', root.id)
  return null
}

/** Keep dependent documents/compiled mechanics; republishing still requires a live chosen source. */
async function retainDeletedAuthoredReferences(ctx: MutationCtx, root: Doc<'authoredRoots'>) {
  if (
    root.subjectKind !== 'CLASS' &&
    root.subjectKind !== 'RACE' &&
    root.subjectKind !== 'EQUIPMENT'
  )
    return
  const reference = authoredDeletedReferenceSchema.parse({
    subjectKind: root.subjectKind,
    subjectId: root.id,
    label: root.label
  })
  const parentField =
    root.subjectKind === 'CLASS'
      ? 'parentClassId'
      : root.subjectKind === 'RACE'
        ? 'parentRaceId'
        : 'parentEquipmentId'
  const index =
    root.subjectKind === 'CLASS'
      ? 'by_system_kind_parentClassId'
      : root.subjectKind === 'RACE'
        ? 'by_system_kind_parentRaceId'
        : 'by_system_kind_parentEquipmentId'
  const candidates = (
    await Promise.all(
      [root.id, undefined].map((parentId) =>
        ctx.db
          .query('authoredRoots')
          .withIndex(index, (q) =>
            q
              .eq('systemId', root.systemId)
              .eq('subjectKind', root.subjectKind)
              .eq(parentField, parentId)
          )
          .collect()
      )
    )
  ).flat()
  const visibleCandidates = await Promise.all(
    candidates.map(async (dependent) =>
      (await isImportRowVisible(ctx, dependent.importJobId)) ? dependent : null
    )
  )
  const dependents = new Map(
    visibleCandidates
      .filter((dependent): dependent is Doc<'authoredRoots'> => dependent !== null)
      .map((dependent) => [dependent.id, dependent])
  )
  if (root.subjectKind === 'CLASS') {
    const [links, unindexed] = await Promise.all([
      ctx.db
        .query('authoredSpellClasses')
        .withIndex('by_classId', (q) => q.eq('classId', root.id))
        .collect(),
      ctx.db
        .query('authoredRoots')
        .withIndex('by_system_kind_spellClassesIndexed', (q) =>
          q
            .eq('systemId', root.systemId)
            .eq('subjectKind', 'SPELL')
            .eq('spellClassesIndexed', undefined)
        )
        .collect()
    ])
    for (const link of links) {
      if (!(await isImportRowVisible(ctx, link.importJobId))) continue
      const spell = await ctx.db
        .query('authoredRoots')
        .withIndex('by_publicId', (q) => q.eq('id', link.spellId))
        .unique()
      if (!spell || !(await isImportRowVisible(ctx, spell.importJobId))) continue
      if (spell.subjectKind !== 'SPELL' || spell.systemId !== root.systemId)
        throw new Error('Stored Spell Class dependency mismatch.')
      dependents.set(spell.id, spell)
    }
    for (const spell of unindexed)
      if (await isImportRowVisible(ctx, spell.importJobId)) dependents.set(spell.id, spell)
  }
  for (const dependent of [...dependents.values()].sort((a, b) => a.id.localeCompare(b.id))) {
    const document = await readPublishedDocument(
      ctx,
      dependent,
      await readAuthoredVersion(ctx, dependent)
    )
    const referencesSource =
      dependent.subjectKind === 'SPELL'
        ? Array.isArray(document.classIds) && document.classIds.includes(root.id)
        : document[parentField] === root.id
    if (!referencesSource) continue
    const metadata = authoredCatalogueMetadataSchema.parse(dependent.catalogue)
    if (
      metadata.checksum !== dependent.checksum ||
      metadata.nameKey !== dependent.label.toLowerCase() ||
      (dependent.subjectKind === 'SPELL'
        ? JSON.stringify(metadata.spell?.classIds) !== JSON.stringify(document.classIds)
        : metadata.category !== document.category)
    )
      throw new Error('Stored dependent catalogue metadata mismatch.')
    const deletedReferences = [
      ...(metadata.deletedReferences ?? []).filter(
        (entry) =>
          entry.subjectKind !== reference.subjectKind || entry.subjectId !== reference.subjectId
      ),
      reference
    ].sort((a, b) => (a.subjectKind + a.subjectId).localeCompare(b.subjectKind + b.subjectId))
    await ctx.db.patch(dependent._id, {
      catalogue: authoredCatalogueMetadataSchema.parse({ ...metadata, deletedReferences }),
      ...(dependent.subjectKind === 'SPELL' ? {} : { [parentField]: root.id }),
      ...(dependent.subjectKind === 'CLASS' || dependent.subjectKind === 'RACE'
        ? { catalogueFamily: { id: root.id, nameKey: root.label.toLowerCase() } }
        : {})
    })
  }
}
/** The owner's next root that no other owned root depends on, so source loss can delete it. */
async function nextDeletableAuthoredRoot(ctx: MutationCtx, userId: string) {
  const roots = await ctx.db
    .query('authoredRoots')
    .withIndex('by_ownerUserId', (q) => q.eq('ownerUserId', userId))
    .collect()
  const pending = new Set(roots.map((root) => root.id))
  for (const root of roots.sort((left, right) => left.id.localeCompare(right.id))) {
    if (
      roots.some(
        (child) =>
          child.systemId === root.systemId &&
          child.subjectKind === root.subjectKind &&
          (child.parentClassId === root.id ||
            child.parentEquipmentId === root.id ||
            child.parentRaceId === root.id)
      )
    )
      continue
    if (root.subjectKind === 'CLASS') {
      const references = await ctx.db
        .query('authoredSpellClasses')
        .withIndex('by_classId', (q) => q.eq('classId', root.id))
        .collect()
      if (references.some((reference) => pending.has(reference.spellId))) continue
    }
    return root
  }
  if (roots.length) throw new Error('Owned authored dependency cycle prevents account deletion.')
  return null
}

/**
 * The AUTHORED step (ADR 0040): one root through the existing source-loss transaction, leaves
 * first, then one draft-only subject per invocation, then import references in batches.
 */
export const accountDeletionStep = internalMutation({
  args: accountDeletionStepArgs,
  returns: v.null(),
  handler: async (ctx, args) => {
    const job = await readAccountDeletionStep(ctx, args, 'AUTHORED')
    if (!job) return null
    const userId = job.userId
    const root = await nextDeletableAuthoredRoot(ctx, userId)
    if (root) {
      await deleteOwnedActiveAuthoredContent(
        ctx,
        { subjectKind: root.subjectKind, subjectId: root.id },
        userId
      )
      await continueAccountDeletion(ctx, job, true)
      return null
    }
    const draft = await ctx.db
      .query('authoredDrafts')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .first()
    if (draft) {
      await readDraft(ctx, draft)
      const [active, route] = await Promise.all([
        ctx.db
          .query('authoredRoots')
          .withIndex('by_publicId', (q) => q.eq('id', draft.subjectId))
          .unique(),
        ctx.db
          .query('authoredRouteIds')
          .withIndex('by_subjectId', (q) => q.eq('subjectId', draft.subjectId))
          .unique()
      ])
      if (
        active ||
        !route ||
        route.subjectKind !== draft.subjectKind ||
        route.publicId !== draft.publicId
      )
        throw new Error('Stored authored draft route mismatch.')
      await deleteDraftPayload(ctx, draft)
      await ctx.db.delete(draft._id)
      await dropImageSlot(ctx, draft.subjectId, 'DRAFT')
      await ctx.db.delete(route._id)
      await syncAccountUsage(ctx, 'homebrewRoots', draft.subjectId)
      await continueAccountDeletion(ctx, job, true)
      return null
    }
    const imports = await ctx.db
      .query('authoredImportRefs')
      .withIndex('by_userId_subjectKind_subjectId_createdAt', (q) => q.eq('userId', userId))
      .take(ACCOUNT_DELETION_BATCH)
    for (const reference of imports) await ctx.db.delete(reference._id)
    await continueAccountDeletion(ctx, job, imports.length === ACCOUNT_DELETION_BATCH)
    return null
  }
})
