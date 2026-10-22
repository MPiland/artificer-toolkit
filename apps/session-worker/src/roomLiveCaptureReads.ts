import type { LiveSessionRulesRevisions } from '@artificer-toolkit/schema/api/liveSessionRulesRevisions'
import type { LiveCaptureReads } from './nativeEncounterReads.js'
import { prepareRoomLiveCharacterSheet } from './roomCharacterRules.js'
import { readRoomEncounterTurnCapture } from './roomEncounterTurnCapture.js'
import type { RoomEncounterStore, RoomTransaction } from './roomEncounterStore.js'
import { readRoomSceneEntities, readRoomSceneHeader } from './roomSceneRead.js'
import type { RoomInputs } from './roomInputs.js'

/** The Encounter and Character captures the room answers from its own transaction. */
export function roomLiveCaptureReads(input: {
  ctx: Parameters<typeof readRoomEncounterTurnCapture>[0]
  store: RoomEncounterStore
  transaction: RoomTransaction
  inputs: RoomInputs
  observed: LiveSessionRulesRevisions
}): LiveCaptureReads {
  const { ctx, store, transaction, inputs, observed } = input
  return {
    encounterRules: (request) =>
      readRoomEncounterTurnCapture(
        ctx,
        inputs,
        transaction,
        request,
        observed.filter((revision) => revision.scope !== 'CHARACTER'),
        {
          readSceneHeader: async (sceneId) => readRoomSceneHeader(transaction, sceneId),
          readSceneEntities: (page) => readRoomSceneEntities(transaction, page)
        }
      ),
    prepareCharacter: (characterScope) =>
      prepareRoomLiveCharacterSheet(store, inputs, characterScope, observed, transaction)
  }
}
