import { runInDurableObject } from 'cloudflare:test'
import { env } from 'cloudflare:workers'
import { expect, it, vi } from 'vitest'
import type { SceneFogPatchInput } from '@artificer-toolkit/schema/api/sceneFog'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { createUniformSceneFogLayer } from '@artificer-toolkit/shared/vtt'
import { RoomSceneFogUploads } from '../src/roomSceneFogUploads.js'

vi.mock('../src/roomLimits.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../src/roomLimits.js')>()
  return { ...original, ROOM_LIMITS: { ...original.ROOM_LIMITS, maxFogUploadBytesPerUser: 3_000 } }
})

it('refuses a fog batch that would stage more bytes than the per-account cap', async () => {
  const layer = createUniformSceneFogLayer(
    {
      barriers: [],
      doorStates: {},
      fogLayers: [],
      fogMode: 'SHARED_PARTY',
      grid: {
        cellSize: 1,
        diagonalPolicy: 'EQUAL',
        distancePerCell: 5,
        kind: 'SQUARE',
        origin: { x: 0, y: 0 },
        unit: 'FEET'
      },
      map: { assetId: crypto.randomUUID(), height: 512, tileManifestAssetId: null, width: 512 },
      tokens: []
    },
    { explored: true, ownerUserId: null }
  )
  const input: SceneFogPatchInput = {
    chunkManifest: layer.chunks.map((chunk) => ({
      checksum: checksumCanonicalJson(chunk),
      index: chunk.index
    })),
    commandId: crypto.randomUUID(),
    expectedSceneVersion: 0,
    layer: { height: layer.height, ownerUserId: null, width: layer.width },
    sceneId: crypto.randomUUID(),
    type: 'PATCH_SCENE_FOG'
  }
  const scope = { epoch: crypto.randomUUID(), userId: crypto.randomUUID() }
  const stub = env.LIVE_SESSION_ROOMS.get(env.LIVE_SESSION_ROOMS.idFromName(crypto.randomUUID()))

  await runInDurableObject(stub, (_instance, state) => {
    const uploads = new RoomSceneFogUploads(state.storage.sql)
    const { saveId } = uploads.begin(scope, input)
    const batch = (offset: number) => ({
      chunks: layer.chunks.slice(offset, offset + 8),
      offset,
      saveId
    })
    expect(uploads.append(scope, input.commandId, batch(0)).receivedChunks).toBe(8)
    expect(() => uploads.append(scope, input.commandId, batch(8))).toThrow('Too much fog is staged')
    expect(uploads.append(scope, input.commandId, batch(0)).receivedChunks).toBe(8)
  })
})
