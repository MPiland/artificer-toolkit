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
import {
  dnd5e2014RulesSystem,
  runEngine,
  type CharacterAssemblyRegistry,
  type CharacterBuildSnapshot
} from '@artificer-toolkit/shared'

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
          prepared: ['fog-cloud', 'spike-growth', 'sleet-storm', 'water-walk']
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
          prepared: ['fog-cloud', 'spike-growth', 'sleet-storm', 'water-walk']
        }
      }
    ])
    expect(output.spellAccess).toHaveLength(4)
  })

  it('preserves access metadata for at-will, fixed-level, and limited-use grants', () => {
    const atWillGrant = compileSpellGrant({
      grantKind: GRANT_KIND.SPELL_GRANT,
      id: 'at-will-grant',
      order: 1,
      selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
      scalingKind: SCALING.NONE,
      authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
      spellIds: ['mage-hand'],
      attributes: ['CAST_AT_WILL']
    })
    const fixedLevelGrant = compileSpellGrant({
      grantKind: GRANT_KIND.SPELL_GRANT,
      id: 'fixed-level-grant',
      order: 2,
      selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
      scalingKind: SCALING.NONE,
      authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
      spellIds: ['shield'],
      attributes: ['CAST_AT_LEVEL'],
      castAtLevel: 3
    })
    const limitedUseGrant = compileSpellGrant({
      grantKind: GRANT_KIND.SPELL_GRANT,
      id: 'limited-use-grant',
      order: 3,
      selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
      scalingKind: SCALING.NONE,
      authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
      spellIds: ['misty-step'],
      attributes: ['LIMITED_USE'],
      charges: {
        id: 'misty-step-charges',
        resetKind: 'LONG_REST',
        limitKind: 'FIXED_AMOUNT',
        scalingKind: SCALING.NONE,
        amount: 1
      }
    })
    const registry = makeRegistry()
    const druid = registry.classes.druid
    if (!druid) throw new Error('Expected druid class registry entry')
    druid.features = [
      { id: 'spellcasting', order: 1, spells: [atWillGrant, fixedLevelGrant, limitedUseGrant] }
    ]

    const resolved = resolveSpellGrantState(
      makeSnapshot({ classes: [{ classId: 'druid', level: 5 }] }),
      registry
    )

    expect(resolved.spellAccess).toEqual([
      expect.objectContaining({
        spellId: 'mage-hand',
        attributes: ['CAST_AT_WILL'],
        sourceFeatureId: 'spellcasting',
        grantId: 'at-will-grant'
      }),
      expect.objectContaining({
        spellId: 'shield',
        attributes: ['CAST_AT_LEVEL'],
        castAtLevel: 3,
        grantId: 'fixed-level-grant'
      }),
      expect.objectContaining({
        spellId: 'misty-step',
        attributes: ['LIMITED_USE'],
        grantId: 'limited-use-grant',
        charges: {
          id: 'misty-step-charges',
          resetKind: 'LONG_REST',
          limitKind: 'FIXED_AMOUNT',
          scalingKind: SCALING.NONE,
          amount: 1,
          bonuses: undefined
        }
      })
    ])
  })

  it('keeps duplicate spell ids from distinct grants as separate accesses', () => {
    const firstGrant = compileSpellGrant({
      grantKind: GRANT_KIND.SPELL_GRANT,
      id: 'first-shield-grant',
      order: 1,
      selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
      scalingKind: SCALING.NONE,
      authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
      spellIds: ['shield']
    })
    const secondGrant = compileSpellGrant({
      grantKind: GRANT_KIND.SPELL_GRANT,
      id: 'second-shield-grant',
      order: 2,
      selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
      scalingKind: SCALING.NONE,
      authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
      spellIds: ['shield']
    })
    const registry = makeRegistry()
    const druid = registry.classes.druid
    if (!druid) throw new Error('Expected druid class registry entry')
    druid.features = [{ id: 'spellcasting', order: 1, spells: [firstGrant, secondGrant] }]

    const spellAccess = resolveSpellGrantState(
      makeSnapshot({ classes: [{ classId: 'druid', level: 5 }] }),
      registry
    ).spellAccess

    expect(spellAccess).toHaveLength(2)
    expect(spellAccess.map((access) => access.id)).toEqual([
      'CLASS:druid:druid:spellcasting:first-shield-grant:shield',
      'CLASS:druid:druid:spellcasting:second-shield-grant:shield'
    ])
    expect(spellAccess.map((access) => access.sourceInstanceId)).toEqual([
      'CLASS:druid:druid:spellcasting:first-shield-grant',
      'CLASS:druid:druid:spellcasting:second-shield-grant'
    ])
  })

  it('resolves character-level racial spell grants with casting metadata', () => {
    const infernalLegacy = compileSpellGrant({
      grantKind: GRANT_KIND.SPELL_GRANT,
      id: 'infernal-legacy-hellish-rebuke',
      order: 1,
      selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
      scalingKind: SCALING.PER_LEVEL,
      progression: {
        scalingSource: SCALING_SOURCE.CHARACTER_LEVEL,
        levels: [
          {
            id: 'infernal-legacy-hellish-rebuke-3',
            level: 3,
            order: 1,
            authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
            spellIds: ['hellish-rebuke']
          }
        ]
      },
      attributes: ['CAST_AT_LEVEL', 'LIMITED_USE'],
      castAtLevel: 2,
      castingAbility: 'CHARISMA',
      charges: {
        id: 'infernal-legacy-hellish-rebuke-charge',
        resetKind: 'LONG_REST',
        limitKind: 'FIXED_AMOUNT',
        scalingKind: SCALING.NONE,
        amount: 1
      }
    })
    const registry = makeRegistry()
    registry.races.tiefling = {
      id: 'tiefling',
      category: 'BASE',
      selectionMode: 'DIRECT',
      size: 'MEDIUM',
      speeds: [],
      features: [{ id: 'infernal-legacy', order: 1, spells: [infernalLegacy] }]
    } as never

    expect(
      resolveSpellGrantState(
        makeSnapshot({ totalLevel: 2, raceId: 'tiefling', classes: [], hitpoints: [] }),
        registry
      ).spellAccess
    ).toEqual([])

    expect(
      resolveSpellGrantState(
        makeSnapshot({ totalLevel: 3, raceId: 'tiefling', classes: [], hitpoints: [] }),
        registry
      ).spellAccess
    ).toEqual([
      expect.objectContaining({
        spellId: 'hellish-rebuke',
        source: { kind: 'RACE', raceId: 'tiefling' },
        timing: { kind: 'CHARACTER_LEVEL', level: 3 },
        castAtLevel: 2,
        castingAbility: 'CHARISMA',
        attributes: ['CAST_AT_LEVEL', 'LIMITED_USE']
      })
    ])
  })

  it('resolves the selected spell from a subrace grant instead of every authored option', () => {
    const highElfCantrip = compileSpellGrant({
      grantKind: GRANT_KIND.SPELL_GRANT,
      id: 'high-elf-cantrip',
      order: 1,
      selectionKind: AUTHORING_SELECTION_KIND.CHOSEN,
      selectionDuplicatePolicy: 'UNIQUE',
      count: 1,
      scalingKind: SCALING.NONE,
      authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
      spellIds: ['fire-bolt', 'mage-hand'],
      attributes: ['KNOWN', 'CAST_AT_WILL'],
      castingAbility: 'INTELLIGENCE'
    })
    const registry = makeRegistry()
    registry.races.elf = {
      id: 'elf',
      category: 'BASE',
      selectionMode: 'REQUIRES_SUBRACE',
      size: 'MEDIUM',
      speeds: [],
      features: []
    } as never
    registry.races['high-elf'] = {
      id: 'high-elf',
      category: 'SUBRACE',
      parentRaceId: 'elf',
      size: 'MEDIUM',
      speeds: [],
      features: [{ id: 'high-elf-cantrip-feature', order: 1, spells: [highElfCantrip] }]
    } as never

    const spellAccess = resolveSpellGrantState(
      makeSnapshot({
        raceId: 'elf',
        subraceId: 'high-elf',
        classes: [],
        hitpoints: [],
        chosenGrantSelections: [
          {
            id: 'high-elf-cantrip-selection',
            grantId: 'high-elf-cantrip',
            source: { kind: 'SUBRACE', subraceId: 'high-elf' },
            timing: { kind: 'CHARACTER_LEVEL', level: 1 },
            targetIds: ['fire-bolt']
          }
        ]
      }),
      registry
    ).spellAccess

    expect(spellAccess).toEqual([
      expect.objectContaining({
        spellId: 'fire-bolt',
        source: { kind: 'SUBRACE', subraceId: 'high-elf' },
        castingAbility: 'INTELLIGENCE',
        attributes: ['KNOWN', 'CAST_AT_WILL']
      })
    ])
  })
})
