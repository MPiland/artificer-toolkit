import type { Doc } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'
import { releaseAsset } from '../media/assets'

// Used by explicit removal and the notebook FK cascade in their owning transaction.
export async function removeCampaignAttachment(
  ctx: MutationCtx,
  attachment: Doc<'campaignAttachments'>
) {
  await ctx.db.delete(attachment._id)
  // The asset may still serve other Campaigns or its owner's slots; cleanup decides.
  await releaseAsset(ctx, attachment.assetId)
}
