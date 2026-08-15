import { describe, expect, it } from 'vitest'

import {
  type CharacterAssemblyRegistry,
  type CharacterBuildSnapshot
} from '@artificer-toolkit/shared/core'
import {
  characterRulePolicyInputSchema,
  characterRulePolicyOutputSchema
} from '@artificer-toolkit/schema/api/characterRules'

import { buildCharacterArmorClassRuleFacts } from '../../../../character/characterArmorClassRuleFacts.js'
import { buildCharacterDerivedRuleFacts } from '../../../../character/characterDerivedRuleFacts.js'
import { compileCharacterGrantFoldRuleFacts } from '../../../../character/characterGrantFoldRuleFacts.js'
import { dnd5e2014CharacterPolicyDocument } from './characterPolicy.js'
import { evaluateZenRuleModel } from '../../../zenRuleEngine.js'

const registry: CharacterAssemblyRegistry = {
  classes: {},
  equipment: {},
  feats: {},
  races: {},
  spells: {},
  features: {
    'ac-bonus': {
      modifiers: [
        {
          id: 'ac-bonus',
          grantKind: 'MODIFIER_GRANT',
          order: 0,
          selectionKind: 'GRANTED',
          valueDomainCode: 'ARMOR_CLASS',
          modifierKind: 'BONUS',
          domain: {},
          scope: 'GLOBAL',
          payload: { amount: 1 }
        },
        {
          id: 'ac-set',
          grantKind: 'MODIFIER_GRANT',
          order: 1,
          selectionKind: 'GRANTED',
          valueDomainCode: 'ARMOR_CLASS',
          modifierKind: 'SET_VALUE',
          domain: {},
          scope: 'GLOBAL',
          payload: { amount: 13 }
        }
      ]
    }
  }
}

function snapshot(): CharacterBuildSnapshot {
  return {
    characterId: 'character-1',
    systemId: 'dnd5e2014',
    totalLevel: 1,
    classes: [],
    abilities: { DEXTERITY: 14 },
    hitpoints: [],
    features: [
      {
        featureId: 'ac-bonus',
        source: { kind: 'FEATURE', featureId: 'ac-bonus' },
        timing: { kind: 'IMMEDIATE' }
      }
    ],
    equipmentItems: [
      {
        instanceId: 'armor-a',
        contentRef: { definitionId: 'armor-a', binding: { kind: 'ACTIVE' }, systemId: 'dnd5e2014' },
        equippedState: { slot: 'ARMOR' },
        attuned: false,
        compiledItem: {
          id: 'armor-a',
          category: 'ARMOR',
          properties: [],
          rarityId: 'common',
          armorClass: 11
        }
      },
      {
        instanceId: 'armor-b',
        contentRef: { definitionId: 'armor-b', binding: { kind: 'ACTIVE' }, systemId: 'dnd5e2014' },
        equippedState: { slot: 'ARMOR' },
        attuned: false,
        compiledItem: {
          id: 'armor-b',
          category: 'ARMOR',
          properties: [],
          rarityId: 'common',
          armorClass: 15
        }
      },
      {
        instanceId: 'shield',
        contentRef: { definitionId: 'shield', binding: { kind: 'ACTIVE' }, systemId: 'dnd5e2014' },
        equippedState: { slot: 'SHIELD' },
        attuned: false,
        compiledItem: {
          id: 'shield',
          category: 'SHIELD',
          properties: [],
          rarityId: 'common',
          armorClass: 2
        }
      }
    ]
  }
}

async function evaluate(value: CharacterBuildSnapshot) {
  const input = characterRulePolicyInputSchema.parse({
    contractVersion: 4,
    grantFoldFacts: compileCharacterGrantFoldRuleFacts({
      snapshot: value,
      registry
    }),
    totalLevel: value.totalLevel,
    derivedBaseFacts: buildCharacterDerivedRuleFacts(value, registry),
    ...buildCharacterArmorClassRuleFacts(value),
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
  return characterRulePolicyOutputSchema.parse(result.result).derivedStats.armorClass
}

describe('D&D 5e 2014 Character armor class policy', () => {
  it('matches active last armor and shield selection, including the legacy SET evidence quirk', async () => {
    const value = snapshot()
    const resolved = await evaluate(value)
    expect(resolved.effective).toBe(31)
    expect(resolved.contributions).toEqual([
      expect.objectContaining({ value: 1, state: 'APPLIED' })
    ])
    // Legacy behavior adds a SET_VALUE group's effective value but omits it from the breakdown.
    expect(resolved.contributions).toHaveLength(1)
  })

  it('uses the final manual Dexterity only while unarmored and falls back to 10 without Dexterity', async () => {
    const unarmored: CharacterBuildSnapshot = {
      ...snapshot(),
      features: [],
      equipmentItems: [],
      adjustments: [
        {
          id: 'manual-dexterity',
          family: 'ABILITY',
          ability: 'DEXTERITY',
          field: 'OTHER_MODIFIER',
          value: 2
        }
      ]
    }
    const noDexterity: CharacterBuildSnapshot = {
      ...unarmored,
      abilities: {},
      adjustments: []
    }

    await expect(evaluate(unarmored)).resolves.toMatchObject({ effective: 13 })
    await expect(evaluate(noDexterity)).resolves.toMatchObject({ effective: 10 })
  })

  it('excludes equipped armor that is inactive because it requires unattuned attunement', async () => {
    const inactiveArmor: CharacterBuildSnapshot = {
      ...snapshot(),
      features: [],
      abilities: { DEX: 14 },
      equipmentItems: [
        {
          instanceId: 'inactive-armor',
          contentRef: {
            definitionId: 'inactive-armor',
            binding: { kind: 'ACTIVE' },
            systemId: 'dnd5e2014'
          },
          equippedState: { slot: 'ARMOR' },
          attuned: false,
          compiledItem: {
            id: 'inactive-armor',
            category: 'ARMOR',
            properties: [],
            rarityId: 'common',
            armorClass: 18,
            requiresAttunement: true
          }
        }
      ]
    }

    await expect(evaluate(inactiveArmor)).resolves.toMatchObject({ effective: 12 })
  })
})
