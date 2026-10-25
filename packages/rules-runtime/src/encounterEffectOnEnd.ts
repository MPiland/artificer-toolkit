import { v5 as uuidv5 } from 'uuid'

import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import {
  activeRuleEffectDefinitionDtoSchema,
  type ActiveRuleEffectDefinitionDto
} from '@artificer-toolkit/schema/shared/activeRuleEffects'

const ON_END_GRANT_NAMESPACE = '8e2b4c1a-6d7f-4a39-b0c5-1f9a3d7e5b62'

type ModifierGrantContribution = Extract<
  ActiveRuleEffectDefinitionDto['stateContributions'][number],
  { kind: 'MODIFIER_GRANT' }
>

/** The one id of the grant an ended effect leaves behind, so an undo can find and remove it. */
export function onEndGrantEffectId(endedEffectId: string) {
  return uuidv5(endedEffectId, ON_END_GRANT_NAMESPACE)
}

/**
 * The grant a holder keeps when an effect that authors `onEnd` ends (Haste's lethargy): its frozen
 * modifiers, held under the ended effect's origin and counted in the holder's own turns. Null when
 * the effect leaves nothing behind. The effect store creates it at the one place an effect is removed.
 */
export function onEndGrantEffect(
  ended: Pick<ActiveRuleEffectRecord, 'id' | 'owner' | 'definition'>
) {
  const { definition } = ended
  if (definition.origin.kind !== 'ENCOUNTER') return null
  const template = definition.stateContributions.find(
    (contribution): contribution is ModifierGrantContribution =>
      contribution.kind === 'MODIFIER_GRANT'
  )
  if (!template?.onEnd) return null
  const {
    onEnd,
    grantedActions: _grantedActions,
    effectOffers: _effectOffers,
    endOnEvents: _endOnEvents,
    ...grant
  } = template
  return {
    id: onEndGrantEffectId(ended.id),
    owner: ended.owner,
    definition: activeRuleEffectDefinitionDtoSchema.parse({
      schemaVersion: 2,
      linkedEffectId: null,
      originLevel: null,
      origin: definition.origin,
      authoredEffectId: definition.authoredEffectId,
      compiledEntryId: definition.compiledEntryId,
      frozenGraphNodeId: definition.frozenGraphNodeId,
      frozenGraph: definition.frozenGraph,
      adapterFacts: {},
      perceptionContributions: [],
      recurrence: {
        recurrenceStage: 'NONE',
        anchor: 'HOLDER',
        consumeOnFirstEvents: [],
        endOnEvents: [],
        endOnTriggers: [],
        endOnConditionIds: [],
        holderEnd: null,
        // Held for the Run it ends in: a Character's does not outlast it.
        lifetimeScope: 'ENCOUNTER',
        expiration: {
          kind: 'TICKS',
          initialRemaining: onEnd.turns,
          decrementStage: 'END_OF_TURN'
        }
      },
      stateContributions: [{ ...grant, modifiers: onEnd.modifiers, senses: [] }]
    }),
    lifecycle: { schemaVersion: 1 as const, remainingTicks: onEnd.turns }
  }
}
