import { describe, expect, it } from 'vitest'

import type { CharacterBuildSnapshot } from '@artificer-toolkit/shared/core'

import { buildCharacterDefenseRuleFacts } from './characterDefenseRuleFacts.js'

describe('buildCharacterDefenseRuleFacts', () => {
  it('projects only ordered manual defense additions', () => {
    const snapshot: CharacterBuildSnapshot = {
      characterId: 'character-1',
      systemId: 'dnd5e2014',
      totalLevel: 1,
      classes: [],
      abilities: {},
      hitpoints: [],
      features: [],
      equipmentItems: [],
      adjustments: [
        {
          id: 'fire-resistance',
          family: 'DEFENSE',
          defenseKind: 'RESISTANCE',
          damageTypeId: 'fire',
          field: 'ADDITION',
          value: true
        },
        {
          id: 'skill-bonus',
          family: 'SKILL',
          skillId: 'perception',
          field: 'MISC_BONUS',
          value: 2
        }
      ]
    }

    expect(buildCharacterDefenseRuleFacts(snapshot)).toEqual({
      defenseFacts: {
        manualAdditions: [
          {
            sourceId: 'fire-resistance',
            source: { kind: 'MANUAL_ADJUSTMENT', adjustmentId: 'fire-resistance' },
            kind: 'RESISTANCE',
            damageTypeId: 'fire'
          }
        ]
      }
    })
  })
})
