import { runInDurableObject } from 'cloudflare:test'
import { env } from 'cloudflare:workers'
import { expect, it } from 'vitest'
import type { SceneFogPatchInput } from '@artificer-toolkit/schema/api/sceneFog'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { createUniformSceneFogLayer } from '@artificer-toolkit/shared/vtt'
import { ROOM_LIMITS } from '../src/roomLimits.js'
import { RoomSceneFogUploads } from '../src/roomSceneFogUploads.js'

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
    const cap = ROOM_LIMITS.maxFogUploadBytesPerUser
    const batch = (offset: number) => ({
      chunks: layer.chunks.slice(offset, offset + 8),
      offset,
      saveId
    })
    const batchBytes = batch(8).chunks.reduce(
      (total, chunk) => total + JSON.stringify(chunk).length,
      0
    )
    const stageBytes = (bytes: number) =>
      state.storage.sql.exec(
        'UPDATE room_scene_fog_uploads SET bytes = ? WHERE save_id = ?',
        bytes,
        saveId
      )
    expect(uploads.append(scope, input.commandId, batch(0)).receivedChunks).toBe(8)
    // One layer cannot reach the real cap through the public flow, so stage the remainder directly.
    stageBytes(cap - batchBytes + 1)
    expect(() => uploads.append(scope, input.commandId, batch(8))).toThrow('Too much fog is staged')
    expect(uploads.append(scope, input.commandId, batch(0)).receivedChunks).toBe(8)
    stageBytes(cap - batchBytes)
    expect(uploads.append(scope, input.commandId, batch(8)).receivedChunks).toBe(16)
  })
})
