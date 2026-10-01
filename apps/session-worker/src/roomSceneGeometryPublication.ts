import type { EncounterCharacterWriteTransaction } from '@artificer-toolkit/encounter-persistence/ports'
import { readSpatialSceneGeometry } from '@artificer-toolkit/encounter-persistence/spatialSceneGeometry'
import type {
  SceneGeometryPublicationCallbacks,
  SceneGeometrySaveContext
} from '@artificer-toolkit/encounter-persistence/sceneGeometryPublication'
import {
  parseGeometrySave,
  assertStandaloneMovement
} from '@artificer-toolkit/encounter-persistence/sceneGeometryDocuments'
import {
  parseSceneFogSave,
  parseSceneFogLayer
} from '@artificer-toolkit/encounter-persistence/sceneFogDocuments'
import { planSceneFogPublication } from '@artificer-toolkit/encounter-persistence/sceneFogPublication'
import { stageSceneGeometryFog } from '@artificer-toolkit/encounter-persistence/sceneGeometryFogStaging'
import {
  sceneStoredLiveCommandSchema,
  sceneStoredLiveEntitySchema
} from '@artificer-toolkit/schema/projections/sceneLivePersistence'
import type { LiveSessionRulesRevisions } from '@artificer-toolkit/schema/api/liveSessionRulesRevisions'
import type { SceneFogLayer } from '@artificer-toolkit/shared/vtt'
import type { RoomTransaction } from './roomEncounterStore.js'
import {
  readRoomGeometrySave,
  readRoomSessionVisionScope,
  readRoomDefinitionEntity
} from './roomSceneGeometryRead.js'
import { readRoomSceneRow, writeRoomSceneRow } from './roomSceneRecords.js'

type RoomSpatialGeometry = Awaited<
  ReturnType<typeof readSpatialSceneGeometry<SceneGeometrySaveContext>>
>

