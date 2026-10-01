import { bindEncounterToPresentedScene } from '@artificer-toolkit/encounter-persistence/sceneBindingPersistence'
import type { BindEncounterToPresentedSceneInputDto } from '@artificer-toolkit/schema/api/vttScenes'
import type { LiveSessionRoomAuthorization } from '@artificer-toolkit/schema/api/liveSessionRoomAuthorization'
import { liveSessionCheckpointSceneSourceSchema } from '@artificer-toolkit/schema/api/liveSessionCheckpointScenes'
import type { RoomEncounterStore, RoomTransaction } from './roomEncounterStore.js'
import type { RoomInputs } from './roomInputs.js'
import { roomEncounterWriteTransaction } from './roomEncounterWritePorts.js'
import { readRoomEncounterPlayAuthorization } from './roomEncounterCommands.js'
import { readRoomSceneHeader } from './roomSceneRead.js'

/** Binding and current controllers join the caller's atomic room command commit. */
export async function executeRoomSceneBinding(input: {
  store: RoomEncounterStore
  transaction: RoomTransaction
  inputs: RoomInputs
  authorization: LiveSessionRoomAuthorization
  campaignId: string
  epoch: string
  userId: string
  sceneId: string
  expectedPresentationVersion: number
  command: BindEncounterToPresentedSceneInputDto
}) {
  const { store, transaction, inputs, authorization, campaignId, epoch, userId, sceneId } = input
  await inputs.encounter(input.command.encounterId.toLowerCase(), transaction)
  const ctx = await roomEncounterWriteTransaction({
    store,
    transaction,
    inputs,
    authorization,
    campaignId,
    epoch,
    userId,
    observed: inputs.revisions(campaignId, authorization.revisions)
  })
  const result = await bindEncounterToPresentedScene(
    ctx,
    input.command,
    {
      sceneId,
      expectedPresentationVersion: input.expectedPresentationVersion
    },
    {
      readPresentation: async (id) => {
        const header = readRoomSceneHeader(transaction, sceneId)
        const record = transaction.record('SCENE_CHECKPOINT_SOURCE', sceneId)
        if (id !== campaignId || header.campaignId !== id || !record)
          throw new Error('Room Scene presentation is unavailable.')
        const source = liveSessionCheckpointSceneSourceSchema.parse(JSON.parse(record.json))
        if (
          source.sceneId !== header.id ||
          source.definitionSaveId !== header.definitionSaveId ||
          source.definitionVersion !== header.definitionVersion
        )
          throw new Error('Room Scene presentation source is stale.')
        return { sceneId: header.id, version: source.presentationVersion }
      },
      readScene: async (id) => readRoomSceneHeader(transaction, id)
    }
  )
  const play = await readRoomEncounterPlayAuthorization(ctx, campaignId, authorization.play, result)
  if (!play) throw new Error('Bound room Encounter controls are unavailable.')
  return { result, play }
}
