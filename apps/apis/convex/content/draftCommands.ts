import { v } from 'convex/values'
import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import {
  authoredDraftCommandInputSchema,
  authoredDraftLookupInputSchema,
  authoredDraftDtoSchema,
  type AuthoredDraftCommandInput,
  type AuthoredDraftResult
} from '@artificer-toolkit/schema/api/authoredDrafts'
import { authoredDocumentVersionSchema } from '@artificer-toolkit/schema/projections/authoredContent'
import { jsonValueSchema } from '@artificer-toolkit/schema/projections/identity'
import { canonicalizeRuleDocument } from '@artificer-toolkit/shared/rules/checksum'
import { cloneAuthoredItem } from '@artificer-toolkit/shared/utils'
import { internalMutation } from '../lib/mutations'
import type { MutationCtx } from '../_generated/server'
import { requireIdentity } from '../lib/identity'
import { syncAccountUsage } from '../lib/accountUsage'
import { assertNewHomebrewRootAllowed } from './draftQuota'
import { dropImageSlot, ensureDraftImageSlot } from './imageSlots'
import { ensureAuthoredRouteId, readVisibleAuthoredRouteId } from './routeIds'
import {
  canReadAuthoredRoot,
  deleteDraftPayload,
  insertDraftPayload,
  readAuthoredVersion,
  readPublishedDocument
} from './documents'

async function saveDraft(ctx: MutationCtx, input: AuthoredDraftCommandInput, userId: string) {
  const [root, existing, system] = await Promise.all([
    ctx.db
      .query('authoredRoots')
      .withIndex('by_publicId', (q) => q.eq('id', input.subjectId))
      .unique(),
    ctx.db
      .query('authoredDrafts')
      .withIndex('by_subjectId', (q) => q.eq('subjectId', input.subjectId))
      .unique(),
    ctx.db
      .query('systems')
      .withIndex('by_publicId', (q) => q.eq('id', input.systemId))
      .unique()
  ])
  if (!system) throw new Error('System not found.')
  if (
    root &&
    (root.ownerUserId !== userId ||
      root.subjectKind !== input.subjectKind ||
      root.systemId !== input.systemId ||
      !(await canReadAuthoredRoot(ctx, root, userId)))
  ) {
    throw new Error('Authored content cannot be edited by the current user.')
  }
  if (
    existing &&
    (existing.userId !== userId ||
      existing.subjectKind !== input.subjectKind ||
      existing.systemId !== input.systemId)
  ) {
    throw new Error('Authored content cannot be edited by the current user.')
  }
  if (!root && !existing) await assertNewHomebrewRootAllowed(ctx, userId)
  const published = root && !existing ? await ctx.db.get(root.currentVersionId) : null
  if (
    root &&
    !existing &&
    (!published ||
      published.id !== root.id ||
      published.subjectKind !== root.subjectKind ||
      published.systemId !== root.systemId ||
      published.checksum !== root.checksum)
  )
    throw new Error('Stored authored content identity mismatch.')
  const publicId = await ensureAuthoredRouteId(ctx, input.subjectKind, input.subjectId)
  // Publish compares this existing server token; same-millisecond saves must differ.
  const lastUpdatedAt = existing?.updatedAt ? Date.parse(existing.updatedAt) : 0
  const now = new Date(Math.max(Date.now(), lastUpdatedAt + 1)).toISOString()
  const payload = jsonValueSchema.parse({
    ...input.payload,
    kind: input.subjectKind,
    id: input.subjectId,
    label: input.label,
    systemId: input.systemId,
    userId,
    status: 'DRAFT'
  })
  const draft = authoredDraftDtoSchema.parse({
    subjectKind: input.subjectKind,
    subjectId: input.subjectId,
    systemId: input.systemId,
    label: input.label,
    userId,
    publicId,
    status: 'DRAFT',
    draftState: root ? 'ACTIVE_WITH_DRAFT' : 'DRAFT_ONLY',
    baseActiveUpdatedAt: existing
      ? existing.baseActiveUpdatedAt
      : published
        ? new Date(published._creationTime).toISOString()
        : null,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    payload
  })
  const { payload: _payload, ...metadata } = draft
  const payloadId = await insertDraftPayload(
    ctx,
    input.subjectId,
    input.systemId,
    canonicalizeRuleDocument(payload)
  )
  const stored = {
    ...metadata,
    payloadId,
    basePublishedChecksum: existing ? existing.basePublishedChecksum : (root?.checksum ?? null)
  }
  if (existing) {
    await ctx.db.replace(existing._id, stored)
    await deleteDraftPayload(ctx, existing)
  } else {
    await ctx.db.insert('authoredDrafts', stored)
    await ensureDraftImageSlot(ctx, { subjectId: input.subjectId, subjectKind: input.subjectKind })
  }
  await syncAccountUsage(ctx, 'homebrewRoots', input.subjectId)
  return draft
}

