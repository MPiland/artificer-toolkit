import { readEncounterActorConditionState } from '@artificer-toolkit/rules-runtime/encounterCharacterMechanicsBatch'
import type {
  EncounterRunActorState,
  EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import type { characterMechanicsTargetStateDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionMechanics'
import type { MutationCtx } from '../_generated/server'
import { readCampaignCharacterState } from '../campaigns/characterState'
import { readCharacterMaximumHitPoints } from '../characters/characterMaximumHitPoints'
import { readCharacterRecord } from '../characters/stateDocuments'

async function readLiveCharacterRow(ctx: MutationCtx, state: EncounterRunState, id: string) {
  const row = await ctx.db
    .query('characters')
    .withIndex('by_publicId', (q) => q.eq('id', id))
    .unique()
  if (!row || row.status !== 'ACTIVE' || row.systemId !== state.gameSystemId)
    throw new Error('Live Session Character changed.')
  return row
}

/**
 * The Character's effective maximum, as the Sheet shows it. It bounds a resource-only batch, whose
 * transition the room does not plan.
 */
export async function readLiveCharacterMaximumHitPoints(
  ctx: MutationCtx,
  state: EncounterRunState,
  characterId: string
) {
  return readCharacterMaximumHitPoints(ctx, await readLiveCharacterRow(ctx, state, characterId))
}

/** The current Character stream version that a room plan's captured version must equal. */
export async function readLiveCharacterStreamVersion(
  ctx: MutationCtx,
  state: EncounterRunState,
  characterId: string
) {
  return (await readLiveCharacterRow(ctx, state, characterId)).streamVersion
}

/**
 * Reads current target state: Character hit points and conditions come from the Character. A
 * Character's effective maximum is evaluated by the room from the fenced Character, so the planned
 * value stands in for it.
 */
export async function readLiveMovementTargetState(
  ctx: MutationCtx,
  state: EncounterRunState,
  actor: EncounterRunActorState,
  plannedMaximumHitPoints: number
) {
  if (actor.kind !== 'CHARACTER')
    return {
      currentHitPoints: actor.currentHitPoints,
      temporaryHitPoints: actor.tempHitPoints,
      maximumHitPoints: actor.maxHitPoints,
      conditionIds: readEncounterActorConditionState(actor.conditions).ids
    }
  const row = await readLiveCharacterRow(ctx, state, actor.sourceId)
  const character = readCharacterRecord(row)
  const campaign = await readCampaignCharacterState(ctx, state.campaignId, row.id)
  return {
    currentHitPoints: character.state.hitpoints.current,
    temporaryHitPoints: character.state.hitpoints.temp ?? 0,
    maximumHitPoints: plannedMaximumHitPoints,
    conditionIds: [
      ...new Set([
        ...(character.state.conditions ?? []).map((condition) => condition.conditionTypeId),
        ...campaign.state.conditions.map((condition) => condition.conditionTypeId)
      ])
    ]
  }
}

export function movementPersistedTransitionState(
  transition: ReturnType<typeof characterMechanicsTargetStateDtoSchema.parse>
) {
  return {
    currentHitPoints: transition.currentHitPoints,
    temporaryHitPoints: transition.temporaryHitPoints,
    maximumHitPoints: transition.maximumHitPoints,
    conditionIds: transition.conditionIds
  }
}
