import { describe, expect, it, vi } from 'vitest'
import {
  DummyDriver,
  Kysely,
  PostgresAdapter,
  PostgresIntrospector,
  PostgresQueryCompiler
} from 'kysely'

import type { Database } from '@artificer-toolkit/db'
import { GRANT_KIND } from '@artificer-toolkit/shared/core'
import type { CharacterAuthored } from '@artificer-toolkit/shared/subjects/authored'

import {
  createEmptyCharacterAuthored,
  resolveCharacterBuilder,
  type CharacterBuilderContext,
  type CharacterBuilderRegistry
} from './builderService.js'
import { reconcileCharacterBuilderCharacter } from './builderReconciliation.js'
import {
  isCharacterHitpointProgressionValid,
  reconcileCharacterHitDice,
  reconcileCharacterHitpointProgression
} from './builderHitPoints.js'
import type { CharacterBuilderCatalog } from './builderCatalog.js'

vi.mock('./characterRuleEvaluation.js', async () => {
  const { evaluateCharacterBuilderTestPolicy } =
    await import('./characterBuilderRuleEvaluation.testUtils.js')
  return { evaluateCharacterRulePolicy: evaluateCharacterBuilderTestPolicy }
})

const unusedDb = new Kysely<Database>({
  dialect: {
    createAdapter: () => new PostgresAdapter(),
    createDriver: () => new DummyDriver(),
    createIntrospector: (db) => new PostgresIntrospector(db),
    createQueryCompiler: () => new PostgresQueryCompiler()
  }
})

function createCharacter(overrides?: Partial<CharacterAuthored>): CharacterAuthored {
  return {
    ...createEmptyCharacterAuthored({
      id: 'character-1',
      systemId: 'dnd5e2014',
      userId: 'user-1'
    }),
    ...overrides
  }
}

function createRegistry(): CharacterBuilderRegistry {
  return {
    system: null,
    races: [
      {
        id: 'dragonborn',
        label: 'Dragonborn',
        category: 'BASE',
        selectionMode: 'DIRECT',
        size: 'MEDIUM',
        speeds: [],
        userId: 'user-1',
        systemId: 'dnd5e2014',
        ancestry: {
          id: 'draconic-ancestry',
          label: 'Draconic Ancestry',
          options: [
            {
              id: 'red',
              label: 'Red',
              description: '',
              order: 0
            }
          ]
        }
      } as CharacterBuilderRegistry['races'][number]
    ],
    classes: [],
    backgrounds: [],
    equipment: [],
    features: [
      {
        id: 'arcane-recovery',
        label: 'Arcane Recovery'
      } as CharacterBuilderRegistry['features'][number]
    ]
  }
}

function createCatalog(): CharacterBuilderCatalog {
  return {
    races: [{ id: 'dragonborn', label: 'Dragonborn', category: 'BASE' }],
    classes: [],
    backgrounds: [],
    equipment: [],
    feats: [],
    spells: [
      {
        id: 'magic-missile',
        label: 'Magic Missile',
        description: '',
        level: 1,
        classIds: ['wizard'],
        magicSchoolId: 'evocation',
        castingTime: { unit: 'ROUND', amount: 1 }
      }
    ]
  }
}

function createContext(): CharacterBuilderContext {
  return { catalog: createCatalog(), registry: createRegistry() }
}

function createSystem(): NonNullable<CharacterBuilderRegistry['system']> {
  return {
    id: 'dnd5e2014',
    label: 'D&D 5e 2014',
    rulesetCode: 'dnd5e',
    rulesetVersion: '2014',
    alignments: [],
    challengeRatings: [],
    conditionTypes: [],
    creatureTypes: [],
    currencies: [],
    damageTypes: [],
    heritages: [],
    languages: [],
    lifestyles: [],
    magicSchools: [],
    passives: [],
    rarities: [],
    senses: [],
    skills: [],
    speeds: [],
    terrains: [],
    userId: 'user-1'
  }
}

function createHitpointClass(
  id: string,
  dieConfig: string
): CharacterBuilderRegistry['classes'][number] {
  return {
    id,
    label: id,
    category: 'BASE',
    userId: 'user-1',
    systemId: 'dnd5e2014',
    startingGold: { multiplier: 5, currencyId: 'gp', dieConfig: '5d4' },
    startingEquipment: { id: `${id}-equipment`, sets: [] },
    hitpoint: { ability: 'CONSTITUTION', dieConfig },
    multiclass: { id: `${id}-multiclass`, requirementGroups: { groups: [] } }
  } as CharacterBuilderRegistry['classes'][number]
}

