import {
  readLiveCharacterMaximumHitPoints as readSharedCharacterMaximumHitPoints,
  readLiveCharacterStreamVersion as readSharedCharacterStreamVersion,
  readLiveMovementTargetState as readSharedMovementTargetState
} from '@artificer-toolkit/encounter-persistence/liveMovementTargetState'
import type {
  EncounterRunActorState,
  EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import type { MutationCtx } from '../_generated/server'
import { encounterReadTransaction } from '../encounters/encounterPorts'
import { readCampaignCharacterState } from '../campaigns/characterState'

/** The Character's effective maximum, as the Sheet shows it. */
export async function readLiveCharacterMaximumHitPoints(
  ctx: MutationCtx,
  state: EncounterRunState,
  characterId: string
) {
  return readSharedCharacterMaximumHitPoints(encounterReadTransaction(ctx), state, characterId)
}

/** The current Character stream version that a room plan's captured version must equal. */
export async function readLiveCharacterStreamVersion(
  ctx: MutationCtx,
  state: EncounterRunState,
  characterId: string
) {
  return readSharedCharacterStreamVersion(encounterReadTransaction(ctx), state, characterId)
}

/** Reads current play and checked Campaign conditions through the owning transaction. */
export async function readLiveMovementTargetState(
  ctx: MutationCtx,
  state: EncounterRunState,
  actor: EncounterRunActorState,
  plannedMaximumHitPoints: number
) {
  return readSharedMovementTargetState(
    encounterReadTransaction(ctx),
    state,
    actor,
    plannedMaximumHitPoints,
    (campaignId, characterId) => readCampaignCharacterState(ctx, campaignId, characterId)
  )
}
