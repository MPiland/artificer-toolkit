import type { AuthoredImageTarget } from '@artificer-toolkit/schema/api/mediaAssets'
import { internal } from '../_generated/api'
import type { MutationCtx, QueryCtx } from '../_generated/server'
import { isImportRowVisible } from '../imports/visibility'

const GRACE = 24 * 60 * 60 * 1000

export async function readImageSlot(
  ctx: QueryCtx | MutationCtx,
  subjectId: string,
  scope: 'ACTIVE' | 'DRAFT',
  currentImportJobId?: string
) {
  const slot = await ctx.db
    .query('authoredImageSlots')
    .withIndex('by_subjectId_scope', (q) => q.eq('subjectId', subjectId).eq('scope', scope))
    .unique()
  return slot && (await isImportRowVisible(ctx, slot.importJobId, currentImportJobId)) ? slot : null
}

function assertSlotKind(
  slot: { subjectKind: AuthoredImageTarget['subjectKind'] },
  target: Pick<AuthoredImageTarget, 'subjectKind'>
) {
  if (slot.subjectKind !== target.subjectKind)
    throw new Error('Stored authored image slot mismatch.')
}

export async function retireOrphanImage(ctx: MutationCtx, assetId: string) {
  const reference = await ctx.db
    .query('authoredImageSlots')
    .withIndex('by_assetId', (q) => q.eq('assetId', assetId))
    .take(1)
  if (reference.length) return
  const asset = await ctx.db
    .query('mediaAssets')
    .withIndex('by_publicId', (q) => q.eq('id', assetId))
    .unique()
  if (!asset) return
  const cleanupAt = Date.now() + GRACE
  await ctx.db.patch(asset._id, { cleanupAt })
  await ctx.scheduler.runAt(cleanupAt, internal.media.assets.cleanup, { assetId })
}

export async function ensureDraftImageSlot(
  ctx: MutationCtx,
  target: { subjectId: string; subjectKind: AuthoredImageTarget['subjectKind'] },
  currentImportJobId?: string
) {
  const draft = await readImageSlot(ctx, target.subjectId, 'DRAFT', currentImportJobId)
  if (draft) {
    assertSlotKind(draft, target)
    return draft
  }
  const active = await readImageSlot(ctx, target.subjectId, 'ACTIVE', currentImportJobId)
  if (active) assertSlotKind(active, target)
  const id = await ctx.db.insert('authoredImageSlots', {
    subjectId: target.subjectId,
    subjectKind: target.subjectKind,
    ...(currentImportJobId !== undefined ? { importJobId: currentImportJobId } : {}),
    scope: 'DRAFT',
    assetId: active?.assetId ?? null,
    revision: 0
  })
  const slot = await ctx.db.get(id)
  if (!slot) throw new Error('Authored image slot is missing.')
  return slot
}

export async function dropImageSlot(
  ctx: MutationCtx,
  subjectId: string,
  scope: 'ACTIVE' | 'DRAFT'
) {
  const slot = await readImageSlot(ctx, subjectId, scope)
  if (!slot) return
  await ctx.db.delete(slot._id)
  if (slot.assetId) await retireOrphanImage(ctx, slot.assetId)
}

export async function promoteDraftImageSlot(
  ctx: MutationCtx,
  target: { subjectId: string; subjectKind: AuthoredImageTarget['subjectKind'] },
  currentImportJobId?: string
) {
  const draft = await ensureDraftImageSlot(ctx, target, currentImportJobId)
  const active = await readImageSlot(ctx, target.subjectId, 'ACTIVE', currentImportJobId)
  if (active) {
    assertSlotKind(active, target)
    await ctx.db.patch(active._id, { assetId: draft.assetId, revision: active.revision + 1 })
  } else {
    await ctx.db.insert('authoredImageSlots', {
      subjectId: target.subjectId,
      subjectKind: target.subjectKind,
      ...(currentImportJobId !== undefined ? { importJobId: currentImportJobId } : {}),
      scope: 'ACTIVE',
      assetId: draft.assetId,
      revision: 1
    })
  }
  await ctx.db.delete(draft._id)
  if (active?.assetId && active.assetId !== draft.assetId)
    await retireOrphanImage(ctx, active.assetId)
}
