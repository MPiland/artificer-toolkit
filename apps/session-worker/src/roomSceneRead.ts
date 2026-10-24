import {
  sceneLiveStateHeaderSchema,
  type SceneLiveEntity,
  type SceneLiveStateHeader
} from '@artificer-toolkit/schema/api/sceneLiveState'
import type { SceneCurrentEntityPageInput } from '@artificer-toolkit/schema/api/sceneRecipient'
import { liveSessionCheckpointSceneSourceSchema } from '@artificer-toolkit/schema/api/liveSessionCheckpointScenes'
import { sceneStoredDefinitionEntitySchema } from '@artificer-toolkit/schema/projections/sceneDefinitionPersistence'
import {
  sceneStoredLiveEntitySchema,
  sceneStoredLiveStateSchema
} from '@artificer-toolkit/schema/projections/sceneLivePersistence'
import {
  sceneFogLayerDtoSchema,
  type CampaignSceneStateDto
} from '@artificer-toolkit/schema/api/vttScenes'
import type { SceneBaseOrdinals } from '@artificer-toolkit/schema/api/sceneGeometry'
import {
  assembleCurrentScene,
  readAllCurrentEntityPages,
  readSceneCurrentEntities
} from '@artificer-toolkit/encounter-persistence/sceneCurrentEntities'
import {
  parseSceneFogLayer,
  parseSceneReferencedFogChunk
} from '@artificer-toolkit/encounter-persistence/sceneFogDocuments'
import { canonicalizeJson } from '@artificer-toolkit/shared/canonicalJson'
import type { SceneFogLayer } from '@artificer-toolkit/shared/vtt'
import type { RoomRecordReader, RoomTransaction } from './roomEncounterStore.js'
import { readRoomSceneRow } from './roomSceneRecords.js'
import {
  ROOM_SCENE_DEFINITION_HEADER,
  ROOM_SCENE_DEFINITION_ENTITY
} from './roomSceneDefinition.js'

export function readRoomScene(transaction: RoomRecordReader, sceneId: string) {
  const definition = transaction.record(ROOM_SCENE_DEFINITION_HEADER, sceneId)
  const source = transaction.record('SCENE_CHECKPOINT_SOURCE', sceneId)
  if (!definition || !source) throw new Error('Room Scene definition inputs are unavailable.')
  const base = sceneLiveStateHeaderSchema.parse(JSON.parse(definition.json))
  const pin = liveSessionCheckpointSceneSourceSchema.parse(JSON.parse(source.json))
  if (
    base.id !== sceneId ||
    pin.sceneId !== sceneId ||
    pin.definitionSaveId !== base.definitionSaveId ||
    pin.definitionVersion !== base.definitionVersion
  )
    throw new Error('Room Scene definition source changed.')
  const head = transaction.record(
    'SCENE_CHECKPOINT_ROW',
    canonicalizeJson(['sceneLiveStates', sceneId])
  )
  const live = head ? sceneStoredLiveStateSchema.parse(JSON.parse(head.json)) : null
  if (
    (!live && base.version !== 0) ||
    (live &&
      (live.sceneId !== sceneId ||
        live.version < base.version ||
        Object.values(live.settings).some((setting) => setting.version > live.version)))
  )
    throw new Error('Room live Scene version or settings are inconsistent.')
  const header = sceneLiveStateHeaderSchema.parse({
    ...base,
    version: live?.version ?? 0,
    fogLayerCount: live?.fogLayerCount ?? 0,
    currentCounts: live?.counts ?? { ...base.counts, measurements: 0 },
    ambientIllumination: live?.settings.ambientIllumination.value ?? base.ambientIllumination,
    daylight: live?.settings.ambientIllumination.daylight ?? base.daylight,
    visionRevealMode: live?.settings.visionRevealMode.value ?? base.visionRevealMode,
    fogMode: live?.settings.fogMode.value ?? base.fogMode
  })
  return { header, live }
}

export function readRoomSceneHeader(
  transaction: RoomTransaction,
  sceneId: string
): SceneLiveStateHeader {
  return readRoomScene(transaction, sceneId).header
}

/** One owner's stored fog layer with its referenced chunks, or null when the owner has none. */
export function readRoomSceneFogLayer(
  transaction: RoomTransaction,
  sceneId: string,
  ownerUserId: string | null,
  version: number
): SceneFogLayer | null {
  const value = readRoomSceneRow(transaction, 'sceneFogLayers', [sceneId, ownerUserId])
  if (!value) return null
  const layer = parseSceneFogLayer(value, version)
  return sceneFogLayerDtoSchema.parse({
    ownerUserId,
    width: layer.width,
    height: layer.height,
    chunks: layer.chunks.map((reference) =>
      parseSceneReferencedFogChunk(
        readRoomSceneRow(transaction, 'sceneFogSaves', [reference.saveId]),
        readRoomSceneRow(transaction, 'sceneFogChunks', [reference.saveId, reference.ordinal]),
        reference,
        sceneId,
        layer
      )
    )
  })
}

