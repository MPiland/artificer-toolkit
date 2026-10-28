import type {
  EncounterRunActorState,
  EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'

import type { ProjectableCharacterFacts } from './encounterActionProjection.js'
import { applyEncounterConditionMechanics } from './encounterConditionMechanics.js'
import { withHolderDefenseGrants } from './encounterHolderDefense.js'
import { buildMovementTarget, type MovementTarget } from './encounterMovementTargets.js'
import {
  withOccupantConditionImmunities,
  withOccupantSaveBonusRows
} from './encounterOccupantAuras.js'

/**
 * The turn's target as the next stage observes it: `actor` and `characterFacts` carry what earlier
 * stages staged, `activeEffects` the effects still in force, and `source` the facts that do not change,
 * including the holder state its defensive grants (Dodge) apply with and the occupant auras it was
 * prepared with (D155).
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
  const conditioned = applyEncounterConditionMechanics({
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
  const rebuilt = input.source.holderState
    ? withHolderDefenseGrants(input.state.gameSystemId, conditioned, input.source.holderState)
    : conditioned
  const { occupantSaveBonus, occupantConditionImmunityIds } = input.source
  const saved =
    occupantSaveBonus === undefined
      ? rebuilt
      : withOccupantSaveBonusRows(rebuilt, occupantSaveBonus)
  return occupantConditionImmunityIds === undefined
    ? saved
    : withOccupantConditionImmunities(saved, occupantConditionImmunityIds)
}
