import { describe, expect, it } from 'vitest'

import {
  encounterActorRuleInputSchema,
  encounterActorRuleOutputSchema
} from '../api/encounterActorRules.js'

const actorId = '00000000-0000-4000-8000-000000000001'

describe('Encounter actor rule contracts', () => {
  it('accepts raw actor facts and resolved resource state', () => {
    const input = encounterActorRuleInputSchema.parse({
      contractVersion: 1,
      actors: [
        {
          actorId,
          abilityScores: { DEXTERITY: 14, CHARISMA: 18 },
          featureResources: [
            {
              featureId: 'legendary-resistance',
              charge: {
                id: 'legendary-resistance-charges',
                resetKind: 'DAILY',
                limitKind: 'FIXED_AMOUNT',
                scalingKind: 'NONE',
                amount: 3
              },
              used: 1
            }
          ]
        }
      ]
    })

    expect(input.actors[0]?.abilityScores.DEXTERITY).toBe(14)
    expect(
      encounterActorRuleOutputSchema.parse({
        actors: [
          {
            actorId,
            initiativeModifier: 2,
            featureResources: [
              {
                featureId: 'legendary-resistance',
                maximum: 3,
                rawUsed: 1,
                used: 1,
                remaining: 2,
                resetKind: 'DAILY'
              }
            ]
          }
        ]
      })
    ).toMatchObject({ actors: [{ initiativeModifier: 2 }] })
  })

  it('rejects ambiguous actor and feature identities', () => {
    const actor = {
      actorId,
      abilityScores: {},
      featureResources: [
        { featureId: 'feature-1', charge: null, used: 0 },
        { featureId: 'feature-1', charge: null, used: 0 }
      ]
    }
    expect(() =>
      encounterActorRuleInputSchema.parse({ contractVersion: 1, actors: [actor] })
    ).toThrow(/duplicated/)
    expect(() =>
      encounterActorRuleInputSchema.parse({
        contractVersion: 1,
        actors: [
          { ...actor, featureResources: [] },
          { ...actor, featureResources: [] }
        ]
      })
    ).toThrow(/duplicated/)
  })
})
