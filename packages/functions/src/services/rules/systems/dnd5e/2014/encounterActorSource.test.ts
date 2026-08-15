import { describe, expect, it } from 'vitest'

import { ENCOUNTER_ACTOR_MODEL_KEY } from '@artificer-toolkit/schema/api/encounterActorRules'
import { rulePackDocumentDtoSchema } from '@artificer-toolkit/schema/api/rules'

import { evaluateZenRuleModel } from '../../../zenRuleEngine.js'
import { getRuleModelContract } from '../../../ruleModelContracts.js'
import {
  dnd5e2014EncounterActorFixture,
  dnd5e2014EncounterActorModel
} from './encounterActorSource.js'

describe('dnd5e/2014 Encounter actor policy', () => {
  it('registers the reserved input and output contract', () => {
    const contract = getRuleModelContract(ENCOUNTER_ACTOR_MODEL_KEY)
    expect(contract?.input.parse(dnd5e2014EncounterActorFixture.input)).toEqual(
      dnd5e2014EncounterActorFixture.input
    )
    expect(contract?.output.parse(dnd5e2014EncounterActorFixture.expected)).toEqual(
      dnd5e2014EncounterActorFixture.expected
    )
  })

  it('resolves initiative and supported feature charges in one native evaluation', async () => {
    const document = rulePackDocumentDtoSchema.parse({
      schemaVersion: 1,
      models: { [ENCOUNTER_ACTOR_MODEL_KEY]: dnd5e2014EncounterActorModel },
      fixtures: [dnd5e2014EncounterActorFixture]
    })
    const result = await evaluateZenRuleModel({
      document,
      modelKey: ENCOUNTER_ACTOR_MODEL_KEY,
      context: dnd5e2014EncounterActorFixture.input
    })

    expect(result.result).toEqual(dnd5e2014EncounterActorFixture.expected)
  })

  it('preserves raw over-cap usage and rejects unsupported charge shapes', async () => {
    const document = rulePackDocumentDtoSchema.parse({
      schemaVersion: 1,
      models: { [ENCOUNTER_ACTOR_MODEL_KEY]: dnd5e2014EncounterActorModel },
      fixtures: []
    })
    const result = await evaluateZenRuleModel({
      document,
      modelKey: ENCOUNTER_ACTOR_MODEL_KEY,
      context: {
        contractVersion: 1,
        actors: [
          {
            actorId: '00000000-0000-4000-8000-000000000001',
            abilityScores: {},
            featureResources: [
              {
                featureId: 'fixed',
                charge: {
                  id: 'fixed-charge',
                  resetKind: 'LONG_REST',
                  limitKind: 'FIXED_AMOUNT',
                  scalingKind: 'NONE',
                  amount: 2
                },
                used: 4
              },
              {
                featureId: 'source',
                charge: {
                  id: 'source-charge',
                  limitKind: 'SOURCE_CHARGES',
                  scalingKind: 'NONE',
                  cost: 1
                },
                used: 0
              }
            ]
          }
        ]
      }
    })

    expect(result.result).toEqual({
      actors: [
        {
          actorId: '00000000-0000-4000-8000-000000000001',
          initiativeModifier: 0,
          featureResources: [
            {
              featureId: 'fixed',
              maximum: 2,
              rawUsed: 4,
              used: 2,
              remaining: 0,
              resetKind: 'LONG_REST'
            },
            {
              featureId: 'source',
              maximum: null,
              rawUsed: 0,
              used: 0,
              remaining: null,
              resetKind: null
            }
          ]
        }
      ]
    })
  })
})
