import type { EncounterRunActorState } from '@artificer-toolkit/schema/projections/encounterRunState'
import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import type {
  ActiveEffectEndEvent,
  GrantConsumeEvent
} from '@artificer-toolkit/schema/shared/activeRuleEffects'
import type { ConcentrationEndReason } from '@artificer-toolkit/schema/shared/ruleExecutionEncounterApplications'
import {
  isEffectLiveInEncounter,
  turnEffectOwner,
  type TurnEffectBoundary
} from './encounterTurnEffectState.js'

type GrantHolder = {
  actor: Pick<EncounterRunActorState, 'id' | 'kind' | 'sourceId'>
  effects: readonly ActiveRuleEffectRecord[]
}

export type EncounterGrantTick = {
  effect: ActiveRuleEffectRecord
  owner: ReturnType<typeof turnEffectOwner>
} & ({ kind: 'UPDATE'; remainingTicks: number } | { kind: 'EXPIRE' })

function isModifierGrant(effect: ActiveRuleEffectRecord) {
  return (
    effect.definition.schemaVersion === 2 &&
    effect.definition.stateContributions.some(({ kind }) => kind === 'MODIFIER_GRANT')
  )
}

/** Grants the first occurrence of the event, by their holder, uses up. */
export function consumableGrants(
  effects: readonly ActiveRuleEffectRecord[],
  event: GrantConsumeEvent
) {
  return effects.filter(
    (effect) =>
      isModifierGrant(effect) && effect.definition.recurrence.consumeOnFirstEvents.includes(event)
  )
}

/** Grants that end the moment their holder undergoes the event. */
export function grantsEndedBy(
  effects: readonly ActiveRuleEffectRecord[],
  event: ActiveEffectEndEvent
) {
  return effects.filter(
    (effect) => isModifierGrant(effect) && effect.definition.recurrence.endOnEvents.includes(event)
  )
}

/** Grants whose lifetime follows their holder's state: they end on incapacitation or on a named condition. */
export function stateBoundGrants<Effect extends ActiveRuleEffectRecord>(
  effects: readonly Effect[]
) {
  return effects.filter(
    (effect) =>
      isModifierGrant(effect) &&
      (effect.definition.recurrence.endOnEvents.includes('ON_INCAPACITATED') ||
        effect.definition.recurrence.endOnConditionIds.length > 0)
  )
}

/**
 * The holder's grants its state ends (D95): those that end on incapacitation when it is
 * incapacitated or defeated, and those that name a condition it has, whatever else is true of them.
 */
export function grantsEndedByHolderState<Effect extends ActiveRuleEffectRecord>(
  effects: readonly Effect[],
  state: {
    reason: Exclude<ConcentrationEndReason, 'CHOSEN'> | null
    conditionIds: readonly string[]
  }
) {
  const incapacitated = state.reason === 'INCAPACITATED' || state.reason === 'DEFEATED'
  return stateBoundGrants(effects).filter(({ definition }) => {
    const { endOnEvents, endOnConditionIds } = definition.recurrence
    return (
      (incapacitated && endOnEvents.includes('ON_INCAPACITATED')) ||
      endOnConditionIds.some((conditionId) => state.conditionIds.includes(conditionId))
    )
  })
}

/** The actor whose turns count a timed grant down: its holder, or the Encounter actor that applied it. */
function grantAnchorActorId(
  effect: ActiveRuleEffectRecord,
  holderActorId: string,
  encounterId: string
) {
  const { expiration } = effect.definition.recurrence
  if (expiration.kind !== 'TICKS') return null
  if (expiration.anchor !== 'SOURCE') return holderActorId
  const { origin } = effect.definition
  return origin.kind === 'ENCOUNTER' && origin.sourceAggregateId === encounterId
    ? origin.sourceActorId
    : null
}

/**
 * Timed grants anchored to an actor that left the Run can no longer count down, so they end with
 * it. Holder-anchored grants keep their own lifetime.
 */
