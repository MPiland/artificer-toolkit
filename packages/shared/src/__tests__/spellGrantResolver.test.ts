import { describe, expect, it } from 'vitest'

import {
  AUTHORING_MODE_KIND,
  AUTHORING_SELECTION_KIND,
  CLASS_CATEGORY,
  GRANT_KIND,
  SCALING,
  SCALING_SOURCE
} from '#core'
import { compileSpellGrant } from '#compilers'
import { dnd5e2014RulesSystem, runEngine, type CharacterAssemblyRegistry, type CharacterBuildSnapshot } from '@artificer-toolkit/shared'

import { resolveSpellGrantState } from '../domains/engine/resolution/spellGrantResolver.js'

function makeSnapshot(overrides: Partial<CharacterBuildSnapshot> = {}): CharacterBuildSnapshot {
  return {
    characterId: 'char-spell-grant',
    systemId: 'dnd5e2014',
    totalLevel: 5,
    classes: [
      {
        classId: 'druid',
        level: 5,
        subclassId: 'circle-of-the-land',
        specializationId: 'arctic'
      }
    ],
    abilities: {
      STR: 10,
      DEX: 12,
      CON: 14,
      INT: 10,
      WIS: 16,
      CHA: 8
    },
    hitpoints: [
      { classId: 'druid', classLevel: 1, value: 8 },
      { classId: 'druid', classLevel: 2, value: 7 },
      { classId: 'druid', classLevel: 3, value: 7 },
      { classId: 'druid', classLevel: 4, value: 7 },
      { classId: 'druid', classLevel: 5, value: 7 }
    ],
    features: [],
    equipmentItems: [],
    ...overrides
  }
}

function makeRegistry(): CharacterAssemblyRegistry {
  const arcticGrant = compileSpellGrant({
    grantKind: GRANT_KIND.SPELL_GRANT,
    id: 'circle-spells-arctic',
    order: 1,
    selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
    scalingKind: SCALING.PER_LEVEL,
    progression: {
      scalingSource: SCALING_SOURCE.CLASS_LEVEL,
      classId: 'druid',
      levels: [
        {
          id: 'circle-spells-arctic-3',
          level: 3,
          order: 1,
          authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
          spellIds: ['fog-cloud', 'spike-growth']
        },
        {
          id: 'circle-spells-arctic-5',
          level: 5,
          order: 2,
          authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
          spellIds: ['sleet-storm', 'water-walk']
        },
        {
          id: 'circle-spells-arctic-7',
          level: 7,
          order: 3,
          authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
          spellIds: ['freedom-of-movement', 'ice-storm']
        },
        {
          id: 'circle-spells-arctic-9',
          level: 9,
          order: 4,
          authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
          spellIds: ['commune-with-nature', 'cone-of-cold']
        }
      ]
    },
    attributes: ['PREPARED'],
    restrictions: {
      groups: [
        {
          contexts: [
            {
              subject: 'SUBCLASS',
              authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
              conditions: [
                {
                  predicateCode: 'SUBCLASS_SPECIALIZATION',
                  authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
                  specializationIds: ['arctic']
                }
              ]
            }
          ]
        }
      ]
    }
  } as never)

  const coastGrant = compileSpellGrant({
    grantKind: GRANT_KIND.SPELL_GRANT,
    id: 'circle-spells-coast',
    order: 2,
    selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
    scalingKind: SCALING.PER_LEVEL,
    progression: {
      scalingSource: SCALING_SOURCE.CLASS_LEVEL,
      classId: 'druid',
      levels: [
        {
          id: 'circle-spells-coast-3',
          level: 3,
          order: 1,
          authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
          spellIds: ['create-or-destroy-water', 'mirror-image']
        }
      ]
    },
    attributes: ['PREPARED'],
    restrictions: {
      groups: [
        {
          contexts: [
            {
              subject: 'SUBCLASS',
              authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
              conditions: [
                {
                  predicateCode: 'SUBCLASS_SPECIALIZATION',
                  authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
                  specializationIds: ['coast']
                }
              ]
            }
          ]
        }
      ]
    }
  } as never)

  return {
    features: {},
    classes: {
      druid: {
        id: 'druid',
        category: CLASS_CATEGORY.BASE,
        features: []
      } as never,
      'circle-of-the-land': {
        id: 'circle-of-the-land',
        category: CLASS_CATEGORY.SUBCLASS,
        parentClassId: 'druid',
        specializations: [
          { id: 'arctic', order: 1 },
          { id: 'coast', order: 2 }
        ],
        features: [
          {
            id: 'circle-spells',
            order: 1,
            availableAtLevel: 2,
            spells: [arcticGrant, coastGrant]
          } as never
        ]
      } as never
    },
    feats: {},
    races: {},
    equipment: {},
    spells: {}
  }
}

describe('spell grant resolver', () => {
  it('resolves class/subclass spell grants into class spell state and spell access', () => {
    const snapshot = makeSnapshot()
    const resolved = resolveSpellGrantState(snapshot, makeRegistry())

    expect(resolved.spellState).toEqual([
      {
        classId: 'druid',
        spells: {
          prepared: [
            'fog-cloud',
            'spike-growth',
            'sleet-storm',
            'water-walk'
          ]
        }
      }
    ])

    expect(resolved.spellAccess.map((entry) => entry.spellId)).toEqual([
      'fog-cloud',
      'spike-growth',
      'sleet-storm',
      'water-walk'
    ])
  })

  it('skips subclass spell grants when the specialization does not match', () => {
    const snapshot = makeSnapshot({
      classes: [
        {
          classId: 'druid',
          level: 5,
          subclassId: 'circle-of-the-land',
          specializationId: 'coast'
        }
      ]
    })
    const resolved = resolveSpellGrantState(snapshot, makeRegistry())

    expect(resolved.spellState).toEqual([
      {
        classId: 'druid',
        spells: {
          prepared: ['create-or-destroy-water', 'mirror-image']
        }
      }
    ])

    expect(resolved.spellAccess.map((entry) => entry.spellId)).toEqual([
      'create-or-destroy-water',
      'mirror-image'
    ])
  })

  it('omits subclass spells before the granted class level unlock', () => {
    const snapshot = makeSnapshot({
      totalLevel: 2,
      classes: [
        {
          classId: 'druid',
          level: 2,
          subclassId: 'circle-of-the-land',
          specializationId: 'arctic'
        }
      ],
      hitpoints: [
        { classId: 'druid', classLevel: 1, value: 8 },
        { classId: 'druid', classLevel: 2, value: 7 }
      ]
    })
    const resolved = resolveSpellGrantState(snapshot, makeRegistry())

    expect(resolved.spellState).toBeUndefined()
    expect(resolved.spellAccess).toEqual([])
  })

  it('flows resolved spell state through runEngine', () => {
    const output = runEngine(makeSnapshot(), makeRegistry(), dnd5e2014RulesSystem)

    expect(output.spellState).toEqual([
      {
        classId: 'druid',
        spells: {
          prepared: [
            'fog-cloud',
            'spike-growth',
            'sleet-storm',
            'water-walk'
          ]
        }
      }
    ])
  })
})
