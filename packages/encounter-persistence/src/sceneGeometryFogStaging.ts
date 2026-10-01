import type { z } from 'zod'
import { sceneGeometryStageFogInputSchema } from '@artificer-toolkit/schema/api/sceneGeometry'
import { sceneFogPatchInputSchema } from '@artificer-toolkit/schema/api/sceneFog'
import type { SceneLiveStateHeader } from '@artificer-toolkit/schema/api/sceneLiveState'
import {
  sceneStoredFogChunkSchema,
  sceneStoredFogSaveSchema
} from '@artificer-toolkit/schema/projections/sceneFogPersistence'
import {
  sceneStoredGeometrySaveSchema,
  type SceneStoredGeometrySave
} from '@artificer-toolkit/schema/projections/sceneGeometryPersistence'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { assertGeometryReceiving } from './sceneGeometryDocuments.js'
import { parseSceneFogSave } from './sceneFogDocuments.js'

/** Stages one complete fog layer on the receiving save; staging the same layer again is a no-op. */
export async function stageSceneGeometryFog(
  args: z.input<typeof sceneGeometryStageFogInputSchema>,
  callbacks: {
    readGeometrySave(saveId: string): Promise<{
      save: SceneStoredGeometrySave
      header: SceneLiveStateHeader
      userId: string
    }>
    readFogSave(saveId: string): Promise<ReturnType<typeof sceneStoredFogSaveSchema.parse> | null>
    insertFogSave(save: ReturnType<typeof sceneStoredFogSaveSchema.parse>): Promise<unknown>
    insertFogChunk(chunk: ReturnType<typeof sceneStoredFogChunkSchema.parse>): Promise<unknown>
    replaceGeometrySave(save: SceneStoredGeometrySave): Promise<unknown>
    scheduleCleanup?: (expiresAt: number, saveId: string) => Promise<unknown>
  }
): Promise<{ saveId: string }> {
  const input = sceneGeometryStageFogInputSchema.parse(args)
  const {
    save: parent,
    header,
    userId
  } = await callbacks.readGeometrySave(input.saveId.toLowerCase())
  assertGeometryReceiving(parent, header.version, userId)
  if (parent.sessionVision && !parent.characterRevisions)
    throw new Error('Scene geometry Character observations are missing.')
  const layer = input.layer
  if (layer.chunks.length === 0) throw new Error('Geometry fog layer must contain chunks.')
  const columns = Math.ceil(layer.width / 32)
  if (layer.chunks.length !== columns * Math.ceil(layer.height / 32))
    throw new Error('Geometry fog replacement must cover the complete layer.')
  const chunks = [...layer.chunks].sort((left, right) => left.index - right.index)
  for (const chunk of chunks) {
    const expectedIndex = (chunk.y / 32) * columns + chunk.x / 32
    if (
      chunk.x % 32 !== 0 ||
      chunk.y % 32 !== 0 ||
      chunk.width !== Math.min(32, layer.width - chunk.x) ||
      chunk.height !== Math.min(32, layer.height - chunk.y) ||
      chunk.index !== expectedIndex
    )
      throw new Error('Geometry fog chunks must use canonical 32-cell tiles.')
  }
  const manifest = chunks.map((chunk) => ({
    index: chunk.index,
    checksum: checksumCanonicalJson(chunk)
  }))
  const existingReference = parent.fogSaves.find((entry) => entry.ownerUserId === layer.ownerUserId)
  if (existingReference) {
    const existingRow = await callbacks.readFogSave(existingReference.saveId)
    if (!existingRow) throw new Error('Stored geometry fog save is inconsistent.')
    const existing = parseSceneFogSave(existingRow)
    if (
      existing.geometrySaveId !== parent.id ||
      existing.sceneId !== parent.sceneId ||
      existing.actorUserId !== parent.actorUserId ||
      existing.input.layer.ownerUserId !== layer.ownerUserId ||
      existing.input.layer.width !== layer.width ||
      existing.input.layer.height !== layer.height ||
      existing.input.expectedSceneVersion !== parent.snapshotVersion ||
      existing.status !== 'RECEIVING' ||
      existing.chunksRemoved ||
      existing.expiresAt <= Date.now() ||
      existing.receivedChunks !== existing.input.chunkManifest.length ||
      checksumCanonicalJson(existing.input.chunkManifest) !== checksumCanonicalJson(manifest)
    )
      throw new Error('Geometry fog layer was already staged differently.')
    return { saveId: parent.id }
  }
  const saveId = crypto.randomUUID()
  const childInput = sceneFogPatchInputSchema.parse({
    type: 'PATCH_SCENE_FOG',
    sceneId: parent.sceneId,
    commandId: saveId,
    expectedSceneVersion: parent.snapshotVersion,
    layer: {
      ownerUserId: layer.ownerUserId,
      width: layer.width,
      height: layer.height
    },
    chunkManifest: manifest
  })
  const child = sceneStoredFogSaveSchema.parse({
    id: saveId,
    sceneId: parent.sceneId,
    commandId: saveId,
    actorUserId: parent.actorUserId,
    geometrySaveId: parent.id,
    input: childInput,
    inputChecksum: checksumCanonicalJson(childInput),
    status: 'RECEIVING',
    receivedChunks: chunks.length,
    expiresAt: parent.expiresAt,
    chunksRemoved: false
  })
  await callbacks.insertFogSave(child)
  for (const [ordinal, chunk] of chunks.entries())
    await callbacks.insertFogChunk(
      sceneStoredFogChunkSchema.parse({
        saveId,
        ordinal,
        chunk,
        checksum: checksumCanonicalJson(chunk)
      })
    )
  const nextParent = sceneStoredGeometrySaveSchema.parse({
    ...parent,
    fogSaves: [...parent.fogSaves, { saveId, ownerUserId: layer.ownerUserId }]
  })
  await callbacks.replaceGeometrySave(nextParent)
  if (callbacks.scheduleCleanup) await callbacks.scheduleCleanup(parent.expiresAt, saveId)
  return { saveId: parent.id }
}
