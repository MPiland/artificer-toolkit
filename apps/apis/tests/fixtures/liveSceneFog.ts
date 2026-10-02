import {
  sceneStoredFogChunkSchema,
  sceneStoredFogLayerSchema,
  sceneStoredFogSaveSchema
} from '@artificer-toolkit/schema/projections/sceneFogPersistence'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import type { createSceneDefinitionFixture } from './sceneDefinitions'

type Base = Pick<Awaited<ReturnType<typeof createSceneDefinitionFixture>>, 't'>

/**
 * Writes one fog layer (one chunk; shared when `ownerUserId` is null) as a room checkpoint leaves
 * it, under a PUBLISHED fog save. The caller writes the live head that counts it
 * (`liveSceneHead({ fogLayers })`).
 */
export async function seedFogLayer(
  base: Base,
  options: {
    sceneId: string
    actorUserId: string
    ownerUserId: string | null
    ordinal?: number
    data?: string
  }
) {
  const ordinal = options.ordinal ?? 0
  const saveId = crypto.randomUUID()
  const commandId = crypto.randomUUID()
  const chunk = { data: options.data ?? 'AQ==', height: 1, index: 0, width: 1, x: 0, y: 0 }
  const chunkChecksum = checksumCanonicalJson(chunk)
  const input = {
    type: 'PATCH_SCENE_FOG' as const,
    sceneId: options.sceneId,
    commandId,
    expectedSceneVersion: 0,
    layer: { ownerUserId: options.ownerUserId, width: 8, height: 8 },
    chunkManifest: [{ index: 0, checksum: chunkChecksum }]
  }
  const layer = {
    sceneId: options.sceneId,
    ownerUserId: options.ownerUserId,
    width: 8,
    height: 8,
    ordinal,
    version: 1,
    chunks: [{ index: 0, saveId, ordinal: 0, checksum: chunkChecksum }]
  }
  await base.t.run(async (ctx) => {
    await ctx.db.insert(
      'sceneFogSaves',
      sceneStoredFogSaveSchema.parse({
        id: saveId,
        sceneId: options.sceneId,
        commandId,
        actorUserId: options.actorUserId,
        input,
        inputChecksum: checksumCanonicalJson(input),
        status: 'PUBLISHED',
        receivedChunks: 1,
        expiresAt: Date.now() + 60_000,
        chunksRemoved: false
      })
    )
    await ctx.db.insert(
      'sceneFogChunks',
      sceneStoredFogChunkSchema.parse({ saveId, ordinal: 0, chunk, checksum: chunkChecksum })
    )
    await ctx.db.insert(
      'sceneFogLayers',
      sceneStoredFogLayerSchema.parse({ ...layer, checksum: checksumCanonicalJson(layer) })
    )
  })
  return { saveId, chunk }
}
