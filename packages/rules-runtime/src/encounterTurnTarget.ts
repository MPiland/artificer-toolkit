import type {
  EncounterRunActorState,
  EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'

import type { ProjectableCharacterFacts } from './encounterActionProjection.js'
import { applyEncounterConditionMechanics } from './encounterConditionMechanics.js'
import { buildMovementTarget, type MovementTarget } from './encounterMovementTargets.js'

/**
 * The turn's target as the next stage observes it: `actor` and `characterFacts` carry what earlier
 * stages staged, `activeEffects` the effects still in force, and `source` the facts that do not change.
 */
export function rebuildEncounterTurnTarget<
  TCharacterFacts extends ProjectableCharacterFacts
>(input: {
  source: MovementTarget<TCharacterFacts>
  actor: EncounterRunActorState
  characterFacts: TCharacterFacts | null
  activeEffects: ActiveRuleEffectRecord[]
  state: Pick<EncounterRunState, 'campaignId' | 'gameSystemId'>
}): MovementTarget<TCharacterFacts> {
  return applyEncounterConditionMechanics({
    target: {
      ...buildMovementTarget({
        actor: input.actor,
        activeEffects: input.activeEffects,
        characterFacts: input.characterFacts,
        campaignId: input.state.campaignId,
        gameSystemId: input.state.gameSystemId,
        includeReactionSources: input.source.characterReactionSource !== undefined
      }),
      conditionDefinitions: input.source.conditionDefinitions
    },
    gameSystemId: input.state.gameSystemId
  })
}
