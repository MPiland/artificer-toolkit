import { readEncounterActionSceneInputs } from '@artificer-toolkit/encounter-persistence/actionSceneInputs'
import type { EncounterReadContext } from '@artificer-toolkit/encounter-persistence/store'
import type { EncounterRunState } from '@artificer-toolkit/schema/projections/encounterRunState'
import type { ResolveEncounterActionInputDto } from '@artificer-toolkit/schema/api/encounters'
import { sceneStoredDefinitionEntitySchema } from '@artificer-toolkit/schema/projections/sceneDefinitionPersistence'
import { sceneStoredLiveEntitySchema } from '@artificer-toolkit/schema/projections/sceneLivePersistence'
import { canonicalizeJson } from '@artificer-toolkit/shared/canonicalJson'
import { VTT_SCENE_LIMITS } from '@artificer-toolkit/shared/vtt/scene'
import { ROOM_SCENE_DEFINITION_ENTITY } from './roomSceneDefinition.js'
import { readRoomScene } from './roomSceneRead.js'
import type { RoomRecordReader, RoomTransaction } from './roomEncounterStore.js'

/** The room's stored token rows for the shared Scene token checks; a missing token reads null. */
export function roomSceneTokenReaders(transaction: RoomRecordReader) {
  return {
    readLiveToken: async (sceneId: string, tokenId: string) => {
      const record = transaction.record(
        'SCENE_CHECKPOINT_ROW',
        canonicalizeJson(['sceneLiveEntities', sceneId, 'tokens', tokenId])
      )
      return record ? sceneStoredLiveEntitySchema.parse(JSON.parse(record.json)) : null
    },
    readDefinitionToken: async (saveId: string, tokenId: string) => {
      const tokens = transaction.records(ROOM_SCENE_DEFINITION_ENTITY).flatMap((record) => {
        const key: unknown = JSON.parse(record.key)
        if (!Array.isArray(key) || key.length !== 4 || typeof key[3] !== 'string')
          throw new Error('Room Scene definition identity is invalid.')
        return key[0] === saveId && key[1] === 'tokens' ? [{ record, entityId: key[3] }] : []
      })
      let matches = tokens.filter((token) => token.entityId === tokenId)
      if (matches.length > 1) throw new Error('Scene token identity is duplicated.')
      if (!matches.length) {
        matches = tokens.filter((token) => token.entityId.toLowerCase() === tokenId)
        if (tokens.length > VTT_SCENE_LIMITS.tokens)
          throw new Error('Stored Scene tokens exceed the Scene limit.')
        if (matches.length > 1) throw new Error('Scene token identity is duplicated.')
      }
      const row = matches[0]?.record
      return row ? sceneStoredDefinitionEntitySchema.parse(JSON.parse(row.json)) : null
    }
  }
}

/** Shares exact Scene/token binding checks with the Convex action comparator. */
export function readRoomActionSceneInputs(
  ctx: EncounterReadContext,
  transaction: RoomTransaction,
  state: EncounterRunState,
  command: Pick<ResolveEncounterActionInputDto, 'actorId' | 'targetActorId' | 'sceneContext'>
) {
  return readEncounterActionSceneInputs(ctx, state, command, {
    readScene: async (sceneId) => readRoomScene(transaction, sceneId),
    ...roomSceneTokenReaders(transaction)
  })
}
