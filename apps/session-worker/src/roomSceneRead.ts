import {
  sceneLiveStateHeaderSchema,
  type SceneLiveStateHeader
} from '@artificer-toolkit/schema/api/sceneLiveState'
import type { SceneCurrentEntityPageInput } from '@artificer-toolkit/schema/api/sceneRecipient'
import { liveSessionCheckpointSceneSourceSchema } from '@artificer-toolkit/schema/api/liveSessionCheckpointScenes'
import { sceneStoredDefinitionEntitySchema } from '@artificer-toolkit/schema/projections/sceneDefinitionPersistence'
import {
  sceneStoredLiveEntitySchema,
  sceneStoredLiveStateSchema
} from '@artificer-toolkit/schema/projections/sceneLivePersistence'
import { readSceneCurrentEntities } from '@artificer-toolkit/encounter-persistence/sceneCurrentEntities'
import { canonicalizeJson } from '@artificer-toolkit/shared/canonicalJson'
import type { RoomTransaction } from './roomEncounterStore.js'
import {
  ROOM_SCENE_DEFINITION_HEADER,
  ROOM_SCENE_DEFINITION_ENTITY
} from './roomSceneDefinition.js'

export function readRoomScene(transaction: RoomTransaction, sceneId: string) {
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
