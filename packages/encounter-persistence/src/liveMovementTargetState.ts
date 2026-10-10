import { readEncounterActorConditionState } from '@artificer-toolkit/rules-runtime/encounterCharacterMechanicsBatch'
import type {
  EncounterRunActorState,
  EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import type { EncounterReadTransaction } from './ports.js'
import type { CampaignCharacterState } from '@artificer-toolkit/schema/projections/campaignCharacterState'
import { readCharacterMaximumHitPoints } from './characterMaximumHitPoints.js'

async function readLiveCharacterRow(
  ctx: EncounterReadTransaction,
  state: EncounterRunState,
  id: string
) {
  const row = await ctx.ports.readCharacterRow(id)
  if (!row || row.status !== 'ACTIVE' || row.systemId !== state.gameSystemId)
    throw new Error('Live Session Character changed.')
  return row
}

/**
 * The Character's effective maximum, as the Sheet shows it. It bounds a resource-only batch, whose
 * transition the room does not plan.
 */
export async function readLiveCharacterMaximumHitPoints(
  ctx: EncounterReadTransaction,
  state: EncounterRunState,
  characterId: string
) {
  return readCharacterMaximumHitPoints(
    ctx,
    (await readLiveCharacterRow(ctx, state, characterId)).play
  )
}

/** The current Character stream version that a room plan's captured version must equal. */
export async function readLiveCharacterStreamVersion(
  ctx: EncounterReadTransaction,
  state: EncounterRunState,
  characterId: string
) {
  return (await readLiveCharacterRow(ctx, state, characterId)).play.streamVersion
}

/**
 * Reads current target state: Character hit points and conditions come from the Character. A
 * Character's effective maximum is evaluated by the room from the fenced Character, so the planned
 * value stands in for it.
 */
export async function readLiveMovementTargetState(
  ctx: EncounterReadTransaction,
  state: EncounterRunState,
  actor: EncounterRunActorState,
  plannedMaximumHitPoints: number,
  readCampaignCharacterState: (
    campaignId: string,
    characterId: string
  ) => Promise<{ state: CampaignCharacterState }>
) {
  if (actor.kind !== 'CHARACTER')
    return {
      currentHitPoints: actor.currentHitPoints,
      temporaryHitPoints: actor.tempHitPoints,
      maximumHitPoints: actor.maxHitPoints,
      deathSaves: null,
      conditionIds: readEncounterActorConditionState(actor.conditions).ids
    }
  const row = await readLiveCharacterRow(ctx, state, actor.sourceId)
  const character = ctx.ports.readCharacterRecord(row)
  const campaign = await readCampaignCharacterState(state.campaignId, row.id)
  return {
    currentHitPoints: character.state.hitpoints.current,
    temporaryHitPoints: character.state.hitpoints.temp ?? 0,
    maximumHitPoints: plannedMaximumHitPoints,
    deathSaves: character.state.hitpoints.deathSaves,
    conditionIds: [
      ...new Set([
        ...(character.state.conditions ?? []).map((condition) => condition.conditionTypeId),
        ...campaign.state.conditions.map((condition) => condition.conditionTypeId)
      ])
    ]
  }
}

/**
 * The facts a movement or Concentration cleanup receipt binds to persisted state. Death saves are
 * left out: a later contact of the same movement can change them after an earlier cleanup was
 * planned, and the settlement carries them (D96).
 */
export function movementPersistedTransitionState(transition: {
  currentHitPoints: number
  temporaryHitPoints: number
  maximumHitPoints: number
  conditionIds: readonly string[]
}) {
  return {
    currentHitPoints: transition.currentHitPoints,
    temporaryHitPoints: transition.temporaryHitPoints,
    maximumHitPoints: transition.maximumHitPoints,
    conditionIds: transition.conditionIds
  }
}
