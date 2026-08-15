import { describe, expect, it } from 'vitest'

import {
  characterRulePolicyInputSchema,
  characterRulePolicyOutputSchema
} from '@artificer-toolkit/schema/api/characterRules'
import {
  type CharacterAssemblyRegistry,
  type CharacterBuildSnapshot
} from '@artificer-toolkit/shared/core'
import { buildCharacterDerivedRuleFacts } from '../../../../character/characterDerivedRuleFacts.js'
import { buildCharacterMovementRuleFacts } from '../../../../character/characterMovementRuleFacts.js'
import { compileCharacterGrantFoldRuleFacts } from '../../../../character/characterGrantFoldRuleFacts.js'
import { dnd5e2014CharacterPolicyDocument } from './characterPolicy.js'
import { evaluateZenRuleModel } from '../../../zenRuleEngine.js'

const registry = {
  classes: {},
  equipment: {},
  feats: {},
  spells: {},
  features: {
    speed: {
      modifiers: [
        {
          id: 'walk-bonus',
          grantKind: 'MODIFIER_GRANT',
          valueDomainCode: 'SPEED',
          modifierKind: 'BONUS',
          domain: { speedId: 'walk-id' },
          scope: 'GLOBAL',
          payload: { amount: 10 },
          selectionKind: 'GRANTED',
          order: 0
        },
        {
          id: 'walk-penalty',
          grantKind: 'MODIFIER_GRANT',
          valueDomainCode: 'SPEED',
          modifierKind: 'PENALTY',
          domain: { speedId: 'walk-id' },
          scope: 'GLOBAL',
          payload: { amount: -5 },
          selectionKind: 'GRANTED',
          order: 1
        },
        {
          id: 'walk-set',
          grantKind: 'MODIFIER_GRANT',
          valueDomainCode: 'SPEED',
          modifierKind: 'SET_VALUE',
          domain: { speedId: 'walk-id' },
          scope: 'GLOBAL',
          payload: { amount: 5 },
          selectionKind: 'GRANTED',
          order: 2
        }
      ]
    }
  },
  races: {
    race: {
      speeds: [
        { speedId: 'walk-id', amount: 30, unit: 'FEET' },
        { speedId: 'fly-id', amount: 20, unit: 'FEET' }
      ]
    }
  },
  skills: {},
  system: {
    speeds: [
      { id: 'walk-id', code: 'WALK' },
      { id: 'fly-id', code: 'FLY' }
    ]
  }
} as unknown as CharacterAssemblyRegistry
const snapshot = (
  preference: CharacterBuildSnapshot['movementDisplayPreference']
): CharacterBuildSnapshot => ({
  characterId: 'character',
  systemId: 'dnd5e2014',
  totalLevel: 1,
  classes: [],
  abilities: {},
  hitpoints: [],
  equipmentItems: [],
  raceId: 'race',
  movementDisplayPreference: preference,
  features: [
    {
      featureId: 'speed',
      source: { kind: 'FEATURE', featureId: 'speed' },
      timing: { kind: 'IMMEDIATE' }
    }
  ],
  adjustments: [
    { id: 'fly-override', family: 'MOVEMENT', speedId: 'fly-id', field: 'SPEED_OVERRIDE', value: 0 }
  ]
})

async function evaluate(value: CharacterBuildSnapshot) {
  const input = characterRulePolicyInputSchema.parse({
    contractVersion: 4,
    grantFoldFacts: compileCharacterGrantFoldRuleFacts({
      snapshot: value,
      registry
    }),
    totalLevel: value.totalLevel,
    derivedBaseFacts: buildCharacterDerivedRuleFacts(value, registry),
    ...buildCharacterMovementRuleFacts(value, registry),
    spellAccessCandidates: [],
    spellClasses: [],
    spellPreparationClasses: [],
    spellPreparationCatalog: [],
    spellPreparationRequest: null,
    spellCastCandidates: [],
    spellCastSlots: [],
    spellCastResources: [],
    spellcastingClasses: [],
    chargeCalculations: [],
    eligibilityFacets: [],
    rest: { totalHitDice: 0, currentExhaustion: 0, attunementSlotOverride: null }
  })
  const result = await evaluateZenRuleModel({
    document: dnd5e2014CharacterPolicyDocument,
    modelKey: 'character-policy',
    context: input
  })
  return characterRulePolicyOutputSchema.parse(result.result).movement
}

describe('D&D 5e 2014 Character movement policy', () => {
  it('selects AUTO WALK and falls back from an invalid explicit preference', async () => {
    await expect(
      evaluate(snapshot({ mode: 'EXPLICIT', speedId: 'missing' }))
    ).resolves.toMatchObject({ primaryMovementSpeedId: 'walk-id' })
    await expect(
      evaluate(snapshot({ mode: 'EXPLICIT', speedId: 'fly-id' }))
    ).resolves.toMatchObject({
      primaryMovementSpeedId: 'fly-id',
      speeds: expect.arrayContaining([expect.objectContaining({ speedId: 'fly-id', amount: 0 })])
    })
    await expect(evaluate(snapshot({ mode: 'AUTO' }))).resolves.toMatchObject({
      speeds: expect.arrayContaining([
        expect.objectContaining({
          speedId: 'walk-id',
          amount: 35,
          calculation: expect.objectContaining({
            contributions: [
              expect.objectContaining({ value: 10, state: 'APPLIED' }),
              expect.objectContaining({ value: -5, state: 'APPLIED' })
            ]
          })
        })
      ])
    })
  })
})
