import { describe, expect, it } from 'vitest'

import type { CharacterBuildSnapshot } from '@artificer-toolkit/shared/core'

import { buildCharacterItemMechanicsRuleFacts } from './characterItemMechanicsRuleFacts.js'

describe('buildCharacterItemMechanicsRuleFacts', () => {
  it('preserves owned item and adjustment order without filtering inactive items', () => {
    const snapshot: CharacterBuildSnapshot = {
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
          contentRef: {
            definitionId: 'dagger',
            binding: { kind: 'ACTIVE' },
            systemId: 'dnd5e2014'
          },
          attuned: false,
          compiledItem: {
            id: 'dagger',
            category: 'WEAPON',
            properties: [],
            rarityId: 'common',
            cost: { amount: 2, currencyId: 'gp' },
            weight: { amount: 1, unit: 'POUNDS' }
          }
        }
      ],
      adjustments: [
        {
          id: 'attack',
          family: 'ITEM',
          itemInstanceId: 'inactive-item',
          field: 'ATTACK_BONUS',
          value: 2
        },
        {
          id: 'missing',
          family: 'ITEM',
          itemInstanceId: 'missing-item',
          field: 'SILVERED',
          value: true
        }
      ]
    }

    expect(buildCharacterItemMechanicsRuleFacts(snapshot)).toEqual({
      itemMechanicsFacts: {
        items: [
          {
            itemInstanceId: 'inactive-item',
            costAmount: 2,
            weight: { amount: 1, unit: 'POUNDS' }
          }
        ],
        adjustments: [
          { id: 'attack', itemInstanceId: 'inactive-item', field: 'ATTACK_BONUS', value: 2 },
          { id: 'missing', itemInstanceId: 'missing-item', field: 'SILVERED', value: true }
        ]
      }
    })
  })
})
