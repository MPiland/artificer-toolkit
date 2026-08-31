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
import { buildCharacterSenseRuleFacts } from '../../../../character/characterSenseRuleFacts.js'
import { compileCharacterGrantFoldRuleFacts } from '../../../../character/characterGrantFoldRuleFacts.js'
import { dnd5e2014CharacterPolicyDocument } from './characterPolicy.js'
import { evaluateZenRuleModel } from '../../../zenRuleEngine.js'

const DARKVISION_ID = '00000000-0000-4000-8000-000000000010'
const BLINDSIGHT_ID = '00000000-0000-4000-8000-000000000011'

const registry = {
  classes: {},
  equipment: {},
  feats: {},
  spells: {},
  skills: {},
  races: {},
  features: {
    sight: {
      senses: [
        {
          id: 'darkvision-30',
          grantKind: 'SENSE_GRANT',
          selectionKind: 'GRANTED',
          authoringModeKind: 'SELECTED',
          senseIds: [DARKVISION_ID],
          scalingKind: 'NONE',
          range: { id: 'darkvision-30', rangeKind: 'DISTANCE', amount: 30, unit: 'METERS' },
          order: 0
        },
        {
          id: 'darkvision-60',
          grantKind: 'SENSE_GRANT',
          selectionKind: 'GRANTED',
          authoringModeKind: 'SELECTED',
          senseIds: [DARKVISION_ID],
          scalingKind: 'NONE',
          range: { id: 'darkvision-60', rangeKind: 'DISTANCE', amount: 60, unit: 'FEET' },
          order: 1
        },
        {
          id: 'darkvision-60-tie',
          grantKind: 'SENSE_GRANT',
          selectionKind: 'GRANTED',
          authoringModeKind: 'SELECTED',
          senseIds: [DARKVISION_ID],
          scalingKind: 'NONE',
          range: { id: 'darkvision-60-tie', rangeKind: 'DISTANCE', amount: 60, unit: 'FEET' },
          order: 2
        },
        {
          id: 'blindsight',
          grantKind: 'SENSE_GRANT',
          selectionKind: 'GRANTED',
          authoringModeKind: 'SELECTED',
          senseIds: [BLINDSIGHT_ID],
          scalingKind: 'NONE',
          range: { id: 'blindsight-self', rangeKind: 'SELF' },
          order: 3
        }
      ],
      modifiers: [
        {
          id: 'darkvision-bonus',
          grantKind: 'MODIFIER_GRANT',
          valueDomainCode: 'SENSE_RANGE',
          modifierKind: 'BONUS',
          domain: { senseDefinitionId: DARKVISION_ID },
          scope: 'GLOBAL',
          payload: { amount: 30 },
          selectionKind: 'GRANTED',
          order: 4
        }
      ]
    }
  }
} as unknown as CharacterAssemblyRegistry
const snapshot = (
  adjustments: CharacterBuildSnapshot['adjustments'] = []
): CharacterBuildSnapshot => ({
  characterId: 'character',
  systemId: 'dnd5e2014',
  totalLevel: 1,
  classes: [],
  abilities: {},
  hitpoints: [],
  equipmentItems: [],
  features: [
    {
      featureId: 'sight',
      source: { kind: 'FEATURE', featureId: 'sight' },
      timing: { kind: 'IMMEDIATE' }
    }
  ],
  adjustments
})

async function evaluate(value: CharacterBuildSnapshot) {
  const input = characterRulePolicyInputSchema.parse({
    contractVersion: 4,
    grantFoldFacts: compileCharacterGrantFoldRuleFacts({
      snapshot: value,
      registry
    }),
    totalLevel: 1,
    derivedBaseFacts: buildCharacterDerivedRuleFacts(value, registry),
    ...buildCharacterSenseRuleFacts(value),
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
  return characterRulePolicyOutputSchema.parse(result.result).senses
}

describe('D&D 5e 2014 Character sense policy', () => {
  it('matches legacy range maxima, tie identity, alias modifier, non-distance, and override suppression', async () => {
    const baseline = snapshot()
    await expect(evaluate(baseline)).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          senseDefinitionId: DARKVISION_ID,
          range: expect.objectContaining({ id: 'darkvision-60', amount: 90, unit: 'FEET' })
        }),
        expect.objectContaining({ senseDefinitionId: BLINDSIGHT_ID, range: null })
      ])
    )
    const overridden = snapshot([
      {
        id: 'override',
        family: 'SENSE',
        senseId: DARKVISION_ID,
        field: 'RANGE_OVERRIDE',
        value: 120
      }
    ])
    await expect(evaluate(overridden)).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          senseDefinitionId: DARKVISION_ID,
          range: expect.objectContaining({
            amount: 120,
            calculation: expect.objectContaining({
              contributions: [expect.objectContaining({ value: 30, state: 'SUPPRESSED' })]
            })
          })
        })
      ])
    )
    await expect(
      evaluate(
        snapshot([
          {
            id: 'unseen-override',
            family: 'SENSE',
            senseId: '00000000-0000-4000-8000-000000000012',
            field: 'RANGE_OVERRIDE',
            value: 15
          }
        ])
      )
    ).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          senseDefinitionId: '00000000-0000-4000-8000-000000000012',
          range: expect.objectContaining({ amount: 15, unit: 'FEET' })
        })
      ])
    )
  })
})
