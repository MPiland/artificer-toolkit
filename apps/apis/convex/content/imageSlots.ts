import type { AuthoredImageTarget } from '@artificer-toolkit/schema/api/mediaAssets'
import type { MutationCtx, QueryCtx } from '../_generated/server'
import { isImportRowVisible } from '../imports/visibility'
import { releaseAsset } from '../media/assets'

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
    crop: active?.crop ?? null,
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
  if (slot.assetId) await releaseAsset(ctx, slot.assetId)
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
    await ctx.db.patch(active._id, {
      assetId: draft.assetId,
      crop: draft.crop,
      revision: active.revision + 1
    })
  } else {
    await ctx.db.insert('authoredImageSlots', {
      subjectId: target.subjectId,
      subjectKind: target.subjectKind,
      ...(currentImportJobId !== undefined ? { importJobId: currentImportJobId } : {}),
      scope: 'ACTIVE',
      assetId: draft.assetId,
      crop: draft.crop,
      revision: 1
    })
  }
  await ctx.db.delete(draft._id)
  // Re-evaluates the replaced artwork: it retires if unused, or drops the framing ACTIVE no longer uses.
  if (active?.assetId) await releaseAsset(ctx, active.assetId)
}
