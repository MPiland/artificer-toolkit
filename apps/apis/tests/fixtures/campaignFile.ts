import {
  mediaStoredAssetSchema,
  type MediaStoredAsset
} from '@artificer-toolkit/schema/api/mediaAssets'
import type { fixture } from './characters'

/** A READY text file or handout map image owned by `userId`, charged to their media usage. */
export async function readyCampaignFile(
  t: Awaited<ReturnType<typeof fixture>>['t'],
  userId: string,
  profileClass: MediaStoredAsset['profileClass'] = 'TEXT_FILE'
) {
  const id = crypto.randomUUID()
  const text = profileClass === 'TEXT_FILE'
  const asset = mediaStoredAssetSchema.parse({
    id,
    ownerUserId: userId,
    storageAssetId: id,
    profileClass,
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
    contentHash: null,
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
    cropThumbnails: [],
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