describe('character hit point progression', () => {
  it('preserves interleaved multiclass order and removes invalid class progression', () => {
    const classes = [
      { classId: 'fighter', classLevel: 2 },
      { classId: 'wizard', classLevel: 1 }
    ]
    const ordered = [
      { level: 1, classId: 'fighter', classLevel: 1, value: 12 },
      { level: 2, classId: 'wizard', classLevel: 1, value: 5 },
      { level: 3, classId: 'fighter', classLevel: 2, value: 8 }
    ]

    expect(isCharacterHitpointProgressionValid(classes, ordered, true)).toBe(true)
    expect(
      reconcileCharacterHitpointProgression(classes, [
        ordered[0]!,
        { level: 2, classId: 'rogue', classLevel: 1, value: 7 },
        ordered[1]!,
        { level: 4, classId: 'fighter', classLevel: 3, value: 8 },
        ordered[2]!
      ])
    ).toEqual(ordered)
  })

  it('rejects gaps in a selected class progression', () => {
    const classes = [{ classId: 'fighter', classLevel: 2 }]
    const levels = [
      { level: 1, classId: 'fighter', classLevel: 1, value: 12 },
      { level: 2, classId: 'fighter', classLevel: 3, value: 8 }
    ]

    expect(isCharacterHitpointProgressionValid(classes, levels, true)).toBe(false)
    expect(reconcileCharacterHitpointProgression(classes, levels)).toEqual([levels[0]!])
  })
})

describe('character hit dice', () => {
  const createBaseClass = (
    id: string,
    dieConfig: string
  ): CharacterBuilderRegistry['classes'][number] => ({
    id,
    label: id,
    category: 'BASE',
    userId: 'user-1',
    systemId: 'dnd5e2014',
    startingGold: { multiplier: 5, currencyId: 'gp', dieConfig: '5d4' },
    startingEquipment: { id: `${id}-equipment`, sets: [] },
    hitpoint: { ability: 'CONSTITUTION', dieConfig },
    multiclass: { id: `${id}-multiclass`, requirementGroups: { groups: [] } }
  })

  it('derives and aggregates multiclass totals while preserving clamped used counts', () => {
    const authoredClasses = [
      createBaseClass('fighter', '1d10'),
      createBaseClass('wizard', 'd6'),
      createBaseClass('paladin', '1d10')
    ]

    expect(
      reconcileCharacterHitDice(
        [
          { classId: 'fighter', classLevel: 3 },
          { classId: 'wizard', classLevel: 2 },
          { classId: 'paladin', classLevel: 1 }
        ],
        authoredClasses,
        [
          { die: 10, total: 99, used: 5 },
          { die: 6, total: 1, used: 1 },
          { die: 12, total: 4, used: 3 }
        ]
      )
    ).toEqual([
      { die: 10, total: 4, used: 4 },
      { die: 6, total: 2, used: 1 }
    ])
  })

  it('ignores missing classes and invalid hit-die configurations', () => {
    expect(
      reconcileCharacterHitDice(
        [
          { classId: 'invalid', classLevel: 2 },
          { classId: 'missing', classLevel: 1 }
        ],
        [createBaseClass('invalid', '2d8')],
        [{ die: 8, total: 3, used: 2 }]
      )
    ).toEqual([])
  })
})

