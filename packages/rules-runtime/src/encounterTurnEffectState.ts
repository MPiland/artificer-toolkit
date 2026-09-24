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

export type TurnEffectBoundary = {
  ordinal: 0 | 1
  stage: 'START_OF_TURN' | 'END_OF_TURN'
  actorId: string | null
}

export function turnEffectOwner(actor: EncounterRunActorState, encounterId: string) {
  if (actor.kind === 'CHARACTER') {
    if (!actor.sourceId) throw new Error('Encounter Character effect owner is incomplete.')
    return { kind: 'CHARACTER' as const, characterId: actor.sourceId }
  }
  return { kind: 'ENCOUNTER_ACTOR' as const, encounterId, targetActorId: actor.id }
}

export function isTurnEffectEligible(
  effect: ActiveRuleEffectRecord,
  actor: EncounterRunActorState,
  state: EncounterRunState,
  stage: TurnEffectBoundary['stage']
) {
  if (effect.definition.recurrence.recurrenceStage !== stage) return false
  if (effect.definition.recurrence.lifetimeScope === 'OWNER') return true
  return actor.kind === 'CHARACTER'
    ? effect.sourceEncounterId === state.id
    : effect.definition.origin.kind === 'ENCOUNTER' &&
        effect.definition.origin.sourceAggregateId === state.id
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

export async function requireTurnMaintainedStates(
  encounterId: string,
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
      state.descriptor.sourceOccurrenceId !== origin.sourceOccurrenceId
    )
      throw new Error('Maintained turn effect source binding is stale.')
    states.set(stateId, state)
  }
  return states
}
