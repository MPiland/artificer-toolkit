import { describe, expect, it } from 'vitest'

import type { CharacterBuildSnapshot } from '@artificer-toolkit/shared/core'

import { buildCharacterProficiencyRuleFacts } from './characterProficiencyRuleFacts.js'

describe('buildCharacterProficiencyRuleFacts', () => {
  it('projects only ordered supported manual proficiency additions', () => {
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
          id: 'language-elvish',
          family: 'PROFICIENCY',
          proficiencyKind: 'LANGUAGE',
          targetId: 'elvish',
          field: 'ADDITION',
          value: true
        },
        {
          id: 'armor-light',
          family: 'PROFICIENCY',
          proficiencyKind: 'ARMOR',
          targetId: 'light',
          field: 'ADDITION',
          value: true
        },
        {
          id: 'skill-perception',
          family: 'SKILL',
          skillId: 'perception',
          field: 'MISC_BONUS',
          value: 2
        }
      ]
    }

    expect(buildCharacterProficiencyRuleFacts(snapshot)).toEqual({
      proficiencyFacts: {
        manualAdditions: [
          {
            sourceId: 'language-elvish',
            source: { kind: 'MANUAL_ADJUSTMENT', adjustmentId: 'language-elvish' },
            proficiencyKind: 'LANGUAGE',
            targetId: 'elvish'
          },
          {
            sourceId: 'armor-light',
            source: { kind: 'MANUAL_ADJUSTMENT', adjustmentId: 'armor-light' },
            proficiencyKind: 'ARMOR',
            targetId: 'light'
          }
        ]
      }
    })
  })
})
