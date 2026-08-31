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
  GRANT_KIND,
  SCALING
} from '@artificer-toolkit/shared/core'
import type { CharacterAuthored } from '@artificer-toolkit/shared/subjects/authored'
import {
  createEmptyCharacterAuthored,
  resolveCharacterBuilder,
  type CharacterBuilderContext,
  type CharacterBuilderRegistry
} from './builderService.js'
import {
  getInvalidSpellSelectionIds,
  type CharacterSpellChoiceRequirement
} from './builderSpellSelection.js'
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
      primaryRulesCatalogueId: '00000000-0000-4000-8000-000000000301',
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
})
