import { mediaStoredAssetSchema } from '@artificer-toolkit/schema/api/mediaAssets'
import { vttMapStoredAssetSchema } from '@artificer-toolkit/schema/projections/vttMapPersistence'
import type { Doc } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'
import { readActiveCampaignMembers } from '../campaigns/authority'

type CampaignReferences = {
  attachments: Doc<'campaignAttachments'>[]
  definitions: Doc<'sceneDefinitions'>[]
  scenes: Doc<'campaignScenes'>[]
}

async function campaignReferences(ctx: MutationCtx, asset: Doc<'mediaAssets'>) {
  const [attachments, definitions, scenes] = await Promise.all([
    ctx.db
      .query('campaignAttachments')
      .withIndex('by_assetId', (query) => query.eq('assetId', asset.id))
      .collect(),
    asset.profileClass === 'VTT_MAP'
      ? ctx.db
          .query('sceneDefinitions')
          .withIndex('by_mapAssetId', (query) => query.eq('map.assetId', asset.id))
          .collect()
      : Promise.resolve([]),
    asset.profileClass === 'VTT_MAP'
      ? ctx.db
          .query('campaignScenes')
          .withIndex('by_mapAssetId', (query) => query.eq('map.assetId', asset.id))
          .collect()
      : Promise.resolve([])
  ])
  const byCampaign = new Map<string, CampaignReferences>()
  const group = (campaignId: string) => {
    const references = byCampaign.get(campaignId) ?? {
      attachments: [],
      definitions: [],
      scenes: []
    }
    byCampaign.set(campaignId, references)
    return references
  }
  for (const attachment of attachments) group(attachment.campaignId).attachments.push(attachment)
  for (const definition of definitions) group(definition.campaignId).definitions.push(definition)
  for (const scene of scenes) group(scene.campaignId).scenes.push(scene)
  return [...byCampaign].sort(([left], [right]) => left.localeCompare(right))
}

/** A copy for the Campaign owner that shares the departing user's stored objects (no byte copy). */
async function insertOwnerCopy(ctx: MutationCtx, asset: Doc<'mediaAssets'>, ownerUserId: string) {
  const { _id, _creationTime, ...stored } = asset
  const copy = {
    ...stored,
    id: crypto.randomUUID(),
    ownerUserId,
    upload: { ...asset.upload, idempotencyKey: crypto.randomUUID() },
    rawObjectKey: null,
    operation: null,
    cleanupAt: null
  }
  await ctx.db.insert(
    'mediaAssets',
    copy.profileClass === 'VTT_MAP'
      ? vttMapStoredAssetSchema.parse({ ...copy, hasSceneReferences: true })
      : mediaStoredAssetSchema.parse({ ...copy, cropThumbnails: [] })
  )
  return copy.id
}

/**
 * Account deletion retention is per reference (ADR 0012 amendment): each Campaign record that uses
 * a departing user's asset moves to a copy owned by that Campaign's owner, who is charged for it
 * once. The departing user's own asset is never transferred; with no references left, account purge
 * retires it, and its stored objects survive for as long as a copy shares them.
 */
export async function retainAccountCampaignMedia(ctx: MutationCtx, userId: string): Promise<void> {
  const assets = await ctx.db
    .query('mediaAssets')
    .withIndex('by_ownerUserId', (query) => query.eq('ownerUserId', userId))
    .collect()
  for (const asset of assets.sort((left, right) => left.id.localeCompare(right.id))) {
    if (asset.status !== 'READY') continue
    const copies = new Map<string, string>()
    for (const [campaignId, references] of await campaignReferences(ctx, asset)) {
      const campaign = await ctx.db
        .query('campaigns')
        .withIndex('by_publicId', (query) => query.eq('id', campaignId))
        .unique()
      if (!campaign) throw new Error('Stored Campaign media is unavailable.')
      const members = await readActiveCampaignMembers(ctx, campaign)
      const owner = members.find((member) => member.role === 'OWNER')
      if (!owner || owner.userId !== campaign.ownerUserId || owner.userId === userId)
        throw new Error('Stored Campaign media owner mismatch.')
      let copyId = copies.get(owner.userId)
      if (!copyId) {
        const profile = await ctx.db
          .query('userProfiles')
          .withIndex('by_userId', (query) => query.eq('userId', owner.userId))
          .unique()
        if (!profile) throw new Error('Stored Campaign media owner profile is unavailable.')
        // Retained shared media is charged without the new-upload quota veto.
        const next = (profile.mediaBytes ?? 0) + asset.chargedBytes
        if (!Number.isSafeInteger(next) || next < 0)
          throw new Error('Stored Campaign media usage is inconsistent.')
        await ctx.db.patch(profile._id, { mediaBytes: next })
        copyId = await insertOwnerCopy(ctx, asset, owner.userId)
        copies.set(owner.userId, copyId)
      }
      for (const attachment of references.attachments)
        await ctx.db.patch(attachment._id, { assetId: copyId })
      for (const definition of references.definitions)
        await ctx.db.patch(definition._id, { map: { ...definition.map, assetId: copyId } })
      for (const scene of references.scenes)
        await ctx.db.patch(scene._id, { map: { ...scene.map, assetId: copyId } })
      if (asset.profileClass !== 'VTT_MAP') continue
      const presentations = await ctx.db
        .query('campaignScenePresentations')
        .withIndex('by_campaignId_activeMapAssetId', (query) =>
          query.eq('campaignId', campaignId).eq('activeMapAssetId', asset.id)
        )
        .collect()
      for (const presentation of presentations)
        await ctx.db.patch(presentation._id, { activeMapAssetId: copyId })
    }
  }
}
