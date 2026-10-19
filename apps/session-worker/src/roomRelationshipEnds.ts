import { readEncounterBoundSceneTokens } from '@artificer-toolkit/encounter-persistence/actionSceneInputs'
import { readRunState } from '@artificer-toolkit/encounter-persistence/documents'
import type { EncounterReadContext } from '@artificer-toolkit/encounter-persistence/store'
import {
  endBrokenEncounterRelationships,
  readEndedEncounterRelationships
} from '@artificer-toolkit/encounter-persistence/relationshipEndSweep'
import type { LiveSessionRoomAuthorization } from '@artificer-toolkit/schema/api/liveSessionRoomAuthorization'
import type { EncounterRunState } from '@artificer-toolkit/schema/projections/encounterRunState'
import { roomSceneTokenReaders } from './roomActionSceneInputs.js'
import type { RoomEncounterStore, RoomRecordReader, RoomTransaction } from './roomEncounterStore.js'
import { roomEncounterReadTransaction } from './roomEncounterReadPorts.js'
import { roomEncounterWriteTransaction } from './roomEncounterWritePorts.js'
import type { RoomInputs } from './roomInputs.js'
import { ROOM_SCENE_DEFINITION_HEADER } from './roomSceneDefinition.js'
import { readRoomScene } from './roomSceneRead.js'

type RoomSweepScope = {
  store: RoomEncounterStore
  inputs: RoomInputs
  authorization: LiveSessionRoomAuthorization
  campaignId: string
  epoch: string
}

function activeRuns(store: RoomEncounterStore) {
  return store
    .documents('encounterRuns')
    .filter((run) => run.status === 'ACTIVE')
    .map(readRunState)
}

/** The Run's bound tokens on its Scene; a Scene the room does not hold places none. */
function readRoomBoundSceneTokens(
  ctx: EncounterReadContext,
  reader: RoomRecordReader,
  state: EncounterRunState
) {
  return readEncounterBoundSceneTokens(ctx, state, {
    readScene: async (sceneId) =>
      reader.record(ROOM_SCENE_DEFINITION_HEADER, sceneId) ? readRoomScene(reader, sceneId) : null,
    ...roomSceneTokenReaders(reader)
  })
}

/**
 * Whether an ACTIVE Run the room holds has a relationship whose hold broke on its own (D152): a
 * read outside any transaction, so a room with nothing to end journals nothing.
 */
export async function roomHasBrokenRelationships(scope: RoomSweepScope): Promise<boolean> {
  const { store, inputs, authorization, campaignId, epoch } = scope
  const userId = authorization.campaign.ownerUserId
  const ctx = await roomEncounterReadTransaction({
    store,
    inputs,
    authorization,
    campaignId,
    epoch,
    userId,
    observed: inputs.revisions(campaignId, authorization.revisions)
  })
  for (const state of activeRuns(store)) {
    const scene = await readRoomBoundSceneTokens(ctx, store, state)
    if ((await readEndedEncounterRelationships(ctx, { state, userId, scene })).ends.length)
      return true
  }
  return false
}

/**
 * Runs inside the caller's room transaction; the caller journals it. Ends each ACTIVE Run's broken
 * relationships as the Campaign owner, one recorded command per Run that had any.
 */
export async function endRoomBrokenRelationships(
  scope: RoomSweepScope & { transaction: RoomTransaction; commandId: string; occurredAt: string }
): Promise<void> {
  const { store, transaction, inputs, authorization, campaignId, epoch } = scope
  const userId = authorization.campaign.ownerUserId
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
  for (const state of activeRuns(store))
    await endBrokenEncounterRelationships(ctx, {
      state,
      userId,
      scene: await readRoomBoundSceneTokens(ctx, transaction, state),
      commandId: scope.commandId,
      occurredAt: scope.occurredAt
    })
}
