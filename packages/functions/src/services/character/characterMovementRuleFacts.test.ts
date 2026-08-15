import { describe, expect, it } from 'vitest'

import type {
  CharacterAssemblyRegistry,
  CharacterBuildSnapshot
} from '@artificer-toolkit/shared/core'

import { buildCharacterMovementRuleFacts } from './characterMovementRuleFacts.js'

describe('buildCharacterMovementRuleFacts', () => {
  it('uses the selected subrace and preserves ordered manual speed overrides', () => {
    const snapshot: CharacterBuildSnapshot = {
      characterId: 'character',
      systemId: 'system',
      totalLevel: 1,
      classes: [],
      abilities: {},
      hitpoints: [],
      features: [],
      equipmentItems: [],
      raceId: 'race',
      subraceId: 'subrace',
      movementDisplayPreference: { mode: 'EXPLICIT', speedId: 'fly' },
      adjustments: [
        { id: 'override', family: 'MOVEMENT', speedId: 'fly', field: 'SPEED_OVERRIDE', value: 0 }
      ]
    }
    const registry = {
      races: {
        race: { speeds: [{ speedId: 'walk', amount: 30, unit: 'FEET' }] },
        subrace: { speeds: [{ speedId: 'fly', amount: 20, unit: 'FEET' }] }
      },
      system: { speeds: [{ id: 'fly', code: 'FLY' }] }
    } as unknown as CharacterAssemblyRegistry
    expect(buildCharacterMovementRuleFacts(snapshot, registry)).toEqual({
      movementFacts: {
        speeds: [
          {
            speedId: 'fly',
            code: 'FLY',
            baseAmount: 20,
            unit: 'FEET',
            override: { sourceId: 'override', value: 0 }
          }
        ],
        preference: { mode: 'EXPLICIT', speedId: 'fly' }
      }
    })
  })
})
