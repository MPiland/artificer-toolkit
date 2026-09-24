import { readEncounterActorConditionState } from '@artificer-toolkit/rules-runtime/encounterCharacterMechanicsBatch'
import type {
  EncounterRunActorState,
  EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import type { characterMechanicsTargetStateDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionMechanics'
import type { MutationCtx } from '../_generated/server'
import { readCampaignCharacterState } from '../campaigns/characterState'
import { readCharacterRecord } from '../characters/stateDocuments'

/** Reads only persisted target fields; scalar values remain part of the prepared rules evidence. */
export async function readLiveMovementTargetState(
  ctx: MutationCtx,
  state: EncounterRunState,
  actor: EncounterRunActorState
) {
  let conditionIds: string[]
  if (actor.kind === 'CHARACTER') {
    const characterId = actor.sourceId
    if (!characterId || actor.sourceRevision === null)
      throw new Error('Live Session movement Character binding changed.')
    const row = await ctx.db
      .query('characters')
      .withIndex('by_publicId', (q) => q.eq('id', characterId))
      .unique()
    if (
      !row ||
      row.status !== 'ACTIVE' ||
      row.systemId !== state.gameSystemId ||
      row.streamVersion !== actor.sourceRevision
    )
      throw new Error('Live Session movement Character changed.')
    const character = readCharacterRecord(row)
    if (
      character.state.hitpoints.current !== actor.currentHitPoints ||
      (character.state.hitpoints.temp ?? 0) !== actor.tempHitPoints
    )
      throw new Error('Live Session movement Character mirror changed.')
    const campaign = await readCampaignCharacterState(ctx, state.campaignId, row.id)
    conditionIds = [
      ...new Set([
        ...(character.state.conditions ?? []).map((condition) => condition.conditionTypeId),
        ...campaign.state.conditions.map((condition) => condition.conditionTypeId)
      ])
    ]
  } else conditionIds = readEncounterActorConditionState(actor.conditions).ids
  return {
    currentHitPoints: actor.currentHitPoints,
    temporaryHitPoints: actor.tempHitPoints,
    maximumHitPoints: actor.maxHitPoints,
    conditionIds
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
