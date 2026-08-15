import { describe, expect, it } from 'vitest'

import {
  characterRulePolicyInputSchema,
  characterRulePolicyOutputSchema
} from '@artificer-toolkit/schema/api/characterRules'
import {
  CLASS_CATEGORY,
  type CharacterAssemblyRegistry,
  type CharacterBuildSnapshot
} from '@artificer-toolkit/shared/core'
import type { CompiledClass } from '@artificer-toolkit/shared/subjects/compilers'

import { buildCharacterDerivedRuleFacts } from '../../../../character/characterDerivedRuleFacts.js'
import { buildCharacterSpellMechanicsRuleFacts } from '../../../../character/characterSpellMechanicsRuleFacts.js'
import { dnd5e2014CharacterPolicyDocument } from './characterPolicy.js'
import { dnd5e2014CharacterGrantFoldEmptyInput } from './characterGrantFoldSource.js'
import { evaluateZenRuleModel } from '../../../zenRuleEngine.js'

const wizard: CompiledClass = {
  id: 'wizard',
  category: CLASS_CATEGORY.BASE,
  spellcasting: {
    ability: 'INTELLIGENCE',
    maxSpellLevel: 9,
    charges: {
      id: 'wizard-slots',
      resetKind: 'LONG_REST',
      limitKind: 'FIXED_AMOUNT',
      scalingKind: 'NONE',
      amount: 1
    },
    spellLimits: []
  },
  startingGold: { multiplier: 1, currencyId: 'gp', dieConfig: '1d4' },
  startingEquipment: { id: 'wizard-equipment', sets: [] },
  hitpoint: { ability: 'CONSTITUTION', dieConfig: '1d6' },
  multiclass: { id: 'wizard-multiclass', requirementGroups: { id: 'wizard-req', groups: [] } }
}

const registry: CharacterAssemblyRegistry = {
  classes: { wizard },
  equipment: {},
  feats: {},
  features: {},
  races: {},
  spells: {}
}

function snapshot(): CharacterBuildSnapshot {
  return {
    characterId: 'character-1',
    systemId: 'dnd5e2014',
    totalLevel: 3,
    classes: [{ classId: 'wizard', level: 3 }],
    abilities: { INTELLIGENCE: 14 },
    hitpoints: [],
    features: [],
    equipmentItems: [],
    spellSources: [
      { spellId: 'fire-bolt', sourceKind: 'CLASS', sourceInstanceId: 'wizard-primary' },
      { spellId: 'fire-bolt', sourceKind: 'CLASS', sourceInstanceId: 'wizard-secondary' }
    ],
    adjustments: [
      {
        id: 'first-bonus',
        family: 'SPELL',
        source: { spellId: 'fire-bolt', sourceKind: 'CLASS', sourceInstanceId: 'wizard-primary' },
        field: 'ATTACK_BONUS',
        value: 2
      },
      {
        id: 'ignored-bonus',
        family: 'SPELL',
        source: { spellId: 'fire-bolt', sourceKind: 'CLASS', sourceInstanceId: 'wizard-primary' },
        field: 'ATTACK_BONUS',
        value: 99
      },
      {
        id: 'dc-override',
        family: 'SPELL',
        source: { spellId: 'fire-bolt', sourceKind: 'CLASS', sourceInstanceId: 'wizard-secondary' },
        field: 'DC_OVERRIDE',
        value: 15
      }
    ]
  }
}

describe('D&D 5e 2014 Character spell mechanics policy', () => {
  it('preserves source isolation, first adjustment, and override suppression', async () => {
    const character = snapshot()
    const input = characterRulePolicyInputSchema.parse({
      contractVersion: 4,
      grantFoldFacts: dnd5e2014CharacterGrantFoldEmptyInput,
      totalLevel: character.totalLevel,
      derivedBaseFacts: buildCharacterDerivedRuleFacts(character, registry),
      ...buildCharacterSpellMechanicsRuleFacts(character),
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
    const evaluated = await evaluateZenRuleModel({
      document: dnd5e2014CharacterPolicyDocument,
      modelKey: 'character-policy',
      context: input
    })
    const actual = characterRulePolicyOutputSchema.parse(evaluated.result).spellMechanics

    expect(
      actual.map(({ source, attackBonus, saveDC, damageBonus }) => ({
        source,
        attackBonus,
        saveDC,
        damageBonus
      }))
    ).toEqual([
      {
        source: {
          spellId: 'fire-bolt',
          sourceKind: 'CLASS',
          sourceInstanceId: 'wizard-primary'
        },
        attackBonus: 6,
        saveDC: 12,
        damageBonus: 0
      },
      {
        source: {
          spellId: 'fire-bolt',
          sourceKind: 'CLASS',
          sourceInstanceId: 'wizard-secondary'
        },
        attackBonus: 4,
        saveDC: 15,
        damageBonus: 0
      }
    ])
  })

  it('uses an included race access casting ability before falling back to global spellcasting', async () => {
    const character = snapshot()
    character.abilities = { INTELLIGENCE: 14, CHARISMA: 18 }
    character.spellSources = [
      { spellId: 'race-spell', sourceKind: 'FEATURE', sourceInstanceId: 'race-feature' },
      { spellId: 'global-spell', sourceKind: 'FEAT', sourceInstanceId: 'feat-source' }
    ]
    character.adjustments = []
    const input = characterRulePolicyInputSchema.parse({
      contractVersion: 4,
      grantFoldFacts: dnd5e2014CharacterGrantFoldEmptyInput,
      totalLevel: character.totalLevel,
      derivedBaseFacts: buildCharacterDerivedRuleFacts(character, registry),
      ...buildCharacterSpellMechanicsRuleFacts(character),
      spellAccessCandidates: [
        {
          sequence: 0,
          accessId: 'race-access',
          sourceInstanceId: 'race-feature',
          spellId: 'race-spell',
          sourceFeatureId: 'race-feature',
          grantId: 'race-grant',
          sourceKind: 'RACE',
          sourceId: 'race-1',
          owningClassId: null,
          activeSourceLevel: 1,
          featureAvailableAtLevel: 1,
          inheritedFeatureDuplicate: false,
          specializationId: null,
          specializationRestrictionIds: null,
          selectionKind: 'GRANTED',
          authoringMode: 'SELECTED',
          selectedByCharacter: false,
          scalingKind: 'NONE',
          scalingSource: null,
          progressionLevel: null,
          totalLevel: character.totalLevel,
          classLevel: null,
          attributes: [],
          castAtLevel: null,
          castingAbility: 'CHARISMA',
          charge: null
        }
      ],
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
    const result = characterRulePolicyOutputSchema.parse(
      (
        await evaluateZenRuleModel({
          document: dnd5e2014CharacterPolicyDocument,
          modelKey: 'character-policy',
          context: input
        })
      ).result
    ).spellMechanics

    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: {
            spellId: 'race-spell',
            sourceKind: 'FEATURE',
            sourceInstanceId: 'race-feature'
          },
          attackBonus: 6,
          saveDC: 14
        }),
        expect.objectContaining({
          source: { spellId: 'global-spell', sourceKind: 'FEAT', sourceInstanceId: 'feat-source' },
          attackBonus: 4,
          saveDC: 12
        })
      ])
    )
  })
})
