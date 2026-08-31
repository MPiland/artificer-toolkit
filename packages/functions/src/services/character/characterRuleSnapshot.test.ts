import { describe, expect, it } from 'vitest'

import {
  CLASS_CATEGORY,
  CHARACTER_ABILITY_GENERATION_METHOD,
  HITPOINT_CALCULATION_METHOD_CODE
} from '@artificer-toolkit/shared/core'

import {
  assembleCharacterRuleSnapshot,
  type CharacterRuleSnapshotInput
} from './characterRuleSnapshot.js'
import { createEmptyCharacterAuthored } from './builderService.js'

function input(): CharacterRuleSnapshotInput {
  const character = createEmptyCharacterAuthored({
    id: 'character-1',
    systemId: 'dnd5e2014',
    primaryRulesCatalogueId: '00000000-0000-4000-8000-000000000301',
    userId: 'user-1'
  })
  character.intent.abilities = {
    method: CHARACTER_ABILITY_GENERATION_METHOD.MANUAL_ROLLED,
    state: { assignments: [{ ability: 'STRENGTH', score: 14 }] }
  }
  character.intent.hitpoints = {
    method: HITPOINT_CALCULATION_METHOD_CODE.FIXED,
    levels: [{ level: 1, classId: 'fighter', classLevel: 1, value: 12 }]
  }
  return {
    character,
    context: {
      catalog: {
        races: [],
        classes: [],
        backgrounds: [],
        equipment: [],
        feats: [],
        spells: []
      },
      registry: {
        system: null,
        races: [],
        classes: [],
        backgrounds: [],
        equipment: [],
        feats: [],
        features: []
      }
    }
  }
}

describe('assembleCharacterRuleSnapshot', () => {
  it('assembles raw character intent and state without a legacy engine resolution', () => {
    const { snapshot, registry } = assembleCharacterRuleSnapshot(input())

    expect(snapshot).toMatchObject({
      characterId: 'character-1',
      systemId: 'dnd5e2014',
      abilities: { STRENGTH: 14 },
      hitpoints: [{ classId: 'fighter', classLevel: 1, value: 12 }],
      features: [],
      equipmentItems: [],
      spellSources: [],
      companions: [],
      adjustments: [],
      movementDisplayPreference: { mode: 'AUTO' }
    })
    expect(registry.classes).toEqual({})
    expect(registry.features).toEqual({})
  })

  it('includes features embedded in authored subjects', () => {
    const testInput = input()
    testInput.context.registry.classes = [
      {
        id: 'fighter',
        label: 'Fighter',
        category: CLASS_CATEGORY.BASE,
        userId: 'owner',
        systemId: 'system',
        startingGold: {
          currencyId: 'gp',
          dieConfig: '5d4',
          multiplier: 10
        },
        startingEquipment: {
          id: 'fighter-equipment',
          sets: []
        },
        hitpoint: {
          ability: 'CONSTITUTION',
          dieConfig: '1d10'
        },
        multiclass: {
          id: 'fighter-multiclass',
          requirementGroups: {
            groups: []
          }
        },
        features: [
          {
            id: 'second-wind',
            label: 'Second Wind',
            description: 'Recover hit points.',
            order: 1
          }
        ]
      }
    ]

    const { registry } = assembleCharacterRuleSnapshot(testInput)

    expect(registry.features['second-wind']).toBeDefined()
    expect(registry.spells).toEqual({})
  })
})
