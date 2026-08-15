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
import { buildCharacterItemMechanicsRuleFacts } from '../../../../character/characterItemMechanicsRuleFacts.js'
import { dnd5e2014CharacterPolicyDocument } from './characterPolicy.js'
import { dnd5e2014CharacterGrantFoldEmptyInput } from './characterGrantFoldSource.js'
import { evaluateZenRuleModel } from '../../../zenRuleEngine.js'

const registry: CharacterAssemblyRegistry = {
  classes: {},
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
    totalLevel: 1,
    classes: [],
    abilities: {},
    hitpoints: [],
    features: [],
    equipmentItems: [
      {
        instanceId: 'inactive-item',
        contentRef: { definitionId: 'dagger', binding: { kind: 'ACTIVE' }, systemId: 'dnd5e2014' },
        attuned: false,
        compiledItem: {
          id: 'dagger',
          category: 'WEAPON',
          properties: [],
          rarityId: 'common',
          cost: { amount: 2, currencyId: 'gp' },
          weight: { amount: 1, unit: 'POUNDS' }
        }
      },
      {
        instanceId: 'equipped-item',
        contentRef: { definitionId: 'dagger', binding: { kind: 'ACTIVE' }, systemId: 'dnd5e2014' },
        equippedState: { slot: 'MAIN_HAND' },
        attuned: true,
        compiledItem: { id: 'dagger', category: 'WEAPON', properties: [], rarityId: 'common' }
      },
      {
        instanceId: 'same-definition-other-instance',
        contentRef: { definitionId: 'dagger', binding: { kind: 'ACTIVE' }, systemId: 'dnd5e2014' },
        attuned: false,
        compiledItem: { id: 'dagger', category: 'WEAPON', properties: [], rarityId: 'common' }
      }
    ],
    adjustments: [
      {
        id: 'attack-bonus',
        family: 'ITEM',
        itemInstanceId: 'inactive-item',
        field: 'ATTACK_BONUS',
        value: 2
      },
      {
        id: 'attack-override',
        family: 'ITEM',
        itemInstanceId: 'inactive-item',
        field: 'ATTACK_OVERRIDE',
        value: 7
      },
      {
        id: 'second-attack-bonus',
        family: 'ITEM',
        itemInstanceId: 'inactive-item',
        field: 'ATTACK_BONUS',
        value: 99
      },
      {
        id: 'damage',
        family: 'ITEM',
        itemInstanceId: 'equipped-item',
        field: 'DAMAGE_BONUS',
        value: 3
      },
      {
        id: 'cost',
        family: 'ITEM',
        itemInstanceId: 'equipped-item',
        field: 'COST_OVERRIDE',
        value: 8
      },
      {
        id: 'weight',
        family: 'ITEM',
        itemInstanceId: 'equipped-item',
        field: 'WEIGHT_OVERRIDE',
        value: 4
      },
      {
        id: 'adamantine',
        family: 'ITEM',
        itemInstanceId: 'equipped-item',
        field: 'ADAMANTINE',
        value: true
      },
      {
        id: 'dual-wield',
        family: 'ITEM',
        itemInstanceId: 'equipped-item',
        field: 'DUAL_WIELD',
        value: true
      },
      {
        id: 'silvered',
        family: 'ITEM',
        itemInstanceId: 'equipped-item',
        field: 'SILVERED',
        value: true
      },
      {
        id: 'display',
        family: 'ITEM',
        itemInstanceId: 'equipped-item',
        field: 'DISPLAY_AS_ATTACK',
        value: true
      },
      {
        id: 'other-attack',
        family: 'ITEM',
        itemInstanceId: 'same-definition-other-instance',
        field: 'ATTACK_BONUS',
        value: 5
      },
      {
        id: 'missing',
        family: 'ITEM',
        itemInstanceId: 'missing-item',
        field: 'ATTACK_BONUS',
        value: 99
      }
    ]
  }
}

function input(character: CharacterBuildSnapshot) {
  return characterRulePolicyInputSchema.parse({
    contractVersion: 4,
    grantFoldFacts: dnd5e2014CharacterGrantFoldEmptyInput,
    totalLevel: character.totalLevel,
    derivedBaseFacts: buildCharacterDerivedRuleFacts(character, registry),
    ...buildCharacterItemMechanicsRuleFacts(character),
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
}

describe('D&D 5e 2014 Character item mechanics policy', () => {
  it('isolates item values and preserves manual override provenance', async () => {
    const character = snapshot()
    const actual = characterRulePolicyOutputSchema.parse(
      (
        await evaluateZenRuleModel({
          document: dnd5e2014CharacterPolicyDocument,
          modelKey: 'character-policy',
          context: input(character)
        })
      ).result
    ).itemMechanics

    expect(actual).toMatchObject([
      {
        itemInstanceId: 'inactive-item',
        attackBonus: 7,
        cost: 2,
        damageBonus: 0,
        displayAsAttack: false,
        properties: { adamantine: false, dualWield: false, silvered: false },
        weight: { amount: 1, unit: 'POUNDS' }
      },
      {
        itemInstanceId: 'equipped-item',
        attackBonus: 0,
        cost: 8,
        damageBonus: 3,
        displayAsAttack: true,
        properties: { adamantine: true, dualWield: true, silvered: true },
        weight: { amount: 4, unit: 'POUNDS' }
      },
      {
        itemInstanceId: 'same-definition-other-instance',
        attackBonus: 5,
        damageBonus: 0,
        displayAsAttack: false
      }
    ])
    expect(actual[0]?.calculations.attackBonus).toMatchObject({
      effective: 7,
      contributions: [
        expect.objectContaining({
          sourceId: 'attack-bonus',
          state: 'SUPPRESSED',
          reasonCode: 'SUPPRESSED_BY_OVERRIDE'
        })
      ],
      override: expect.objectContaining({ sourceId: 'attack-override', value: 7 })
    })
  })
})
