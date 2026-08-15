import { describe, expect, it } from 'vitest'

import type { CharacterBuildSnapshot } from '@artificer-toolkit/shared/core'

import { buildCharacterCompanionMechanicsRuleFacts } from './characterCompanionMechanicsRuleFacts.js'

describe('buildCharacterCompanionMechanicsRuleFacts', () => {
  it('preserves hydrated companion and adjustment order, including missing targets', () => {
    const snapshot: CharacterBuildSnapshot = {
      characterId: 'character-1',
      systemId: 'dnd5e2014',
      totalLevel: 1,
      classes: [],
      abilities: {},
      hitpoints: [],
      features: [],
      equipmentItems: [],
      companions: [
        {
          companionInstanceId: 'owl-1',
          creatureId: 'owl',
          abilityScores: { DEX: 16 },
          armorClass: 11,
          maxHitPoints: 1,
          size: 'TINY'
        }
      ],
      adjustments: [
        {
          id: 'ac',
          family: 'COMPANION',
          companionInstanceId: 'owl-1',
          field: 'ARMOR_CLASS_OVERRIDE',
          value: 13
        },
        {
          id: 'missing',
          family: 'COMPANION',
          companionInstanceId: 'missing',
          field: 'SIZE_OVERRIDE',
          value: 'SMALL'
        }
      ]
    }

    expect(buildCharacterCompanionMechanicsRuleFacts(snapshot)).toEqual({
      companionMechanicsFacts: {
        companions: [
          {
            companionInstanceId: 'owl-1',
            creatureId: 'owl',
            abilityScores: { DEX: 16 },
            armorClass: 11,
            maxHitPoints: 1,
            size: 'TINY',
            alignmentId: null,
            creatureTypeId: null
          }
        ],
        adjustments: [
          {
            id: 'ac',
            companionInstanceId: 'owl-1',
            field: 'ARMOR_CLASS_OVERRIDE',
            value: 13
          },
          {
            id: 'missing',
            companionInstanceId: 'missing',
            field: 'SIZE_OVERRIDE',
            value: 'SMALL'
          }
        ]
      }
    })
  })
})
