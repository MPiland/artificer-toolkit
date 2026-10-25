import { v5 as uuidv5 } from 'uuid'

import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import { activeRuleEffectDefinitionDtoSchema } from '@artificer-toolkit/schema/shared/activeRuleEffects'

const TURN_END_GATE_NAMESPACE = '3f6a9c42-1d8e-4b75-a2c0-7e5b1d94f836'

/**
 * The effect a passed turn-end gate gives its holder (Blink's absence): authored with the gate,
 * linked to the effect that rolled it so it ends with it, and ending at the holder's next turn start.
 * Null when the effect authors no gate. One id per gating effect: the prior child is gone by the
 * next turn end.
 */
export function turnEndGateChildEffect(
  gating: Pick<ActiveRuleEffectRecord, 'id' | 'owner' | 'definition'>
) {
  const { definition } = gating
  const gate = definition.recurrence.turnEndGate
  if (!gate) return null
  return {
    id: uuidv5(gating.id, TURN_END_GATE_NAMESPACE),
    owner: gating.owner,
    definition: activeRuleEffectDefinitionDtoSchema.parse({
      schemaVersion: 2,
      linkedEffectId: gating.id,
      originLevel: definition.originLevel,
      origin: definition.origin,
      authoredEffectId: definition.authoredEffectId,
      compiledEntryId: definition.compiledEntryId,
      frozenGraphNodeId: gate.child.frozenGraphNodeId,
      frozenGraph: gate.child.frozenGraph,
      adapterFacts: {},
      perceptionContributions: [],
      recurrence: {
        recurrenceStage: 'START_OF_TURN',
        anchor: 'HOLDER',
        consumeOnFirstEvents: [],
        endOnEvents: [],
        endOnTriggers: [],
        endOnConditionIds: [],
        holderEnd: null,
        lifetimeScope: definition.recurrence.lifetimeScope,
        expiration: {
          kind: 'TICKS',
          initialRemaining: 1,
          decrementStage: 'START_OF_TURN'
        }
      },
      stateContributions: [gate.child.playAbsence]
    }),
    lifecycle: { schemaVersion: 1 as const, remainingTicks: 1 }
  }
}
