import { Migrations } from '@convex-dev/migrations'
import {
  normalizedImageCropSchema,
  type NormalizedImageCrop
} from '@artificer-toolkit/schema/api/media'
import {
  mediaStoredAssetSchema,
  type MediaProfileClass
} from '@artificer-toolkit/schema/api/mediaAssets'
import { vttMapStoredAssetSchema } from '@artificer-toolkit/schema/projections/vttMapPersistence'
import { components, internal } from '../_generated/api'
import type { MutationCtx } from '../_generated/server'
import schema from '../schema'
import { internalMutation } from '../lib/mutations'

/**
 * ADR 0012 amendment (Q17): assets stop naming their target and crop, which move to the references.
 * The schema is widened only while these run on a deployment; the committed schema is already
 * narrow. Reference crops run first because they read the crop a legacy asset row still stores.
 */
const migrations = new Migrations(components.migrations, { schema, internalMutation })

/** The framing a pre-amendment asset stored for its single slot, or its centered square. */
async function legacyCrop(ctx: MutationCtx, assetId: string): Promise<NormalizedImageCrop> {
  const asset = await ctx.db
    .query('mediaAssets')
    .withIndex('by_publicId', (q) => q.eq('id', assetId))
    .unique()
  if (!asset) throw new Error('Stored image reference is unavailable.')
  const stored = 'crop' in asset ? normalizedImageCropSchema.safeParse(asset.crop) : null
  if (stored?.success) return stored.data
  const source = asset.variants.find((variant) => variant.kind === 'SOURCE')
  if (!source?.width || !source.height) throw new Error('Stored image framing is unavailable.')
  const side = Math.min(source.width, source.height)
  return {
    x: (source.width - side) / 2 / source.width,
    y: (source.height - side) / 2 / source.height,
    width: side / source.width,
    height: side / source.height
  }
}

export const avatarCrops = migrations.define({
  table: 'userProfiles',
  migrateOne: async (ctx, profile) => {
    if (profile.avatarAssetId && !profile.avatarCrop)
      await ctx.db.patch(profile._id, { avatarCrop: await legacyCrop(ctx, profile.avatarAssetId) })
  }
})

export const portraitCrops = migrations.define({
  table: 'characters',
  migrateOne: async (ctx, character) => {
    if (character.portraitAssetId && !character.portraitCrop)
      await ctx.db.patch(character._id, {
        portraitCrop: await legacyCrop(ctx, character.portraitAssetId)
      })
  }
})

export const slotCrops = migrations.define({
  table: 'authoredImageSlots',
  migrateOne: async (ctx, slot) => {
    const stored: Record<string, unknown> = slot
    if (stored.crop !== undefined) return
    await ctx.db.patch(slot._id, {
      crop: slot.assetId ? await legacyCrop(ctx, slot.assetId) : null
    })
  }
})

/**
 * Rewrites a pre-amendment asset row as an owner-scoped asset of its class. In-flight processing is
 * disposable development state: it fails closed, and its claimed outputs retire after their fence.
 * Legacy content art keeps its stored thumbnail as the picker preview; slot framing regenerates
 * from SOURCE on the next read.
 */
export const assets = migrations.define({
  table: 'mediaAssets',
  migrateOne: async (ctx, row) => {
    if (!('profile' in row)) return
    const profile = row.profile
    const profileClass: MediaProfileClass = profile === 'VTT_MAP' ? 'VTT_MAP' : 'CONTENT_ART'
    const processing = row.status === 'PROCESSING'
    if (row.operation) {
      await ctx.scheduler.runAt(
        Math.max(Date.now(), row.operation.expiresAt),
        internal.media.assets.deleteObjects,
        { keys: row.operation.outputs.map((output) => output.objectKey) }
      )
    }
    const base = {
      id: row.id,
      ownerUserId: row.ownerUserId,
      storageAssetId: row.id,
      upload: row.upload,
      status: processing ? 'REJECTED' : row.status,
      rawObjectKey: row.rawObjectKey,
      uploadExpiresAt: row.uploadExpiresAt,
      chargedBytes: row.chargedBytes,
      contentHash: null,
      variants: row.variants,
      operation: null,
      cleanupAt: processing ? Date.now() : row.cleanupAt
    }
    await ctx.db.replace(
      row._id,
      profileClass === 'VTT_MAP'
        ? vttMapStoredAssetSchema.parse({
            ...base,
            profileClass,
            hasSceneReferences: 'hasSceneReferences' in row ? row.hasSceneReferences : undefined,
            width: 'width' in row ? row.width : null,
            height: 'height' in row ? row.height : null
          })
        : mediaStoredAssetSchema.parse({ ...base, profileClass, cropThumbnails: [] })
    )
    if (processing)
      await ctx.scheduler.runAfter(0, internal.media.assets.cleanup, { assetId: row.id })
  }
})

export const run = migrations.runner([
  internal.media.migrations.avatarCrops,
  internal.media.migrations.portraitCrops,
  internal.media.migrations.slotCrops,
  internal.media.migrations.assets
])