/** Scene writes join the same outer transaction as Encounter mechanics, receipts and acknowledgements. */
export function roomSceneGeometryCallbacks(input: {
  ctx: EncounterCharacterWriteTransaction
  transaction: RoomTransaction
  observed: LiveSessionRulesRevisions
  presentation: { sceneId: string; version: number }
}): SceneGeometryPublicationCallbacks<RoomSpatialGeometry> {
  const { ctx, transaction, observed, presentation } = input
  const readGeometrySave = (saveId: string) =>
    readRoomGeometrySave({ ctx, transaction, saveId, presentation })
  const readLiveEntity: SceneGeometryPublicationCallbacks<RoomSpatialGeometry>['readLiveEntity'] =
    async (sceneId, collection, entityId) => {
      const row = readRoomSceneRow(transaction, 'sceneLiveEntities', [
        sceneId,
        collection,
        entityId
      ])
      return row ? sceneStoredLiveEntitySchema.parse(row) : null
    }
  return {
    readGeometrySave,
    readLiveEntity,
    readSceneCommand: async (sceneId, commandId) => {
      const row = readRoomSceneRow(transaction, 'sceneLiveCommands', [sceneId, commandId])
      return row ? sceneStoredLiveCommandSchema.parse(row) : null
    },
    readDefinitionEntity: async (saveId, collection, ordinal) =>
      readRoomDefinitionEntity(transaction, saveId, collection, ordinal),
    assertStandaloneMovement: (campaignId, command) =>
      assertStandaloneMovement(ctx, campaignId, command),
    readSessionVisionScope: async (scope, current) =>
      readRoomSessionVisionScope(scope, current, observed),
    assertSceneVisionCharacters: async (characters) => {
      if (new Set(characters.map((entry) => entry.characterId)).size !== characters.length)
        throw new Error('Scene geometry Character observations are duplicated.')
      for (const character of characters) {
        const current = observed.filter(
          (entry) => entry.scope === 'CHARACTER' && entry.id === character.characterId
        )
        if (current.length !== 1 || current[0]!.revision !== character.revision)
          throw new Error('Scene vision Character changed before geometry publication.')
      }
    },
    readSpatialSceneGeometry: (saveId, hints, currentSave) =>
      readSpatialSceneGeometry(
        ctx,
        saveId,
        hints,
        {
          readGeometrySave,
          readLiveToken: (sceneId, tokenId) => readLiveEntity(sceneId, 'tokens', tokenId),
          readDefinitionToken: async (saveId, ordinal) =>
            readRoomDefinitionEntity(transaction, saveId, 'tokens', ordinal)
        },
        currentSave
      ),
    writeLiveEntity: async (value) => {
      writeRoomSceneRow(transaction, 'sceneLiveEntities', value)
    },
    writeLiveState: async (value) => {
      writeRoomSceneRow(transaction, 'sceneLiveStates', value)
    },
    publishFog: async (reference, save, header, state) => {
      const row = readRoomSceneRow(transaction, 'sceneFogSaves', [reference.saveId])
      if (!row) throw new Error('Stored geometry fog save is inconsistent.')
      const child = parseSceneFogSave(row)
      if (
        child.geometrySaveId !== save.id ||
        child.sceneId !== save.sceneId ||
        child.actorUserId !== save.actorUserId ||
        child.input.layer.ownerUserId !== reference.ownerUserId ||
        child.status !== 'RECEIVING' ||
        child.chunksRemoved ||
        child.expiresAt <= Date.now() ||
        child.receivedChunks !== child.input.chunkManifest.length ||
        child.input.expectedSceneVersion !== save.snapshotVersion
      )
        throw new Error('Stored geometry fog save is inconsistent.')
      const layerRow = readRoomSceneRow(transaction, 'sceneFogLayers', [
        header.id,
        child.input.layer.ownerUserId
      ])
      const publication = planSceneFogPublication(
        child,
        header,
        state,
        layerRow ? parseSceneFogLayer(layerRow, header.version) : null
      )
      writeRoomSceneRow(transaction, 'sceneFogLayers', publication.layer)
      writeRoomSceneRow(transaction, 'sceneFogSaves', {
        ...child,
        status: 'PUBLISHED',
        ...(save.input.type === 'MOVE_SCENE_TOKEN'
          ? { previousLayer: publication.previousLayer }
          : {})
      })
      return publication.patch
    },
    markGeometryPublished: async (saveId) => {
      const row = readRoomSceneRow(transaction, 'sceneGeometrySaves', [saveId])
      if (!row) throw new Error('Scene geometry save is unavailable.')
      writeRoomSceneRow(transaction, 'sceneGeometrySaves', {
        ...parseGeometrySave(row),
        status: 'PUBLISHED'
      })
    },
    insertSceneCommand: async (value) => {
      if (readRoomSceneRow(transaction, 'sceneLiveCommands', [value.sceneId, value.commandId]))
        throw new Error('Scene command ID was already used.')
      writeRoomSceneRow(transaction, 'sceneLiveCommands', value)
    }
  }
}

export function stageRoomSceneGeometryFog(
  input: Parameters<typeof roomSceneGeometryCallbacks>[0],
  saveId: string,
  layer: SceneFogLayer
) {
  const { transaction } = input
  return stageSceneGeometryFog(
    { saveId, layer },
    {
      readGeometrySave: roomSceneGeometryCallbacks(input).readGeometrySave,
      readFogSave: async (id) => {
        const row = readRoomSceneRow(transaction, 'sceneFogSaves', [id])
        return row ? parseSceneFogSave(row) : null
      },
      insertFogSave: async (save) => {
        if (readRoomSceneRow(transaction, 'sceneFogSaves', [save.id]))
          throw new Error('Scene fog save ID was already used.')
        writeRoomSceneRow(transaction, 'sceneFogSaves', save)
      },
      insertFogChunk: async (chunk) => {
        if (readRoomSceneRow(transaction, 'sceneFogChunks', [chunk.saveId, chunk.ordinal]))
          throw new Error('Scene fog chunk was already staged.')
        writeRoomSceneRow(transaction, 'sceneFogChunks', chunk)
      },
      replaceGeometrySave: async (save) => {
        writeRoomSceneRow(transaction, 'sceneGeometrySaves', save)
      }
    }
  )
}
