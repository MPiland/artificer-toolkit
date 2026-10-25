import { describe, expect, it } from 'vitest'
import {
  encounterActorRuleInputSchema,
  encounterActorRuleOutputSchema
} from '@artificer-toolkit/schema/api/encounterActorRules'

import {
  bindEncounterActorRuleOutputToFacts,
  reconcileEncounterActorRuleOutput
} from '../encounterActorRuleOutput.js'

const ACTOR_ID = '00000000-0000-4000-8000-0000000aa001'
const FIRST_ABILITY = '00000000-0000-4000-8000-0000000aa101'
const SECOND_ABILITY = '00000000-0000-4000-8000-0000000aa102'
const protection = { status: 'NOT_NORMALIZED' } as const

const facts = encounterActorRuleInputSchema.parse({
  contractVersion: 1,
  actors: [
    {
      actorId: ACTOR_ID,
      abilityScores: { [FIRST_ABILITY]: 2, [SECOND_ABILITY]: 1 },
      checkTotals: {},
      saveProficiencyBonuses: {},
      targetProtection: protection,
      featureResources: []
    }
  ]
})

function output(savingThrowAbilityIds?: readonly string[]) {
  return encounterActorRuleOutputSchema.parse({
    actors: [
      {
        actorId: ACTOR_ID,
        initiativeModifier: 2,
        ...(savingThrowAbilityIds && {
          savingThrowDefinitions: savingThrowAbilityIds.map((abilityDefinitionId) => ({
            abilityDefinitionId,
            modifier: 0,
            rollMode: 'NORMAL',
            contributors: []
          }))
        }),
        targetProtection: protection,
        featureResources: []
      }
    ]
  })
}

describe('reconcileEncounterActorRuleOutput saving throws', () => {
  it('accepts a System that has no saving throws and reports none', () => {
    const reconciled = reconcileEncounterActorRuleOutput(output(), facts)
    expect(reconciled.actors[0]?.savingThrowDefinitions).toBeUndefined()
    expect(
      bindEncounterActorRuleOutputToFacts(reconciled, facts).actors[0]?.savingThrowDefinitions
    ).toBeUndefined()
  })

  it('still refuses a System whose saves miss one of the actor ability scores', () => {
    expect(() => reconcileEncounterActorRuleOutput(output([FIRST_ABILITY]), facts)).toThrow(
      'saving throws do not match input facts'
    )
  })
})
