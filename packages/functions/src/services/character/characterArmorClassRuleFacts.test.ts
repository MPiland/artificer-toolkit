import { describe, expect, it } from 'vitest'

import type { CharacterBuildSnapshot } from '@artificer-toolkit/shared/core'

import { buildCharacterArmorClassRuleFacts } from './characterArmorClassRuleFacts.js'

describe('buildCharacterArmorClassRuleFacts', () => {
  it('preserves equipped armor and shield order while excluding variants', () => {
    const snapshot: CharacterBuildSnapshot = {
      characterId: 'character-1',
      systemId: 'dnd5e2014',
      totalLevel: 1,
      classes: [],
      abilities: { DEX: 14 },
      hitpoints: [],
      features: [],
      equipmentItems: [
        {
          instanceId: 'armor',
          contentRef: {
            definitionId: 'leather',
            binding: { kind: 'ACTIVE' },
            systemId: 'dnd5e2014'
          },
          equippedState: { slot: 'ARMOR' },
          attuned: false,
          compiledItem: {
            id: 'leather',
            category: 'ARMOR',
            properties: [],
            rarityId: 'common',
            armorClass: 11
          }
        },
        {
          instanceId: 'variant',
          contentRef: {
            definitionId: 'variant',
            binding: { kind: 'ACTIVE' },
            systemId: 'dnd5e2014'
          },
          equippedState: { slot: 'GENERIC' },
          attuned: false,
          compiledItem: {
            id: 'variant',
            category: 'VARIANT',
            parentEquipmentId: 'leather',
            rarityId: 'common'
          }
        },
        {
          instanceId: 'shield',
          contentRef: {
            definitionId: 'shield',
            binding: { kind: 'ACTIVE' },
            systemId: 'dnd5e2014'
          },
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

    expect(buildCharacterArmorClassRuleFacts(snapshot)).toEqual({
      armorClassFacts: {
        dexterityAbilityId: 'DEX',
        dexterityAbilityIndex: 0,
        equipment: [
          {
            itemInstanceId: 'armor',
            source: { kind: 'EQUIPMENT_INSTANCE', equipmentId: 'leather', itemInstanceId: 'armor' },
            category: 'ARMOR',
            equippedSlot: 'ARMOR',
            armorClass: 11
          },
          {
            itemInstanceId: 'shield',
            source: { kind: 'EQUIPMENT_INSTANCE', equipmentId: 'shield', itemInstanceId: 'shield' },
            category: 'SHIELD',
            equippedSlot: 'SHIELD',
            armorClass: 2
          }
        ]
      }
    })
  })
})
