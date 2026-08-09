import { describe, expect, it } from 'vitest'
import {
  DummyDriver,
  Kysely,
  PostgresAdapter,
  PostgresIntrospector,
  PostgresQueryCompiler
} from 'kysely'

import type { Database } from '@artificer-toolkit/db'
import {
  AUTHORING_MODE_KIND,
  AUTHORING_SELECTION_DUPLICATE_POLICY,
  AUTHORING_SELECTION_KIND,
  AUTHORED_RECORD_STATUS,
  GRANT_KIND,
  SCALING
} from '@artificer-toolkit/shared/core'
import {
  CharacterStartingEquipmentSource,
  type CharacterAuthored
} from '@artificer-toolkit/shared/subjects/authored'
import type { StartingEquipmentAuthored } from '@artificer-toolkit/shared/authored'

import {
  createCharacterBuilderChangePreview,
  createEmptyCharacterAuthored,
  getInvalidSpellSelectionIds,
  isCharacterHitpointProgressionValid,
  isCharacterBuilderProvenanceStillValid,
  isStartingEquipmentDecisionComplete,
  reconcileCharacterBuilderCharacter,
  reconcileCharacterHitDice,
  reconcileCharacterHitpointProgression,
  resolveCharacterBuilder,
  resolveRecommendedCharacterBuilderSection,
  type CharacterBuilderIssue,
  type CharacterBuilderContext,
  type CharacterBuilderRegistry,
  type CharacterSpellChoiceRequirement
} from './builderService.js'
import type { CharacterBuilderCatalog } from './builderCatalog.js'

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
        ancestry: {
          id: 'draconic-ancestry',
          label: 'Draconic Ancestry',
          options: [
            {
              id: 'red',
              label: 'Red'
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

function createChoiceStartingEquipment(count = 1): StartingEquipmentAuthored {
  return {
    id: 'fighter-start',
    sets: [
      {
        id: 'fighter-set',
        order: 1,
        groups: [
          {
            id: 'fighter-group',
            order: 1,
            options: [
              {
                id: 'fighter-option',
                order: 1,
                items: [
                  {
                    id: 'martial-weapon-choice',
                    order: 1,
                    startingEquipmentKind: 'EQUIPMENT',
                    category: 'WEAPON',
                    selectionKind: 'CHOSEN',
                    count,
                    authoringModeKind: 'SELECTED',
                    equipmentIds: ['longsword']
                  }
                ]
              }
            ]
          }
        ]
      }
    ]
  }
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

describe('resolveRecommendedCharacterBuilderSection', () => {
  it('sends active edit mode to Basics', () => {
    const character = createCharacter({
      status: AUTHORED_RECORD_STATUS.ACTIVE,
      label: 'Aelar'
    })

    const section = resolveRecommendedCharacterBuilderSection(
      character,
      'edit',
      {
        totalLevel: 1,
        abilities: {
          STRENGTH: 10,
          DEXTERITY: 10,
          CONSTITUTION: 10,
          INTELLIGENCE: 10,
          WISDOM: 10,
          CHARISMA: 10
        },
        classes: []
      },
      [],
      []
    )

    expect(section).toBe('BASICS')
  })

  it('sends draft equipment blockers to Equipment', () => {
    const character = createCharacter({
      label: 'Aelar',
      intent: {
        ...createCharacter().intent,
        race: { raceId: 'dragonborn' },
        background: { backgroundId: 'sage' },
        classes: [{ classId: 'wizard', classLevel: 1 }],
        abilities: {
          method: 'STANDARD_ARRAY',
          assignments: [
            { ability: 'STRENGTH', option: '8' },
            { ability: 'DEXTERITY', option: '10' },
            { ability: 'CONSTITUTION', option: '12' },
            { ability: 'INTELLIGENCE', option: '15' },
            { ability: 'WISDOM', option: '14' },
            { ability: 'CHARISMA', option: '13' }
          ]
        },
        hitpoints: {
          method: 'FIXED',
          levels: [{ level: 1, classId: 'wizard', classLevel: 1, value: 6 }]
        }
      }
    })

    const section = resolveRecommendedCharacterBuilderSection(
      character,
      'create',
      {
        totalLevel: 1,
        abilities: {
          STRENGTH: 8,
          DEXTERITY: 10,
          CONSTITUTION: 12,
          INTELLIGENCE: 15,
          WISDOM: 14,
          CHARISMA: 13
        },
        classes: [
          {
            classId: 'wizard',
            classLabel: 'Wizard',
            classLevel: 1,
            featureLabels: [],
            resourceLabels: [],
            spellcastingLabels: []
          }
        ]
      },
      [],
      [
        {
          code: 'CLASS_STARTING_EQUIPMENT_REQUIRED',
          message: 'Wizard has starting equipment choices to resolve.',
          sourceLabel: 'Wizard',
          required: true
        }
      ] satisfies CharacterBuilderIssue[]
    )

    expect(section).toBe('EQUIPMENT')
  })

  it('sends source-local feature blockers to the owning step', () => {
    const character = createCharacter({
      label: 'Aelar',
      intent: {
        ...createCharacter().intent,
        race: { raceId: 'dragonborn' },
        background: { backgroundId: 'sage' },
        classes: [{ classId: 'wizard', classLevel: 1 }],
        abilities: {
          method: 'STANDARD_ARRAY',
          assignments: [
            { ability: 'STRENGTH', option: '8' },
            { ability: 'DEXTERITY', option: '10' },
            { ability: 'CONSTITUTION', option: '12' },
            { ability: 'INTELLIGENCE', option: '15' },
            { ability: 'WISDOM', option: '14' },
            { ability: 'CHARISMA', option: '13' }
          ]
        },
        hitpoints: {
          method: 'FIXED',
          levels: [{ level: 1, classId: 'wizard', classLevel: 1, value: 6 }]
        }
      }
    })

    const section = resolveRecommendedCharacterBuilderSection(
      character,
      'create',
      {
        totalLevel: 1,
        abilities: {
          STRENGTH: 8,
          DEXTERITY: 10,
          CONSTITUTION: 12,
          INTELLIGENCE: 15,
          WISDOM: 14,
          CHARISMA: 13
        },
        classes: [
          {
            classId: 'wizard',
            classLabel: 'Wizard',
            classLevel: 1,
            featureLabels: [],
            resourceLabels: [],
            spellcastingLabels: []
          }
        ]
      },
      [],
      [
        {
          code: 'FEATURE_SELECTION_REQUIRED',
          message: 'Arcane Recovery requires a selection.',
          sourceLabel: 'Wizard',
          source: { kind: 'CLASS', classId: 'wizard', classLevel: 1 },
          required: true
        }
      ] satisfies CharacterBuilderIssue[]
    )

    expect(section).toBe('CLASSES')
  })

  it('sends class spell selection blockers to Classes', () => {
    const character = createCharacter({
      label: 'Aelar',
      intent: {
        ...createCharacter().intent,
        race: { raceId: 'dragonborn' },
        background: { backgroundId: 'sage' },
        classes: [{ classId: 'wizard', classLevel: 1 }],
        abilities: {
          method: 'STANDARD_ARRAY',
          assignments: [
            { ability: 'STRENGTH', option: '8' },
            { ability: 'DEXTERITY', option: '10' },
            { ability: 'CONSTITUTION', option: '12' },
            { ability: 'INTELLIGENCE', option: '15' },
            { ability: 'WISDOM', option: '14' },
            { ability: 'CHARISMA', option: '13' }
          ]
        },
        hitpoints: {
          method: 'FIXED',
          levels: [{ level: 1, classId: 'wizard', classLevel: 1, value: 6 }]
        }
      }
    })

    const section = resolveRecommendedCharacterBuilderSection(
      character,
      'create',
      {
        totalLevel: 1,
        abilities: {
          STRENGTH: 8,
          DEXTERITY: 10,
          CONSTITUTION: 12,
          INTELLIGENCE: 15,
          WISDOM: 14,
          CHARISMA: 13
        },
        classes: [
          {
            classId: 'wizard',
            classLabel: 'Wizard',
            classLevel: 1,
            featureLabels: [],
            resourceLabels: [],
            spellcastingLabels: []
          }
        ]
      },
      [],
      [
        {
          code: 'SPELL_SELECTION_REQUIRED',
          message: 'Wizard Spellcasting requires spell selections.',
          sourceLabel: 'Wizard',
          source: { kind: 'CLASS', classId: 'wizard', classLevel: 1 },
          required: true
        }
      ] satisfies CharacterBuilderIssue[]
    )

    expect(section).toBe('CLASSES')

    const overLimitSection = resolveRecommendedCharacterBuilderSection(
      character,
      'create',
      {
        totalLevel: 1,
        abilities: {
          STRENGTH: 8,
          DEXTERITY: 10,
          CONSTITUTION: 12,
          INTELLIGENCE: 15,
          WISDOM: 14,
          CHARISMA: 13
        },
        classes: [
          {
            classId: 'wizard',
            classLabel: 'Wizard',
            classLevel: 1,
            featureLabels: [],
            resourceLabels: [],
            spellcastingLabels: []
          }
        ]
      },
      [],
      [
        {
          code: 'SPELL_SELECTION_OVER_LIMIT',
          message: 'Wizard Spellcasting has too many selected spells for the current class level.',
          sourceLabel: 'Wizard',
          source: { kind: 'CLASS', classId: 'wizard', classLevel: 1 },
          required: true
        }
      ] satisfies CharacterBuilderIssue[]
    )

    expect(overLimitSection).toBe('CLASSES')
  })
})

describe('character builder source-local choice validation', () => {
  it('blocks duplicate spell selections across distinct sources and labels the spell', async () => {
    const context = createContext()
    context.registry.races = [
      {
        ...context.registry.races[0]!,
        features: [
          {
            id: 'race-spell-feature',
            label: 'Innate Magic',
            description: '',
            availableAtLevel: 1,
            order: 0,
            grants: {
              spells: [
                {
                  id: 'race-spell-grant',
                  grantKind: GRANT_KIND.SPELL_GRANT,
                  selectionKind: AUTHORING_SELECTION_KIND.CHOSEN,
                  selectionDuplicatePolicy: AUTHORING_SELECTION_DUPLICATE_POLICY.UNIQUE,
                  scalingKind: SCALING.NONE,
                  authoringModeKind: AUTHORING_MODE_KIND.ALL,
                  count: 1,
                  order: 0
                }
              ]
            }
          }
        ]
      } as CharacterBuilderRegistry['races'][number]
    ]
    const character = createCharacter()
    character.intent.race = { raceId: 'dragonborn' }
    character.intent.chosenGrantSelections = [
      {
        id: 'race-spell-selection',
        grantId: 'race-spell-grant',
        source: { kind: 'RACE', raceId: 'dragonborn' },
        timing: { kind: 'IMMEDIATE' },
        targetIds: ['magic-missile']
      }
    ]
    character.intent.spellSelections = [
      {
        id: 'background-spell-selection',
        source: { kind: 'FEATURE', featureId: 'background-spell-feature' },
        timing: { kind: 'IMMEDIATE' },
        spells: ['magic-missile']
      }
    ]

    const resolution = await resolveCharacterBuilder(unusedDb, character, 'create', context)

    expect(resolution.validations).toContainEqual({
      code: 'DUPLICATE_SPELL_SELECTION',
      severity: 'blocking',
      message: 'Spell selection "Magic Missile" is selected by multiple sources.'
    })
    expect(resolution.readiness.ready).toBe(false)
  })

  it('does not report a duplicate spell selection when the source is the same', async () => {
    const context = createContext()
    context.registry.races = [
      {
        ...context.registry.races[0]!,
        features: [
          {
            id: 'race-spell-feature',
            label: 'Innate Magic',
            description: '',
            availableAtLevel: 1,
            order: 0,
            grants: {
              spells: [
                {
                  id: 'race-spell-grant',
                  grantKind: GRANT_KIND.SPELL_GRANT,
                  selectionKind: AUTHORING_SELECTION_KIND.CHOSEN,
                  selectionDuplicatePolicy: AUTHORING_SELECTION_DUPLICATE_POLICY.UNIQUE,
                  scalingKind: SCALING.NONE,
                  authoringModeKind: AUTHORING_MODE_KIND.ALL,
                  count: 1,
                  order: 0
                }
              ]
            }
          }
        ]
      } as CharacterBuilderRegistry['races'][number]
    ]
    const character = createCharacter()
    character.intent.race = { raceId: 'dragonborn' }
    character.intent.spellSelections = [
      {
        id: 'race-spell-selection',
        source: { kind: 'FEATURE', featureId: 'race-spell-feature' },
        timing: { kind: 'IMMEDIATE' },
        spells: ['magic-missile']
      },
      {
        id: 'race-spell-selection-copy',
        source: { kind: 'FEATURE', featureId: 'race-spell-feature' },
        timing: { kind: 'IMMEDIATE' },
        spells: ['magic-missile']
      }
    ]

    const resolution = await resolveCharacterBuilder(unusedDb, character, 'create', context)

    expect(resolution.validations.some((issue) => issue.code === 'DUPLICATE_SPELL_SELECTION')).toBe(
      false
    )
  })

  it('rejects class spell selections outside the allowed class and spell level', () => {
    const catalog = createCatalog()
    catalog.spells = [
      {
        id: 'magic-missile',
        label: 'Magic Missile',
        description: '',
        level: 1,
        classIds: ['wizard'],
        magicSchoolId: 'evocation',
        castingTime: { unit: 'ROUND', amount: 1 }
      },
      {
        id: 'cure-wounds',
        label: 'Cure Wounds',
        description: '',
        level: 1,
        classIds: ['cleric'],
        magicSchoolId: 'evocation',
        castingTime: { unit: 'ROUND', amount: 1 }
      },
      {
        id: 'fireball',
        label: 'Fireball',
        description: '',
        level: 3,
        classIds: ['wizard'],
        magicSchoolId: 'evocation',
        castingTime: { unit: 'ROUND', amount: 1 }
      }
    ]

    const requirement: CharacterSpellChoiceRequirement = {
      label: 'Wizard Spellcasting',
      sourceLabel: 'Wizard',
      source: { kind: 'CLASS', classId: 'wizard', classLevel: 1 },
      cantripLimit: 0,
      learnedSpellLimit: 1,
      maxSpellLevel: 1,
      allowedClassIds: ['wizard'],
      allowedSpellIds: ['cure-wounds']
    }

    expect(
      getInvalidSpellSelectionIds(
        {
          id: 'wizard-spells',
          source: requirement.source,
          timing: { kind: 'CLASS_LEVEL', classId: 'wizard', classLevel: 1 },
          spells: ['magic-missile', 'cure-wounds', 'fireball']
        },
        requirement,
        catalog
      )
    ).toEqual(['fireball'])
  })

  it('rejects starting equipment selections outside the chosen item allow-list', () => {
    const catalog = createCatalog()
    catalog.equipment = [
      {
        id: 'longsword',
        label: 'Longsword',
        category: 'WEAPON',
        isContainer: false,
        properties: ['MARTIAL'],
        requiresAttunement: false
      },
      {
        id: 'dagger',
        label: 'Dagger',
        category: 'WEAPON',
        isContainer: false,
        properties: ['SIMPLE'],
        requiresAttunement: false
      }
    ]
    const startingEquipment = createChoiceStartingEquipment()
    const validDecision = {
      source: CharacterStartingEquipmentSource.CLASS,
      tookGold: false,
      groups: [
        {
          groupId: 'fighter-group',
          optionId: 'fighter-option',
          selections: [
            {
              selectionKey: 'martial-weapon-choice',
              equipmentId: 'longsword',
              quantity: 1
            }
          ]
        }
      ]
    }
    const invalidDecision = {
      ...validDecision,
      groups: [
        {
          groupId: 'fighter-group',
          optionId: 'fighter-option',
          selections: [
            {
              selectionKey: 'martial-weapon-choice',
              equipmentId: 'dagger',
              quantity: 1
            }
          ]
        }
      ]
    }

    expect(isStartingEquipmentDecisionComplete(startingEquipment, validDecision, catalog)).toBe(
      true
    )
    expect(isStartingEquipmentDecisionComplete(startingEquipment, invalidDecision, catalog)).toBe(
      false
    )
  })

  it('accepts chosen starting equipment represented as a single row with matching quantity', () => {
    const catalog = createCatalog()
    catalog.equipment = [
      {
        id: 'longsword',
        label: 'Longsword',
        category: 'WEAPON',
        isContainer: false,
        properties: ['MARTIAL'],
        requiresAttunement: false
      }
    ]
    const startingEquipment = createChoiceStartingEquipment(2)

    expect(
      isStartingEquipmentDecisionComplete(
        startingEquipment,
        {
          source: CharacterStartingEquipmentSource.CLASS,
          tookGold: false,
          groups: [
            {
              groupId: 'fighter-group',
              optionId: 'fighter-option',
              selections: [
                {
                  selectionKey: 'martial-weapon-choice',
                  equipmentId: 'longsword',
                  quantity: 2
                }
              ]
            }
          ]
        },
        catalog
      )
    ).toBe(true)
  })

  it('requires a concrete total when starting gold is selected', () => {
    const catalog = createCatalog()
    const startingEquipment = createChoiceStartingEquipment()
    const incompleteGoldDecision = {
      source: CharacterStartingEquipmentSource.CLASS,
      tookGold: true,
      gold: {
        goldOption: '5d4',
        totalGold: 0
      }
    }
    const completeGoldDecision = {
      ...incompleteGoldDecision,
      gold: {
        goldOption: '5d4',
        totalGold: 120
      }
    }

    expect(
      isStartingEquipmentDecisionComplete(startingEquipment, incompleteGoldDecision, catalog)
    ).toBe(false)
    expect(
      isStartingEquipmentDecisionComplete(startingEquipment, completeGoldDecision, catalog)
    ).toBe(true)
  })
})

describe('isCharacterBuilderProvenanceStillValid', () => {
  it('rejects class and subclass provenance above the current class level', () => {
    const registry = createRegistry()
    const character = createCharacter({
      intent: {
        ...createCharacter().intent,
        classes: [
          {
            classId: 'wizard',
            classLevel: 2,
            subclassId: 'evoker'
          }
        ]
      }
    })

    expect(
      isCharacterBuilderProvenanceStillValid({
        source: { kind: 'CLASS', classId: 'wizard', classLevel: 2 },
        character,
        registry
      })
    ).toBe(true)
    expect(
      isCharacterBuilderProvenanceStillValid({
        source: { kind: 'CLASS', classId: 'wizard', classLevel: 3 },
        character,
        registry
      })
    ).toBe(false)
    expect(
      isCharacterBuilderProvenanceStillValid({
        source: { kind: 'SUBCLASS', subclassId: 'evoker', classLevel: 3 },
        character,
        registry
      })
    ).toBe(false)
  })

  it('rejects ancestry provenance that is not the current ancestry option', () => {
    const registry = createRegistry()
    registry.races[0]?.ancestry?.options.push({
      id: 'blue',
      label: 'Blue',
      description: 'Blue ancestry.',
      order: 2
    })
    const character = createCharacter({
      intent: {
        ...createCharacter().intent,
        race: { raceId: 'dragonborn' },
        ancestrySelections: [
          {
            id: 'ancestry-1',
            ancestryId: 'draconic-ancestry',
            optionId: 'blue',
            source: { kind: 'RACE', raceId: 'dragonborn' },
            timing: { kind: 'IMMEDIATE' }
          }
        ]
      }
    })

    expect(
      isCharacterBuilderProvenanceStillValid({
        source: { kind: 'ANCESTRY', ancestryId: 'draconic-ancestry', optionId: 'blue' },
        character,
        registry
      })
    ).toBe(true)
    expect(
      isCharacterBuilderProvenanceStillValid({
        source: { kind: 'ANCESTRY', ancestryId: 'draconic-ancestry', optionId: 'red' },
        character,
        registry
      })
    ).toBe(false)
  })

  it('rejects ancestry provenance when the selected ancestry source is stale', () => {
    const registry = createRegistry()
    const character = createCharacter({
      intent: {
        ...createCharacter().intent,
        race: { raceId: 'dragonborn' },
        ancestrySelections: [
          {
            id: 'ancestry-1',
            ancestryId: 'draconic-ancestry',
            optionId: 'red',
            source: { kind: 'SUBRACE', subraceId: 'sea-elf' },
            timing: { kind: 'IMMEDIATE' }
          }
        ]
      }
    })

    expect(
      isCharacterBuilderProvenanceStillValid({
        source: { kind: 'ANCESTRY', ancestryId: 'draconic-ancestry', optionId: 'red' },
        character,
        registry
      })
    ).toBe(false)
  })

  it('falls back to base-race ancestry when the selected subrace has none', () => {
    const registry = createRegistry()
    registry.races.push({
      id: 'dragonborn-variant',
      label: 'Dragonborn Variant',
      category: 'SUBRACE',
      parentRaceId: 'dragonborn',
      size: 'MEDIUM',
      speeds: [],
      systemId: 'dnd5e2014',
      userId: 'user-1',
      subrace: {
        parentRaceId: 'dragonborn',
        parentLabel: 'Dragonborn',
        inherited: { size: 'MEDIUM', speeds: [] }
      }
    })
    const character = createCharacter({
      intent: {
        ...createCharacter().intent,
        race: { raceId: 'dragonborn', subraceId: 'dragonborn-variant' },
        ancestrySelections: [
          {
            id: 'ancestry-1',
            ancestryId: 'draconic-ancestry',
            optionId: 'red',
            source: { kind: 'RACE', raceId: 'dragonborn' },
            timing: { kind: 'IMMEDIATE' }
          }
        ]
      }
    })

    expect(
      isCharacterBuilderProvenanceStillValid({
        source: { kind: 'ANCESTRY', ancestryId: 'draconic-ancestry', optionId: 'red' },
        character,
        registry
      })
    ).toBe(true)
  })
})

describe('createCharacterBuilderChangePreview', () => {
  it('summarizes removed dependent selections and status downgrades', () => {
    const previous = createCharacter({
      label: 'Aelar',
      status: AUTHORED_RECORD_STATUS.ACTIVE
    })
    previous.intent.ancestrySelections = [
      {
        id: 'ancestry-1',
        ancestryId: 'draconic-ancestry',
        optionId: 'red',
        source: { kind: 'RACE', raceId: 'dragonborn' },
        timing: { kind: 'IMMEDIATE' }
      }
    ]
    previous.intent.featureAcquisitions = [
      {
        id: 'feature-acquisition-1',
        featureId: 'arcane-recovery',
        source: { kind: 'CLASS', classId: 'wizard', classLevel: 1 },
        timing: { kind: 'IMMEDIATE' }
      }
    ]
    previous.intent.spellSelections = [
      {
        id: 'spell-selection-1',
        source: { kind: 'CLASS', classId: 'wizard', classLevel: 1 },
        timing: { kind: 'IMMEDIATE' },
        spells: ['magic-missile']
      }
    ]
    previous.intent.resourceGrants = [
      {
        id: 'resource-grant-1',
        resourceId: 'arcane-recovery-pool',
        source: { kind: 'CLASS', classId: 'wizard', classLevel: 1 },
        timing: { kind: 'IMMEDIATE' }
      }
    ]
    previous.intent.startingEquipment = {
      class: {
        source: CharacterStartingEquipmentSource.CLASS,
        tookGold: false
      }
    }

    const next = structuredClone(previous)
    next.status = AUTHORED_RECORD_STATUS.DRAFT
    next.intent.ancestrySelections = undefined
    next.intent.featureAcquisitions = []
    next.intent.spellSelections = undefined
    next.intent.resourceGrants = undefined
    next.intent.startingEquipment = undefined

    const preview = createCharacterBuilderChangePreview({
      previousCharacter: previous,
      nextCharacter: next,
      predictedStatus: AUTHORED_RECORD_STATUS.DRAFT,
      context: createContext()
    })

    expect(preview.downgradesStatus).toBe(true)
    expect(preview.removedAncestrySelections.map((entry) => entry.label)).toEqual([
      'Draconic Ancestry: Red'
    ])
    expect(preview.removedFeatureAcquisitions.map((entry) => entry.label)).toEqual([
      'Arcane Recovery'
    ])
    expect(preview.removedSpellSelections.map((entry) => entry.label)).toEqual(['Magic Missile'])
    expect(preview.removedResourceGrants.map((entry) => entry.label)).toEqual([
      'arcane-recovery-pool'
    ])
    expect(preview.clearedStartingEquipmentSources).toEqual([
      CharacterStartingEquipmentSource.CLASS
    ])
    expect(preview.summaryLines).toContain(
      'This save will move the character back to Draft until the build is complete again.'
    )
    expect(preview.destructive).toBe(true)
  })
})