export const save = internalMutation({
  args: zodToConvexFields(authoredDraftCommandInputSchema.shape),
  returns: zodToConvex(authoredDraftDtoSchema),
  handler: async (ctx, args): Promise<AuthoredDraftResult> => {
    const { userId } = await requireIdentity(ctx)
    return saveDraft(ctx, authoredDraftCommandInputSchema.parse(args), userId)
  }
})

export const discard = internalMutation({
  args: zodToConvexFields(authoredDraftLookupInputSchema.shape),
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    const { userId } = await requireIdentity(ctx)
    const { subjectId, subjectKind } = authoredDraftLookupInputSchema.parse(args)
    const draft = await ctx.db
      .query('authoredDrafts')
      .withIndex('by_subjectId', (q) => q.eq('subjectId', subjectId))
      .unique()
    if (!draft || draft.userId !== userId || draft.subjectKind !== subjectKind)
      throw new Error('Draft not found.')
    const active = await ctx.db
      .query('authoredRoots')
      .withIndex('by_publicId', (q) => q.eq('id', subjectId))
      .unique()
    await deleteDraftPayload(ctx, draft)
    await ctx.db.delete(draft._id)
    await dropImageSlot(ctx, subjectId, 'DRAFT')
    if (!active) {
      const route = await readVisibleAuthoredRouteId(ctx, { subjectId })
      if (route) await ctx.db.delete(route._id)
    }
    await syncAccountUsage(ctx, 'homebrewRoots', subjectId)
    return null
  }
})

export const duplicate = internalMutation({
  args: zodToConvexFields(authoredDraftLookupInputSchema.shape),
  returns: zodToConvex(authoredDraftDtoSchema),
  handler: async (ctx, args): Promise<AuthoredDraftResult> => {
    const { userId } = await requireIdentity(ctx)
    const { subjectId, subjectKind } = authoredDraftLookupInputSchema.parse(args)
    const root = await ctx.db
      .query('authoredRoots')
      .withIndex('by_publicId', (q) => q.eq('id', subjectId))
      .unique()
    if (!root || root.subjectKind !== subjectKind) throw new Error('Authored content not found.')
    if (!(await canReadAuthoredRoot(ctx, root, userId))) {
      throw new Error('Authored content not found.')
    }
    const version = await readAuthoredVersion(ctx, root)
    const document = await readPublishedDocument(ctx, root, version)
    const published = authoredDocumentVersionSchema.parse({
      subjectKind,
      subjectId,
      versionId: version.versionId,
      version: version.version,
      documentSchemaVersion: version.documentSchemaVersion,
      checksum: version.checksum,
      document
    })
    if (published.document.systemId !== root.systemId || published.document.label !== root.label) {
      throw new Error('Stored authored content metadata mismatch.')
    }
    // Clone the checksum-verified source document; broad envelope parsing validates identity but
    // intentionally strips fields it does not own from some domain-specific mechanics.
    const copy = cloneAuthoredItem({
      ...document,
      id: published.document.id,
      label: published.document.label,
      status: published.document.status
    })
    return saveDraft(
      ctx,
      authoredDraftCommandInputSchema.parse({
        subjectKind,
        subjectId: copy.id,
        systemId: root.systemId,
        label: copy.label,
        payload: copy
      }),
      userId
    )
  }
})
