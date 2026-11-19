import { describe, expect, it } from 'vitest'

import { createReactionChoiceDefinition } from '../reactionChoiceDefinition.js'
import { DND5E_SYSTEM_ID } from '../systems/dnd5e/identity.js'
import {
  createDnd5eMovementReactionEligibilityDefinition,
  DND5E_MOVEMENT_REACTION_CHOICE_DEFINITION_ID,
  DND5E_OPPORTUNITY_REACTION_ELIGIBILITY_DEFINITION_ID
} from '../systems/dnd5e/reactionEligibilityPolicy.js'
import { srdDefinitions } from '../testing/dnd5eSrdEncounter.js'
import {
  srdMovementReactionChoiceDefinition,
  srdOpportunityReactionEligibilityDefinition
} from '../testing/srdMovementReactionPolicy.js'

describe('SRD movement reaction graphs', () => {
  it('publishes the leave-reach eligibility graph the D&D System module builds', () => {
    expect(srdOpportunityReactionEligibilityDefinition()).toEqual(
      createDnd5eMovementReactionEligibilityDefinition({
        definitionId: DND5E_OPPORTUNITY_REACTION_ELIGIBILITY_DEFINITION_ID,
        stage: 'BEFORE_LEAVE_REACH'
      })
    )
  })

  it('publishes the reaction choice graph the eligibility graph names', () => {
    expect(srdMovementReactionChoiceDefinition()).toEqual(
      createReactionChoiceDefinition({
        definitionId: DND5E_MOVEMENT_REACTION_CHOICE_DEFINITION_ID,
        gameSystemId: DND5E_SYSTEM_ID
      })
    )
    expect(
      srdOpportunityReactionEligibilityDefinition().definition.outputs.choiceDefinitionId
    ).toEqual({ kind: 'LITERAL', value: DND5E_MOVEMENT_REACTION_CHOICE_DEFINITION_ID })
  })

  it('serves both graphs as current SRD reusable definitions', async () => {
    for (const definitionId of [
      DND5E_OPPORTUNITY_REACTION_ELIGIBILITY_DEFINITION_ID,
      DND5E_MOVEMENT_REACTION_CHOICE_DEFINITION_ID
    ]) {
      const current = await srdDefinitions.requireCurrent(definitionId)
      expect(current).toMatchObject({
        id: definitionId,
        definitionFamilyKey: 'rules-runtime-graph'
      })
    }
  })
})
