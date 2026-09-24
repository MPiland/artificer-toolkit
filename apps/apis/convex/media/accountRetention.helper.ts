import { campaignStoredFileAssetSchema } from '@artificer-toolkit/schema/projections/campaignFilePersistence'
import { vttMapStoredAssetSchema } from '@artificer-toolkit/schema/projections/vttMapPersistence'
import type { MutationCtx } from '../_generated/server'
import { readActiveCampaignMembers } from '../campaigns/authority'
export async function retainAccountCampaignMedia(ctx: MutationCtx, userId: string): Promise<void> {
  const assets = await ctx.db
    .query('mediaAssets')
    .withIndex('by_ownerUserId', (query) => query.eq('ownerUserId', userId))
    .collect()
  for (const asset of assets.sort((left, right) => left.id.localeCompare(right.id))) {
    if (
      asset.status !== 'READY' ||
      (asset.profile !== 'VTT_MAP' &&
        asset.profile !== 'CAMPAIGN_FILE' &&
        asset.profile !== 'CAMPAIGN_HANDOUT_MAP')
    )
      continue
    const [definitions, scenes, attachments] = await Promise.all([
      asset.profile === 'VTT_MAP'
        ? ctx.db
            .query('sceneDefinitions')
            .withIndex('by_mapAssetId', (query) => query.eq('map.assetId', asset.id))
            .collect()
        : Promise.resolve([]),
      asset.profile === 'VTT_MAP'
        ? ctx.db
            .query('campaignScenes')
            .withIndex('by_mapAssetId', (query) => query.eq('map.assetId', asset.id))
            .collect()
        : Promise.resolve([]),
      asset.profile === 'CAMPAIGN_FILE' || asset.profile === 'CAMPAIGN_HANDOUT_MAP'
        ? ctx.db
            .query('campaignAttachments')
            .withIndex('by_assetId', (query) => query.eq('assetId', asset.id))
            .collect()
        : Promise.resolve([])
    ])
    if (definitions.length + scenes.length + attachments.length === 0) continue
    const campaignId = asset.campaignId
    if (
      !campaignId ||
      definitions.some((row) => row.campaignId !== campaignId) ||
      scenes.some((row) => row.campaignId !== campaignId) ||
      attachments.some((row) => row.campaignId !== campaignId || row.assetId !== asset.id)
    )
      throw new Error('Stored Campaign media reference mismatch.')
    const campaign = await ctx.db
      .query('campaigns')
      .withIndex('by_publicId', (query) => query.eq('id', campaignId))
      .unique()
    if (!campaign) throw new Error('Stored Campaign media is unavailable.')
    const members = await readActiveCampaignMembers(ctx, campaign)
    const owner = members.find((member) => member.role === 'OWNER')
    if (!owner || owner.userId !== campaign.ownerUserId)
      throw new Error('Stored Campaign media owner mismatch.')
    const profile = await ctx.db
      .query('userProfiles')
      .withIndex('by_userId', (query) => query.eq('userId', owner.userId))
      .unique()
    if (!profile) throw new Error('Stored Campaign media owner profile is unavailable.')
    const next = (profile.mediaBytes ?? 0) + asset.chargedBytes
    if (!Number.isSafeInteger(next) || next < 0)
      throw new Error('Stored Campaign media usage is inconsistent.')
    const { _id, _creationTime, ...stored } = asset
    if (asset.profile === 'VTT_MAP') vttMapStoredAssetSchema.parse(stored)
    else campaignStoredFileAssetSchema.parse(stored)
    for (const attachment of attachments) {
      if (
        attachment.uploaderUserId !== asset.ownerUserId &&
        attachment.uploaderUserId !== asset.retainedFromUserId
      )
        throw new Error('Stored Campaign media attachment mismatch.')
    }
    await ctx.db.patch(asset._id, {
      ownerUserId: owner.userId,
      retainedFromUserId: asset.retainedFromUserId ?? userId,
      upload: { ...asset.upload, idempotencyKey: crypto.randomUUID() },
      ...(asset.profile === 'VTT_MAP' ? { hasSceneReferences: true } : {})
    })
    await ctx.db.patch(profile._id, { mediaBytes: next })
  }
}
