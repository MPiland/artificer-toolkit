import { describe, expect, it } from 'vitest'
import type { CharacterAssemblyStructureQueryResult } from '@artificer-toolkit/db'
import type { CharacterAuthored } from '@artificer-toolkit/shared/subjects/authored'

import { planCharacterAssembly } from './characterAssemblyPlanner.js'

function createCharacter(): CharacterAuthored {
  return {
    id: 'character-1',
    label: 'Aria',
    status: 'ACTIVE',
    profile: {},
    systemId: 'system-1',
    userId: 'user-1',
    intent: {
      advancement: { method: 'MILESTONE' },
      race: { raceId: 'race-1' },
      ancestrySelections: [
        {
          id: 'ancestry-selection-1',
          ancestryId: 'ancestry-1',
          optionId: 'ancestry-option-selected',
          source: { kind: 'RACE', raceId: 'race-1' },
          timing: { kind: 'IMMEDIATE' }
        }
      ],
      background: { backgroundId: 'background-1' },
      classes: [{ classId: 'class-1', classLevel: 3 }],
      abilities: { method: 'STANDARD_ARRAY', assignments: [] },
      hitpoints: { method: 'FIXED', levels: [] },
      featureAcquisitions: [
        {
          id: 'acquisition-active',
          featureId: 'feature-active-explicit',
          source: { kind: 'FEAT', featId: 'feat-1' },
          timing: { kind: 'CHARACTER_LEVEL', level: 2 },
          selections: [
            {
              selectionKey: 'options',
              values: [{ kind: 'ID', id: 'option-active' }]
            }
          ]
        },
        {
          id: 'acquisition-future',
          featureId: 'feature-future-explicit',
          source: { kind: 'CLASS', classId: 'class-1', classLevel: 5 },
          timing: { kind: 'CLASS_LEVEL', classId: 'class-1', classLevel: 5 },
          selections: [
            {
              selectionKey: 'options',
              values: [{ kind: 'ID', id: 'option-future' }]
            }
          ]
        }
      ]
    },
    state: {
      equipment: {
        inventory: [{ id: 'inventory-1', equipmentId: 'equipment-1', quantity: 1 }],
        equipped: [],
        attuned: []
      },
      currency: [],
      hitpoints: { current: 1, hitDice: [] }
    }
  }
}

function createStructure(): CharacterAssemblyStructureQueryResult {
  return {
    rootFeatureLinks: [
      {
        ownerKind: 'CLASS',
        ownerId: 'class-1',
        featureId: 'feature-class-active',
        order: 1,
        availableAtLevel: 1
      },
      {
        ownerKind: 'CLASS',
        ownerId: 'class-1',
        featureId: 'feature-class-future',
        order: 2,
        availableAtLevel: 5
      },
      {
        ownerKind: 'FEAT',
        ownerId: 'feat-1',
        featureId: 'feature-feat',
        order: 1,
        availableAtLevel: 1
      },
      {
        ownerKind: 'EQUIPMENT',
        ownerId: 'equipment-1',
        featureId: 'feature-equipment',
        order: 1,
        availableAtLevel: 1
      }
    ],
    ancestryOptions: [
      {
        raceId: 'race-1',
        ancestryOptionId: 'ancestry-option-selected',
        order: 1,
        featureLinks: [
          {
            featureId: 'feature-ancestry-selected',
            order: 1,
            availableAtLevel: 1
          }
        ]
      },
      {
        raceId: 'race-1',
        ancestryOptionId: 'ancestry-option-unselected',
        order: 2,
        featureLinks: [
          {
            featureId: 'feature-ancestry-unselected',
            order: 1,
            availableAtLevel: 1
          }
        ]
      }
    ],
    featureOptions: [
      { featureId: 'feature-active-explicit', optionId: 'option-active', order: 1 },
      { featureId: 'feature-future-explicit', optionId: 'option-future', order: 1 }
    ],
    featureOptionChoices: []
  }
}

describe('planCharacterAssembly', () => {
  it('selects only active root, ancestry, explicit, feat, and equipment mechanics', () => {
    const plan = planCharacterAssembly({
      character: createCharacter(),
      structure: createStructure(),
      selectedFeatIds: new Set(['feat-1'])
    })

    expect([...plan.activeFeatureIds].sort()).toEqual(
      [
        'feature-active-explicit',
        'feature-ancestry-selected',
        'feature-class-active',
        'feature-equipment',
        'feature-feat'
      ].sort()
    )
    expect(plan.activeFeatureIds.has('feature-class-future')).toBe(false)
    expect(plan.activeFeatureIds.has('feature-future-explicit')).toBe(false)
    expect(plan.activeFeatureIds.has('feature-ancestry-unselected')).toBe(false)
    expect([...plan.selectedFeatureOptionIds]).toEqual(['option-active'])
  })

  it('loads first-level selected-source features while a draft has no class levels yet', () => {
    const character = createCharacter()
    character.intent.classes = []
    const structure = createStructure()
    structure.rootFeatureLinks.push(
      {
        ownerKind: 'RACE',
        ownerId: 'race-1',
        featureId: 'feature-race-level-one',
        order: 1,
        availableAtLevel: 1
      },
      {
        ownerKind: 'RACE',
        ownerId: 'race-1',
        featureId: 'feature-race-level-two',
        order: 2,
        availableAtLevel: 2
      },
      {
        ownerKind: 'BACKGROUND',
        ownerId: 'background-1',
        featureId: 'feature-background-level-one',
        order: 1,
        availableAtLevel: 1
      }
    )

    const plan = planCharacterAssembly({
      character,
      structure,
      selectedFeatIds: new Set(['feat-1'])
    })

    expect([...plan.activeFeatureIds].sort()).toEqual(
      [
        'feature-ancestry-selected',
        'feature-background-level-one',
        'feature-equipment',
        'feature-feat',
        'feature-race-level-one'
      ].sort()
    )
    expect(plan.activeFeatureIds.has('feature-race-level-two')).toBe(false)
    expect(plan.activeFeatureIds.has('feature-class-active')).toBe(false)
  })
})
