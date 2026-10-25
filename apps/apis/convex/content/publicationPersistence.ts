import type { AuthoredNodeRuntimeSourceFacts } from '@artificer-toolkit/schema/api/nodeRuntimeSources'
import {
  authoredPublicationNameErrorSchema,
  authoredPublishDraftInputSchema,
  authoredPublicationResultSchema,
  type AuthoredPublicationResult,
  type AuthoredPublishDraftInput,
  type AuthoredStoredCompilation
} from '@artificer-toolkit/schema/api/authoredPublication'
import { ConvexError } from 'convex/values'
import {
  authoredSourceFacts,
  normalizeNodeRuntimeValues
} from '@artificer-toolkit/authoring/nodeRuntime'
import { canonicalizeRuleDocument, checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import type { MutationCtx, QueryCtx } from '../_generated/server'
import { requireIdentity } from '../lib/identity'
import { createSystemSourceReader } from '../authoring/systemSources'
import {
  canReadAuthoredRoot,
  deleteDraftPayload,
  readAuthoredVersion,
  readDraft,
  readPublishedDocument
} from './documents'
import { parsePublicationDocument } from './publicationDocument'
import {
  assertClassRelationshipsIndexed,
  assertNoClassChildren,
  requireClassParent
} from './classRelationships'
import { assertNoRaceChildren, requireRaceParent } from './raceRelationships'
import { ensureAuthoredRouteId } from './routeIds'
import { replaceCurrentAuthoredVersion } from './authoredReplacement'
import { promoteDraftImageSlot } from './imageSlots'
import { equipmentOptionFacts } from '@artificer-toolkit/rules-runtime/character/equipmentOptionFacts'
import { requireAuthoredSizes } from '@artificer-toolkit/rules-runtime/systemSizes'
import { requireAuthoredAbilities } from '@artificer-toolkit/rules-runtime/systemAbilities'
import type { ResolvedEquipment } from '@artificer-toolkit/shared/subjects/compilers'
import { requireDefaultUserContentSource } from './sources'
import { isImportRowVisible } from '../imports/visibility'
import type { AuthoredPublicationDocument } from '@artificer-toolkit/schema/api/authoredPublication'

export function activePublicationNameKey(label: string) {
  return label.trim().toLowerCase()
}

export async function assertActivePublicationNameAvailable(
  ctx: QueryCtx,
  subject: AuthoredPublicationDocument,
  userId: string,
  subjectId: string,
  currentImportJobId?: string
) {
  const parentClassId =
    subject.subjectKind === 'CLASS'
      ? subject.document.category === 'SUBCLASS'
        ? subject.document.parentClassId
        : null
      : undefined
  const missing = []
  for await (const entry of ctx.db
    .query('authoredRoots')
    .withIndex('by_system_kind_owner_activeName_parent_id', (q) =>
      q
        .eq('systemId', subject.document.systemId)
        .eq('subjectKind', subject.subjectKind)
        .eq('ownerUserId', userId)
        .eq('activeNameKey', undefined)
    )) {
    if (await isImportRowVisible(ctx, entry.importJobId, currentImportJobId)) missing.push(entry)
    if (missing.length === 2) break
  }
  if (missing.some((entry) => entry.id !== subjectId))
    throw new ConvexError(
      authoredPublicationNameErrorSchema.parse({
        code: 'ACTIVE_NAME_INDEX_INCOMPLETE'
      })
    )
  const conflicts = []
  for await (const entry of ctx.db
    .query('authoredRoots')
    .withIndex('by_system_kind_owner_activeName_parent_id', (q) =>
      q
        .eq('systemId', subject.document.systemId)
        .eq('subjectKind', subject.subjectKind)
        .eq('ownerUserId', userId)
        .eq('activeNameKey', activePublicationNameKey(subject.document.label))
        .eq('parentClassId', parentClassId)
    )) {
    if (await isImportRowVisible(ctx, entry.importJobId, currentImportJobId)) conflicts.push(entry)
    if (conflicts.length === 2) break
  }
  if (conflicts.some((entry) => entry.id !== subjectId))
    throw new ConvexError(
      authoredPublicationNameErrorSchema.parse({
        code: 'ACTIVE_NAME_CONFLICT',
        scope:
          subject.subjectKind === 'CLASS' && subject.document.category === 'SUBCLASS'
            ? 'PARENT_CLASS'
            : 'DOMAIN'
      })
    )
}

async function assertActivePublicationName(
  ctx: MutationCtx,
  state: Awaited<ReturnType<typeof readPublicationState>>,
  subject: Awaited<ReturnType<typeof normalizePublicationDocument>>
) {
  const { input, userId } = state
  await assertActivePublicationNameAvailable(ctx, subject, userId, input.subjectId)
}

export async function readPublicationState(ctx: QueryCtx, args: AuthoredPublishDraftInput) {
  const { userId } = await requireIdentity(ctx)
  const input = authoredPublishDraftInputSchema.parse(args)
  const [draft, root] = await Promise.all([
    ctx.db
      .query('authoredDrafts')
      .withIndex('by_subjectId', (q) => q.eq('subjectId', input.subjectId))
      .unique(),
    ctx.db
      .query('authoredRoots')
      .withIndex('by_publicId', (q) => q.eq('id', input.subjectId))
      .unique()
  ])
  if (
    !draft ||
    draft.userId !== userId ||
    draft.subjectKind !== input.subjectKind ||
    (root &&
      (root.subjectKind !== input.subjectKind ||
        root.systemId !== draft.systemId ||
        root.ownerUserId !== userId ||
        !(await canReadAuthoredRoot(ctx, root, userId))))
  )
    throw new Error('Authored content cannot be published by the current user.')
  if (
    draft.updatedAt !== input.expectedDraftUpdatedAt ||
    draft.basePublishedChecksum !== (root?.checksum ?? null)
  )
    throw new Error('The draft or published content changed. Reload before publishing.')
  const previous = root ? await readAuthoredVersion(ctx, root) : null
  if (root && previous) await readPublishedDocument(ctx, root, previous)
  return { input, userId, draft, root, previous }
}

export async function normalizePublicationDocument(
  ctx: QueryCtx,
  state: Awaited<ReturnType<typeof readPublicationState>>
) {
  const { input, userId, draft, root } = state
  const saved = await readDraft(ctx, draft)
  const authored = parsePublicationDocument(input.subjectKind, {
    ...saved.payload,
    ...(input.subjectKind === 'BACKGROUND' ? { kind: 'BACKGROUND' } : {}),
    id: draft.subjectId,
    label: draft.label,
    systemId: draft.systemId,
    userId,
    status: 'ACTIVE'
  })
  requireAuthoredSizes(authored)
  requireAuthoredAbilities(authored)
  if (authored.subjectKind === 'CLASS' && authored.document.category === 'SUBCLASS')
    await requireClassParent(ctx, authored.document, userId)
  if (authored.subjectKind === 'RACE' && authored.document.category === 'SUBRACE')
    await requireRaceParent(ctx, authored.document, userId)
  const reader = await createSystemSourceReader(
    ctx,
    draft.systemId,
    userId,
    authoredSourceFacts({
      ...authored,
      checksum: checksumRuleDocument(authored.document)
    })
  )
  const normalized = await normalizeNodeRuntimeValues(reader, {
    mapId: input.subjectKind.toLowerCase(),
    systemId: draft.systemId,
    values: authored.document
  })
  const subject = parsePublicationDocument(input.subjectKind, normalized.values)
  if (subject.subjectKind === 'CLASS' && subject.document.category === 'SUBCLASS' && root)
    await assertNoClassChildren(ctx, root.systemId, root.id)
  if (subject.subjectKind === 'RACE' && subject.document.category === 'SUBRACE' && root)
    await assertNoRaceChildren(ctx, root.systemId, root.id)
  return subject
}

export async function assertPreparedClassDocument(
  ctx: QueryCtx,
  state: Awaited<ReturnType<typeof readPublicationState>>,
  document: unknown
) {
  const { input, userId, draft, root } = state
  if (input.subjectKind !== 'CLASS') throw new Error('Class publication is required.')
  await assertClassRelationshipsIndexed(ctx, draft.systemId)
  const subject = parsePublicationDocument('CLASS', document)
  if (
    subject.document.id !== draft.subjectId ||
    subject.document.systemId !== draft.systemId ||
    subject.document.label !== draft.label ||
    subject.document.userId !== userId ||
    subject.document.status !== 'ACTIVE'
  )
    throw new Error('Prepared Class publication does not match the saved draft.')
  if (subject.document.category === 'SUBCLASS') {
    await requireClassParent(ctx, subject.document, userId)
    if (root) await assertNoClassChildren(ctx, root.systemId, root.id)
    const { systemId, parentClassId, id } = subject.document
    const siblings = await ctx.db
      .query('authoredRoots')
      .withIndex('by_system_kind_parentClassId', (q) =>
        q.eq('systemId', systemId).eq('subjectKind', 'CLASS').eq('parentClassId', parentClassId)
      )
      .take(500)
    if (siblings.filter((sibling) => sibling.id !== id).length >= 499)
      throw new Error('Class family exceeds the 500-record authoring limit.')
  }
  return subject
}

export async function commitPublication(
  ctx: MutationCtx,
  state: Awaited<ReturnType<typeof readPublicationState>>,
  subject: Awaited<ReturnType<typeof normalizePublicationDocument>>,
  compilation: AuthoredStoredCompilation,
  authoringSources: AuthoredNodeRuntimeSourceFacts,
  effectiveEquipment?: ResolvedEquipment
): Promise<AuthoredPublicationResult> {
  const { input, userId, draft, root, previous } = state
  const { document } = subject
  const checksum = checksumRuleDocument(document)
  if (compilation.authoredChecksum !== checksum || authoringSources.checksum !== checksum)
    throw new Error('Prepared publication checksum mismatch.')
  await assertActivePublicationName(ctx, state, subject)

  let contentSourceId = root?.contentSourceId
  if (!contentSourceId) {
    contentSourceId = await requireDefaultUserContentSource(ctx, draft.systemId, userId)
  }
  const publicId = await ensureAuthoredRouteId(ctx, input.subjectKind, input.subjectId)
  if (publicId !== draft.publicId) throw new Error('Stored draft route mismatch.')
  const currentVersionPublicId = crypto.randomUUID()
  const { published } = await replaceCurrentAuthoredVersion(ctx, {
    root,
    previous,
    version: {
      subjectKind: input.subjectKind,
      id: input.subjectId,
      systemId: draft.systemId,
      label: document.label,
      checksum,
      contentSourceId,
      versionId: currentVersionPublicId,
      version: (previous?.version ?? 0) + 1,
      documentSchemaVersion: 1
    },
    documentJson: canonicalizeRuleDocument(document),
    compilation,
    current: {
      id: input.subjectId,
      subjectKind: input.subjectKind,
      systemId: draft.systemId,
      ownerUserId: userId,
      label: document.label,
      checksum,
      contentSourceId,
      currentVersionPublicId,
      authoringSources,
      activeNameKey: activePublicationNameKey(document.label),
      ...(subject.subjectKind === 'EQUIPMENT'
        ? {
            parentEquipmentId:
              subject.document.category === 'VARIANT' ? subject.document.parentEquipmentId : null,
            equipmentOptions: equipmentOptionFacts(subject.document, checksum, effectiveEquipment)
          }
        : {}),
      ...(subject.subjectKind === 'CLASS'
        ? {
            parentClassId:
              subject.document.category === 'SUBCLASS' ? subject.document.parentClassId : null
          }
        : {}),
      ...(subject.subjectKind === 'RACE'
        ? {
            parentRaceId:
              subject.document.category === 'SUBRACE' ? subject.document.parentRaceId : null
          }
        : {})
    },
    document,
    publicId
  })
  await promoteDraftImageSlot(ctx, {
    subjectId: draft.subjectId,
    subjectKind: draft.subjectKind
  })
  await deleteDraftPayload(ctx, draft)
  await ctx.db.delete(draft._id)
  return authoredPublicationResultSchema.parse({
    subjectKind: input.subjectKind,
    subjectId: input.subjectId,
    publicId,
    checksum,
    activeUpdatedAt: new Date(published._creationTime).toISOString()
  })
}
