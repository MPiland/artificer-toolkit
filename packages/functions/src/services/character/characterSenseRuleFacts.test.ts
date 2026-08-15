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
          senseId: 'DARKVISION',
          field: 'RANGE_OVERRIDE',
          value: 120
        }
      ]
    }
    expect(buildCharacterSenseRuleFacts(snapshot)).toEqual({
      senseFacts: { overrides: [{ senseCode: 'DARKVISION', sourceId: 'darkvision', value: 120 }] }
    })
  })
})
