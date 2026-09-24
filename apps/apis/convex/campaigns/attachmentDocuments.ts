import type { Doc } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'
import { internal } from '../_generated/api'

// Used by explicit removal and the notebook FK cascade in their owning transaction.
export async function removeCampaignAttachment(
  ctx: MutationCtx,
  attachment: Doc<'campaignAttachments'>
) {
  const asset = await ctx.db
    .query('mediaAssets')
    .withIndex('by_publicId', (q) => q.eq('id', attachment.assetId))
    .unique()
  if (
    !asset ||
    (asset.profile !== 'CAMPAIGN_FILE' && asset.profile !== 'CAMPAIGN_HANDOUT_MAP') ||
    asset.campaignId !== attachment.campaignId ||
    asset.profile !== attachment.profile
  )
    throw new Error('Stored Campaign attachment mismatch.')
  await ctx.db.delete(attachment._id)
  if (
    await ctx.db
      .query('campaignAttachments')
      .withIndex('by_assetId', (q) => q.eq('assetId', asset.id))
      .first()
  )
    return
  const cleanupAt = Date.now() + 24 * 60 * 60_000
  await ctx.db.patch(asset._id, { cleanupAt })
  await ctx.scheduler.runAt(cleanupAt, internal.media.assets.cleanup, { assetId: asset.id })
}