export function planDepartedSourceGrantRemovals<Effect extends ActiveRuleEffectRecord>(input: {
  encounterId: string
  departedActorId: string
  holders: readonly { actor: GrantHolder['actor']; effects: readonly Effect[] }[]
}): Effect[] {
  return input.holders.flatMap(({ actor, effects }) =>
    effects.filter(
      (effect) =>
        isModifierGrant(effect) &&
        effect.definition.recurrence.expiration.kind === 'TICKS' &&
        effect.definition.recurrence.expiration.anchor === 'SOURCE' &&
        grantAnchorActorId(effect, actor.id, input.encounterId) === input.departedActorId
    )
  )
}

/**
 * Grants count down at the boundary of their anchor actor's turn rather than through the
 * turn-effect kernel (they store no recurrence stage), so the kernel never owns them.
 */
export function planEncounterGrantTicks(input: {
  encounterId: string
  stage: TurnEffectBoundary['stage']
  turnActorId: string
  holders: readonly GrantHolder[]
}): EncounterGrantTick[] {
  const ticks: EncounterGrantTick[] = []
  for (const { actor, effects } of input.holders) {
    for (const effect of effects) {
      const { recurrence } = effect.definition
      const expiration = recurrence.expiration
      const remaining = effect.lifecycle.remainingTicks
      if (
        remaining === null ||
        !isModifierGrant(effect) ||
        recurrence.recurrenceStage !== 'NONE' ||
        expiration.kind !== 'TICKS' ||
        expiration.decrementStage !== input.stage ||
        !isEffectLiveInEncounter(effect, actor, input.encounterId)
      )
        continue
      if (grantAnchorActorId(effect, actor.id, input.encounterId) !== input.turnActorId) continue
      const owner = turnEffectOwner(actor, input.encounterId)
      ticks.push(
        remaining <= 1
          ? { kind: 'EXPIRE', effect, owner }
          : { kind: 'UPDATE', effect, owner, remainingTicks: remaining - 1 }
      )
    }
  }
  return ticks.sort(
    (left, right) =>
      left.effect.createdOrdinal - right.effect.createdOrdinal ||
      left.effect.id.localeCompare(right.effect.id)
  )
}

/**
 * D99: a completed Run hands its Characters' timed grants to the Campaign clock, 6 seconds per
 * remaining round rounded up to whole minutes from the clock's minute at completion. Without a
 * clock they stop counting and last until the GM ends them. A detached Concentration grant keeps its
 * caster stamp.
 */
export function planCarriedOverGrants(input: {
  effects: readonly ActiveRuleEffectRecord[]
  clockMinute: number | null
}) {
  return input.effects.flatMap((effect) => {
    const remaining = effect.lifecycle.remainingTicks
    if (
      remaining === null ||
      !isModifierGrant(effect) ||
      effect.definition.recurrence.expiration.kind !== 'TICKS'
    )
      return []
    const { concentrationCasterCharacterId } = effect.lifecycle
    const lifecycle: ActiveRuleEffectRecord['lifecycle'] = {
      schemaVersion: 1,
      remainingTicks: null,
      ...(concentrationCasterCharacterId === undefined ? {} : { concentrationCasterCharacterId }),
      expiresAtCampaignMinute:
        input.clockMinute === null ? null : input.clockMinute + Math.ceil(remaining / 10)
    }
    return [{ effect, lifecycle }]
  })
}

/**
 * D99: a Character caster who starts another Concentration ends the carried-over Concentration
 * grants stamped with them. A grant with no stamp (a Creature caster) is never ended this way.
 */
export function planConcentrationCarriedGrantEnds<Effect extends ActiveRuleEffectRecord>(input: {
  casterCharacterId: string
  effects: readonly Effect[]
}) {
  return input.effects.filter(
    ({ owner, lifecycle }) =>
      owner.kind === 'CHARACTER' &&
      lifecycle.concentrationCasterCharacterId === input.casterCharacterId
  )
}

/** Carried-over grants whose Campaign-clock expiry the clock has reached. */
export function expiredCarriedOverGrants<Effect extends ActiveRuleEffectRecord>(
  effects: readonly Effect[],
  clockMinute: number
) {
  return effects.filter(({ lifecycle }) => {
    const expiry = lifecycle.expiresAtCampaignMinute
    return typeof expiry === 'number' && expiry <= clockMinute
  })
}
