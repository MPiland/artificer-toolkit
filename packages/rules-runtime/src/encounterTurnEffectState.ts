import type {
  EncounterRunActorState,
  EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import type {
  ActiveRuleEffectRecord,
  EncounterMaintainedEffectStateRecord
} from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import type { TurnCoordinatorRootDto } from '@artificer-toolkit/schema/shared/ruleExecutionTurnPending'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { encounterAreaTargetOccurrenceId } from './encounterAreaPending.js'

export type TurnEffectBoundary = {
  ordinal: 0 | 1
  stage: 'START_OF_TURN' | 'END_OF_TURN'
  actorId: string | null
}

export function turnEffectOwner(
  actor: Pick<EncounterRunActorState, 'id' | 'kind' | 'sourceId'>,
  encounterId: string
) {
  if (actor.kind === 'CHARACTER') {
    if (!actor.sourceId) throw new Error('Encounter Character effect owner is incomplete.')
    return { kind: 'CHARACTER' as const, characterId: actor.sourceId }
  }
  return { kind: 'ENCOUNTER_ACTOR' as const, encounterId, targetActorId: actor.id }
}

/** Whether the effect lives in this Encounter for the actor holding it. */
export function isEffectLiveInEncounter(
  effect: ActiveRuleEffectRecord,
  actor: Pick<EncounterRunActorState, 'kind'>,
  encounterId: string
) {
  if (effect.definition.recurrence.lifetimeScope === 'OWNER') return true
  return actor.kind === 'CHARACTER'
    ? effect.sourceEncounterId === encounterId
    : effect.definition.origin.kind === 'ENCOUNTER' &&
        effect.definition.origin.sourceAggregateId === encounterId
}

/** A carried-over effect counts on the Campaign clock, so no turn boundary selects it (D99). */
export function isTurnEffectEligible(
  effect: ActiveRuleEffectRecord,
  actor: EncounterRunActorState,
  state: EncounterRunState,
  stage: TurnEffectBoundary['stage']
) {
  return (
    effect.lifecycle.expiresAtCampaignMinute === undefined &&
    effect.definition.recurrence.recurrenceStage === stage &&
    isEffectLiveInEncounter(effect, actor, state.id)
  )
}

export function turnEffectRetainedConditions(
  effect: ActiveRuleEffectRecord,
  effects: readonly ActiveRuleEffectRecord[],
  expired: ReadonlySet<string>
) {
  if (effect.definition.schemaVersion !== 2) return []
  const retained = new Set<string>()
  for (const contribution of effect.definition.stateContributions) {
    if (contribution.kind !== 'CONDITION_OWNERSHIP') continue
    if (contribution.baselinePresent) retained.add(contribution.conditionId)
    if (
      effects.some(
        (other) =>
          other.id !== effect.id &&
          !expired.has(other.id) &&
          other.definition.schemaVersion === 2 &&
          other.definition.stateContributions.some(
            (candidate) =>
              candidate.kind === 'CONDITION_OWNERSHIP' &&
              candidate.conditionId === contribution.conditionId
          )
      )
    )
      retained.add(contribution.conditionId)
  }
  return [...retained].sort()
}

export function turnEffectSelectionChecksum(
  commandType: TurnCoordinatorRootDto['commandType'],
  boundary: TurnEffectBoundary,
  actor: EncounterRunActorState,
  encounterId: string,
  candidates: readonly ActiveRuleEffectRecord[]
) {
  return checksumCanonicalJson({
    commandType,
    boundaries: candidates.map((effect) => ({
      boundaryOrdinal: boundary.ordinal,
      stage: boundary.stage,
      targetActorId: actor.id,
      owner: turnEffectOwner(actor, encounterId),
      activeEffectId: effect.id,
      createdOrdinal: effect.createdOrdinal
    }))
  })
}

/**
 * The maintained states of the effects `actor` holds. An area action's state is bound to the area's
 * occurrence, while each creature's effect is bound to the occurrence that creature's save ran under.
 */
export async function requireTurnMaintainedStates(
  encounterId: string,
  actor: Pick<EncounterRunActorState, 'id'>,
  candidates: readonly ActiveRuleEffectRecord[],
  loadState: (stateId: string) => Promise<EncounterMaintainedEffectStateRecord | null>
) {
  const states = new Map<string, EncounterMaintainedEffectStateRecord>()
  for (const effect of candidates) {
    const stateId = effect.maintainedEffectStateId
    if (stateId === null) continue
    const origin = effect.definition.origin
    if (
      origin.kind !== 'ENCOUNTER' ||
      origin.sourceAggregateId !== encounterId ||
      origin.sourceActorId === null
    )
      throw new Error('Maintained turn effect has an invalid Encounter source.')
    const state = states.get(stateId) ?? (await loadState(stateId))
    if (
      !state ||
      state.ownerActorId !== origin.sourceActorId ||
      ![
        state.descriptor.sourceOccurrenceId,
        encounterAreaTargetOccurrenceId(state.descriptor.sourceOccurrenceId, actor.id)
      ].includes(origin.sourceOccurrenceId)
    )
      throw new Error('Maintained turn effect source binding is stale.')
    states.set(stateId, state)
  }
  return states
}
