import type {
  EncounterRunActorState,
  EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import type {
  ActiveRuleEffectRecord,
  EncounterMaintainedEffectStateRecord
} from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import type { EncounterActorDispositionDto } from '@artificer-toolkit/schema/api/encounterData'
import type {
  ActiveEffectSaveTally,
  ActiveEffectSaveThresholds
} from '@artificer-toolkit/schema/shared/activeRuleEffectLifecycle'
import type { TurnCoordinatorRootDto } from '@artificer-toolkit/schema/shared/ruleExecutionTurnPending'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import type { CharacterRuleActionApplication } from './characterRuleActionSystemAdapter.js'
import { encounterAreaTargetOccurrenceId } from './encounterAreaPending.js'
import { targetEndedEffects } from './encounterEndedEffectRelease.js'

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

/**
 * A turn's save counts exactly one success or one failure. A consecutive tally zeroes the other
 * count; any other keeps it. An absent `after` leaves the stored tally as it is, and an effect with
 * no thresholds keeps no tally.
 */
export function isSaveTallyStep(
  before: ActiveEffectSaveTally | undefined,
  after: ActiveEffectSaveTally | undefined,
  thresholds: ActiveEffectSaveThresholds | undefined
) {
  if (!after) return true
  if (!thresholds) return false
  const prior = before ?? { successes: 0, failures: 0 }
  const kept = thresholds.consecutive ? 0 : undefined
  return (
    (after.successes === prior.successes + 1 && after.failures === (kept ?? prior.failures)) ||
    (after.failures === prior.failures + 1 && after.successes === (kept ?? prior.successes))
  )
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
  const retained = new Set<string>()
  for (const contribution of effect.definition.stateContributions) {
    if (contribution.kind !== 'CONDITION_OWNERSHIP') continue
    if (contribution.baselinePresent) retained.add(contribution.conditionId)
    if (
      effects.some(
        (other) =>
          other.id !== effect.id &&
          !expired.has(other.id) &&
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
    const state = states.get(stateId) ?? (await loadState(stateId))
    if (!state) throw new Error('Maintained turn effect source binding is stale.')
    const { provenance } = state.descriptor
    if (provenance.kind === 'CARRIED') {
      // D151: a carried effect keeps its earlier Run's origin; its caster stamp binds it.
      if (effect.lifecycle.concentrationCasterCharacterId !== provenance.casterCharacterId)
        throw new Error('Maintained turn effect source binding is stale.')
      states.set(stateId, state)
      continue
    }
    const origin = effect.definition.origin
    if (
      origin.kind !== 'ENCOUNTER' ||
      origin.sourceAggregateId !== encounterId ||
      origin.sourceActorId === null
    )
      throw new Error('Maintained turn effect has an invalid Encounter source.')
    if (
      state.ownerActorId !== origin.sourceActorId ||
      ![
        provenance.sourceOccurrenceId,
        encounterAreaTargetOccurrenceId(provenance.sourceOccurrenceId, actor.id)
      ].includes(origin.sourceOccurrenceId)
    )
      throw new Error('Maintained turn effect source binding is stale.')
    states.set(stateId, state)
  }
  return states
}

/**
 * What the damage a turn effect deals ends on its holder (SPELLS-27.T4b): the holder's other
 * effects that end on damage, with the conditions only they held. A later effect of the same turn
 * ends too (it expires when its own execution comes); `excluded` holds the effects already settled.
 */
export function turnEffectDamageEnded(input: {
  effect: ActiveRuleEffectRecord
  holderActorId: string
  held: readonly ActiveRuleEffectRecord[]
  /** The turn's executed candidates and the effects its earlier executions ended. */
  excluded: ReadonlySet<string>
  /** The turn effect's own d20 evidence: a repeat save spends the holder's dice (D156). */
  testEvidence: Parameters<typeof targetEndedEffects>[0]['testEvidence']
  applications: readonly CharacterRuleActionApplication[]
  dispositions: ReadonlyMap<string, EncounterActorDispositionDto>
}) {
  const { origin } = input.effect.definition
  return targetEndedEffects({
    holderActorId: input.holderActorId,
    held: input.held.filter(({ id }) => !input.excluded.has(id)),
    attack: null,
    testEvidence: input.testEvidence,
    turnActorId: null,
    applications: input.applications,
    damagerActorId: origin.kind === 'ENCOUNTER' ? origin.sourceActorId : null,
    dispositions: input.dispositions
  })
}