/**
 * One definition entity by identity. Definition ordinals are contiguous below the base count, so
 * each is one keyed read; the entity's own key carries its ordinal.
 */
export function readRoomSceneDefinitionEntity(
  transaction: RoomTransaction,
  header: Pick<SceneLiveStateHeader, 'definitionSaveId' | 'counts'>,
  collection: SceneLiveEntity['collection'],
  entityId: string
) {
  if (collection === 'measurements') return null
  for (let ordinal = 0; ordinal < header.counts[collection]; ordinal++) {
    const record = transaction.record(
      ROOM_SCENE_DEFINITION_ENTITY,
      canonicalizeJson([header.definitionSaveId, collection, ordinal, entityId])
    )
    if (record) return JSON.parse(record.json)
  }
  return null
}

/** Every stored fog layer of the Scene, shared layer first, as Convex lists them by owner. */
function readRoomSceneFogLayers(
  transaction: RoomTransaction,
  header: SceneLiveStateHeader
): SceneFogLayer[] {
  const prefix = canonicalizeJson(['sceneFogLayers', header.id]).slice(0, -1) + ','
  const owners = transaction
    .records('SCENE_CHECKPOINT_ROW')
    .filter((record) => record.key.startsWith(prefix))
    .map((record) => {
      const key: unknown = JSON.parse(record.key)
      const owner = Array.isArray(key) ? key[2] : undefined
      if (owner !== null && typeof owner !== 'string')
        throw new Error('Room Scene fog layer key is invalid.')
      return owner
    })
    .sort((left, right) =>
      left === right ? 0 : left === null ? -1 : right === null ? 1 : left < right ? -1 : 1
    )
  const layers = owners.map((owner) => {
    const layer = readRoomSceneFogLayer(transaction, header.id, owner, header.version)
    if (!layer) throw new Error('Room Scene fog layer is unavailable.')
    return layer
  })
  if (layers.length !== header.fogLayerCount)
    throw new Error('Room Scene fog layer count is inconsistent.')
  return layers
}

/**
 * The whole presented Scene from the room's rows, uncomposed with Character vision: the room's
 * Scene cache source. It reads the rows Convex checkpointed plus the room's own commits.
 */
export async function readRoomSceneState(
  transaction: RoomTransaction,
  sceneId: string
): Promise<{ scene: CampaignSceneStateDto; baseOrdinals: SceneBaseOrdinals }> {
  const { header } = readRoomScene(transaction, sceneId)
  const pages = await readAllCurrentEntityPages(header, (input) =>
    readRoomSceneEntities(transaction, input)
  )
  return assembleCurrentScene(header, pages, readRoomSceneFogLayers(transaction, header))
}

/** The same BASE/APPENDED reader used by Convex, over the command's staged native records. */
export function readRoomSceneEntities(
  transaction: RoomTransaction,
  input: SceneCurrentEntityPageInput
) {
  return readSceneCurrentEntities(input, readRoomScene(transaction, input.sceneId), {
    readDefinitionEntities: async ({ saveId, collection, afterOrdinal, numItems }) => {
      const candidates = transaction
        .records(ROOM_SCENE_DEFINITION_ENTITY)
        .flatMap((record) => {
          const key: unknown = JSON.parse(record.key)
          if (!Array.isArray(key) || key.length !== 4 || typeof key[2] !== 'number')
            throw new Error('Room Scene definition entity key is invalid.')
          return key[0] === saveId && key[1] === collection && key[2] > afterOrdinal
            ? [{ record, ordinal: key[2] }]
            : []
        })
        .sort((left, right) => left.ordinal - right.ordinal)
        .slice(0, numItems + 1)
      return candidates.map(({ record }) => {
        const value = sceneStoredDefinitionEntitySchema.parse(JSON.parse(record.json))
        if (
          record.key !==
          canonicalizeJson([value.saveId, value.value.collection, value.ordinal, value.entityId])
        )
          throw new Error('Room Scene definition entity identity is inconsistent.')
        return value
      })
    },
    readLiveEntity: async ({ sceneId, collection, entityId }) => {
      const row = transaction.record(
        'SCENE_CHECKPOINT_ROW',
        canonicalizeJson(['sceneLiveEntities', sceneId, collection, entityId])
      )
      return row ? sceneStoredLiveEntitySchema.parse(JSON.parse(row.json)) : null
    },
    readLiveEntities: async ({ sceneId, collection, afterOrdinal, numItems }) => {
      const prefix = canonicalizeJson(['sceneLiveEntities', sceneId, collection]).slice(0, -1) + ','
      return transaction
        .records('SCENE_CHECKPOINT_ROW')
        .filter((record) => record.key.startsWith(prefix))
        .map((record) => sceneStoredLiveEntitySchema.parse(JSON.parse(record.json)))
        .filter((row) => row.ordinal !== null && row.ordinal > afterOrdinal)
        .sort((left, right) => left.ordinal! - right.ordinal!)
        .slice(0, numItems + 1)
    }
  })
}