describe('character builder ability and hit point rules', () => {
  it('reports malformed assignments, Standard Array reuse, and Point Buy overspend', async () => {
    const malformed = createCharacter()
    malformed.intent.abilities = {
      method: 'STANDARD_ARRAY',
      assignments: [
        { ability: 'STRENGTH', option: '8' },
        { ability: 'STRENGTH', option: '8' }
      ]
    }

    const malformedResolution = await resolveCharacterBuilder(
      unusedDb,
      malformed,
      'create',
      createContext()
    )
    expect(malformedResolution.validations.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(['MALFORMED_ABILITY_ASSIGNMENTS', 'STANDARD_ARRAY_SCORE_REUSE'])
    )

    const overspent = createCharacter()
    overspent.intent.abilities = {
      method: 'POINT_BUY',
      assignments: [
        { ability: 'STRENGTH', option: '15' },
        { ability: 'DEXTERITY', option: '15' },
        { ability: 'CONSTITUTION', option: '15' },
        { ability: 'INTELLIGENCE', option: '15' }
      ]
    }

    const overspentResolution = await resolveCharacterBuilder(
      unusedDb,
      overspent,
      'create',
      createContext()
    )
    expect(overspentResolution.validations.map((issue) => issue.code)).toContain(
      'POINT_BUY_OVERSPEND'
    )
  })

  it('reports missing and invalid manual hit-die rolls', async () => {
    const context = createContext()
    context.registry.classes = [createHitpointClass('fighter', 'd8')]
    const character = createCharacter()
    character.intent.classes = [{ classId: 'fighter', classLevel: 3 }]
    character.intent.hitpoints = {
      method: 'MANUAL',
      levels: [
        { level: 1, classId: 'fighter', classLevel: 1, value: 8 },
        { level: 2, classId: 'fighter', classLevel: 2, value: 1 },
        {
          level: 3,
          classId: 'fighter',
          classLevel: 3,
          value: 9,
          rolls: [{ die: 8, value: 9 }]
        }
      ]
    }

    const resolution = await resolveCharacterBuilder(unusedDb, character, 'create', context)
    expect(resolution.validations.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(['MISSING_MANUAL_HITPOINT_ROLL', 'INVALID_MANUAL_HITPOINT_ROLL'])
    )
  })

  it('normalizes fixed hit points while preserving valid acquisition order, modifiers, and a floor', async () => {
    const context = createContext()
    context.registry.classes = [
      createHitpointClass('d6-class', 'd6'),
      createHitpointClass('d8-class', 'd8'),
      createHitpointClass('d10-class', 'd10'),
      createHitpointClass('d12-class', 'd12')
    ]
    const character = createCharacter()
    character.intent.classes = [
      { classId: 'd6-class', classLevel: 1 },
      { classId: 'd8-class', classLevel: 1 },
      { classId: 'd10-class', classLevel: 1 },
      { classId: 'd12-class', classLevel: 1 }
    ]
    character.intent.abilities = {
      method: 'MANUAL_ROLLED',
      state: { assignments: [{ ability: 'CONSTITUTION', score: 14 }] }
    }
    character.intent.hitpoints = {
      method: 'FIXED',
      levels: [
        { level: 99, classId: 'd12-class', classLevel: 1, value: 99 },
        { level: 98, classId: 'd6-class', classLevel: 1, value: 99 }
      ]
    }

    const reconciled = await reconcileCharacterBuilderCharacter(unusedDb, character, null, context)
    expect(reconciled.intent.hitpoints.levels).toEqual([
      { level: 1, classId: 'd6-class', classLevel: 1, value: 8 },
      { level: 2, classId: 'd12-class', classLevel: 1, value: 9 },
      { level: 3, classId: 'd8-class', classLevel: 1, value: 7 },
      { level: 4, classId: 'd10-class', classLevel: 1, value: 8 }
    ])

    const lowConstitution = structuredClone(character)
    lowConstitution.intent.classes = [{ classId: 'd6-class', classLevel: 2 }]
    lowConstitution.intent.abilities = {
      method: 'MANUAL_ROLLED',
      state: { assignments: [{ ability: 'CONSTITUTION', score: 1 }] }
    }

    const clamped = await reconcileCharacterBuilderCharacter(
      unusedDb,
      lowConstitution,
      null,
      context
    )
    expect(clamped.intent.hitpoints.levels.map((entry) => entry.value)).toEqual([1, 1])
  })

  it('normalizes fixed hit points from effective ability scores', async () => {
    const context = createContext()
    context.registry.system = createSystem()
    context.registry.races = [
      {
        id: 'human',
        label: 'Human',
        category: 'BASE',
        selectionMode: 'DIRECT',
        size: 'MEDIUM',
        speeds: [],
        userId: 'user-1',
        systemId: 'dnd5e2014',
        features: [
          {
            id: 'human-ability-score-increase',
            label: 'Ability Score Increase',
            description: 'Constitution increases by 1.',
            availableAtLevel: 1,
            order: 0,
            grants: {
              modifiers: [
                {
                  id: 'human-constitution-plus-one',
                  grantKind: GRANT_KIND.MODIFIER_GRANT,
                  valueDomainCode: 'ABILITY_SCORE',
                  domain: { ability: 'CONSTITUTION' },
                  modifierKind: 'BONUS',
                  scope: 'GLOBAL',
                  selectionKind: 'GRANTED',
                  payload: { valueKind: 'FIXED', amount: 1 },
                  order: 0
                }
              ]
            }
          }
        ]
      }
    ]
    context.registry.classes = [createHitpointClass('fighter', 'd10')]

    const character = createCharacter()
    character.intent.race = { raceId: 'human' }
    character.intent.classes = [{ classId: 'fighter', classLevel: 1 }]
    character.intent.abilities = {
      method: 'MANUAL_ROLLED',
      state: { assignments: [{ ability: 'CONSTITUTION', score: 13 }] }
    }
    character.intent.hitpoints = {
      method: 'FIXED',
      levels: [{ level: 1, classId: 'fighter', classLevel: 1, value: 12 }]
    }

    const reconciled = await reconcileCharacterBuilderCharacter(unusedDb, character, null, context)

    expect(reconciled.intent.hitpoints.levels).toEqual([
      { level: 1, classId: 'fighter', classLevel: 1, value: 12 }
    ])
    expect(reconciled.state.hitpoints.current).toBe(12)
  })

  it('preserves valid manual rolls and legacy overrides while calculating gained HP', async () => {
    const context = createContext()
    context.registry.classes = [createHitpointClass('fighter', 'd10')]
    const character = createCharacter()
    character.intent.classes = [{ classId: 'fighter', classLevel: 2 }]
    character.intent.abilities = {
      method: 'MANUAL_ROLLED',
      state: { assignments: [{ ability: 'CONSTITUTION', score: 14 }] }
    }
    character.intent.hitpoints = {
      method: 'MANUAL',
      levels: [
        { level: 1, classId: 'fighter', classLevel: 1, value: 1 },
        {
          level: 2,
          classId: 'fighter',
          classLevel: 2,
          value: 1,
          rolls: [{ die: 10, value: 7 }]
        }
      ]
    }

    const reconciled = await reconcileCharacterBuilderCharacter(unusedDb, character, null, context)
    expect(reconciled.intent.hitpoints.levels).toEqual([
      { level: 1, classId: 'fighter', classLevel: 1, value: 12 },
      {
        level: 2,
        classId: 'fighter',
        classLevel: 2,
        value: 9,
        rolls: [{ die: 10, value: 7 }],
        overridden: false
      }
    ])

    const legacy = structuredClone(character)
    legacy.intent.hitpoints.levels[1] = {
      level: 2,
      classId: 'fighter',
      classLevel: 2,
      value: 4
    }
    const existing = structuredClone(legacy)

    const preservedLegacy = await reconcileCharacterBuilderCharacter(
      unusedDb,
      legacy,
      existing,
      context
    )
    expect(preservedLegacy.intent.hitpoints.levels[1]).toEqual({
      level: 2,
      classId: 'fighter',
      classLevel: 2,
      value: 4,
      overridden: true
    })
  })

  it('preserves an active interleaved progression when a class gains another level', async () => {
    const context = createContext()
    context.registry.classes = [
      createHitpointClass('fighter', 'd10'),
      createHitpointClass('wizard', 'd6')
    ]
    const existing = createCharacter()
    existing.intent.classes = [
      { classId: 'fighter', classLevel: 1 },
      { classId: 'wizard', classLevel: 1 }
    ]
    existing.intent.hitpoints = {
      method: 'MANUAL',
      levels: [
        { level: 1, classId: 'fighter', classLevel: 1, value: 10 },
        {
          level: 2,
          classId: 'wizard',
          classLevel: 1,
          value: 4,
          rolls: [{ die: 6, value: 4 }],
          overridden: false
        }
      ]
    }
    const submitted = structuredClone(existing)
    submitted.intent.classes[0] = { classId: 'fighter', classLevel: 2 }
    submitted.intent.hitpoints.levels = [
      existing.intent.hitpoints.levels[0]!,
      { level: 2, classId: 'fighter', classLevel: 2, value: 6, rolls: [{ die: 10, value: 6 }] },
      { ...existing.intent.hitpoints.levels[1]!, level: 3 }
    ]

    const reconciled = await reconcileCharacterBuilderCharacter(
      unusedDb,
      submitted,
      existing,
      context
    )

    expect(
      reconciled.intent.hitpoints.levels.map(({ level, classId, classLevel }) => ({
        level,
        classId,
        classLevel
      }))
    ).toEqual([
      { level: 1, classId: 'fighter', classLevel: 1 },
      { level: 2, classId: 'wizard', classLevel: 1 },
      { level: 3, classId: 'fighter', classLevel: 2 }
    ])
    expect(reconciled.intent.hitpoints.levels[1]?.rolls).toEqual([{ die: 6, value: 4 }])
  })
})
