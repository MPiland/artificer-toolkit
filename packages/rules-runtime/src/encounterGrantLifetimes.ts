import type { EncounterRunActorState } from '@artificer-toolkit/schema/projections/encounterRunState'
import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
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

/** Grants the next attack roll of their holder uses up. */
export function attackRollConsumableGrants(effects: readonly ActiveRuleEffectRecord[]) {
  return effects.filter(
    (effect) =>
      isModifierGrant(effect) &&
      effect.definition.recurrence.consumeOnFirstEvent === 'ON_ATTACK_ROLL'
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
      const { recurrence, origin } = effect.definition
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
      const anchorId =
        expiration.anchor === 'SOURCE'
          ? origin.kind === 'ENCOUNTER' && origin.sourceAggregateId === input.encounterId
            ? origin.sourceActorId
            : null
          : actor.id
      if (anchorId !== input.turnActorId) continue
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
