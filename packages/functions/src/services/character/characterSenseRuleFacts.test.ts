import { describe, expect, it } from 'vitest'

import type { CharacterBuildSnapshot } from '@artificer-toolkit/shared/core'

import { buildCharacterSenseRuleFacts } from './characterSenseRuleFacts.js'

describe('buildCharacterSenseRuleFacts', () => {
  it('projects ordered manual overrides without manufacturing senses', () => {
    const snapshot: CharacterBuildSnapshot = {
      characterId: 'character',
      systemId: 'system',
      totalLevel: 1,
      classes: [],
      abilities: {},
      hitpoints: [],
      features: [],
      equipmentItems: [],
      adjustments: [
        {
          id: 'darkvision',
          family: 'SENSE',
          senseId: '00000000-0000-4000-8000-000000000010',
          field: 'RANGE_OVERRIDE',
          value: 120
        }
      ]
    }
    expect(buildCharacterSenseRuleFacts(snapshot)).toEqual({
      senseFacts: {
        overrides: [
          {
            senseDefinitionId: '00000000-0000-4000-8000-000000000010',
            sourceId: 'darkvision',
            value: 120
          }
        ]
      }
    })
  })
})
