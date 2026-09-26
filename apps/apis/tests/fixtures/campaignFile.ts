import {
  campaignStoredFileAssetSchema,
  type CampaignStoredFileAsset
} from '@artificer-toolkit/schema/projections/campaignFilePersistence'
import type { fixture } from './characters'

/** A READY Campaign file or handout map owned by `userId`, charged to their media usage. */
export async function readyCampaignFile(
  t: Awaited<ReturnType<typeof fixture>>['t'],
  userId: string,
  campaignId: string,
  profile: CampaignStoredFileAsset['profile'] = 'CAMPAIGN_FILE'
) {
  const id = crypto.randomUUID()
  const text = profile === 'CAMPAIGN_FILE'
  const asset = campaignStoredFileAssetSchema.parse({
    id,
    ownerUserId: userId,
    campaignId,
    profile,
    upload: {
      originalFileName: text ? 'notes.txt' : 'handout.png',
      declaredMimeType: text ? 'text/plain' : 'image/png',
      declaredBytes: 12,
      idempotencyKey: crypto.randomUUID()
    },
    status: 'READY',
    rawObjectKey: null,
    uploadExpiresAt: 0,
    chargedBytes: 12,
    variants: [
      {
        kind: 'SOURCE',
        objectKey: `ready/${id}/source`,
        byteSize: 12,
        mimeType: text ? 'text/plain' : 'image/webp',
        width: text ? null : 40,
        height: text ? null : 20
      }
    ],
    crop: null,
    operation: null,
    cleanupAt: Date.now() + 86_400_000
  })
  const rowId = await t.run(async (ctx) => {
    const ownerProfile = await ctx.db
      .query('userProfiles')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .unique()
    if (!ownerProfile) throw new Error('Missing fixture profile.')
    await ctx.db.patch(ownerProfile._id, { mediaBytes: (ownerProfile.mediaBytes ?? 0) + 12 })
    return ctx.db.insert('mediaAssets', asset)
  })
  return { ...asset, rowId }
}
