import { describe, expect, it } from 'vitest'

import type { CharacterBuildSnapshot } from '@artificer-toolkit/shared/core'

import { buildCharacterHitPointRuleFacts } from './characterHitPointRuleFacts.js'

describe('buildCharacterHitPointRuleFacts', () => {
  it('preserves ordered rows and first manual maximum adjustments', () => {
    const snapshot: CharacterBuildSnapshot = {
      characterId: 'character-1',
      systemId: 'dnd5e2014',
      totalLevel: 2,
      classes: [],
      abilities: { CONSTITUTION: 12 },
      hitpoints: [
        { classId: 'fighter', classLevel: 1, value: 10 },
        { classId: 'fighter', classLevel: 2, value: 7 }
      ],
      features: [],
      equipmentItems: [],
      adjustments: [
        { id: 'modifier', family: 'HIT_POINTS', field: 'MAXIMUM_MODIFIER', value: 3 },
        { id: 'override', family: 'HIT_POINTS', field: 'MAXIMUM_OVERRIDE', value: 1 }
      ]
    }

    expect(buildCharacterHitPointRuleFacts(snapshot)).toEqual({
      hitPointFacts: {
        rows: snapshot.hitpoints,
        constitutionAbilityId: 'CONSTITUTION',
        constitutionAbilityIndex: 0,
        progression: null,
        manualMaximumModifier: {
          sourceId: 'modifier',
          source: { kind: 'MANUAL_ADJUSTMENT', adjustmentId: 'modifier' },
          value: 3
        },
        manualMaximumOverride: {
          sourceId: 'override',
          source: { kind: 'MANUAL_ADJUSTMENT', adjustmentId: 'override' },
          value: 1
        }
      }
    })
  })
})
