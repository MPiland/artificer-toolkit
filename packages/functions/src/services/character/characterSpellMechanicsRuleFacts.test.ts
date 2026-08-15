import { describe, expect, it } from 'vitest'

import type { CharacterBuildSnapshot } from '@artificer-toolkit/shared/core'

import { buildCharacterSpellMechanicsRuleFacts } from './characterSpellMechanicsRuleFacts.js'

describe('buildCharacterSpellMechanicsRuleFacts', () => {
  it('preserves source and adjustment order as raw facts', () => {
    const snapshot: CharacterBuildSnapshot = {
      characterId: 'character-1',
      systemId: 'dnd5e2014',
      totalLevel: 1,
      classes: [],
      abilities: {},
      hitpoints: [],
      features: [],
      equipmentItems: [],
      spellSources: [{ spellId: 'shield', sourceKind: 'FEAT', sourceInstanceId: 'feat-1' }],
      adjustments: [
        {
          id: 'damage',
          family: 'SPELL',
          source: { spellId: 'shield', sourceKind: 'FEAT', sourceInstanceId: 'feat-1' },
          field: 'DAMAGE_BONUS',
          value: 2
        }
      ]
    }

    expect(buildCharacterSpellMechanicsRuleFacts(snapshot)).toEqual({
      spellMechanicsFacts: {
        snapshotSources: [
          { sequence: 0, spellId: 'shield', sourceKind: 'FEAT', sourceInstanceId: 'feat-1' }
        ],
        adjustments: [
          {
            sequence: 0,
            id: 'damage',
            source: { spellId: 'shield', sourceKind: 'FEAT', sourceInstanceId: 'feat-1' },
            field: 'DAMAGE_BONUS',
            value: 2
          }
        ]
      }
    })
  })
})
