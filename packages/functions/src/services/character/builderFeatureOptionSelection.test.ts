import { beforeEach, describe, expect, it, vi } from 'vitest'

import { CLASS_CATEGORY, RACE_CATEGORY_CODE } from '@artificer-toolkit/shared/core'
import type { ClassAuthored } from '@artificer-toolkit/shared/subjects/authored'

import type { CharacterBuilderRegistry } from './builderService.js'

const repositoryState = vi.hoisted(() => ({
  races: [] as CharacterBuilderRegistry['races'],
  classes: [] as ClassAuthored[]
}))

vi.mock('@artificer-toolkit/db', () => ({
  createSystemRepository: () => ({ findById: async () => null }),
  createRaceRepository: () => ({
    findResolvedAll: async () => repositoryState.races,
    findResolvedById: async (id: string) =>
      repositoryState.races.find((record) => record.id === id) ?? null
  }),
  createClassRepository: () => ({
    findByIds: async (ids: readonly string[]) =>
      new Map(
        repositoryState.classes
          .filter((record) => ids.includes(record.id))
          .map((record) => [record.id, record])
      )
  }),
  createBackgroundRepository: () => ({ findByIds: async () => new Map() }),
  createEquipmentRepository: () => ({ findResolvedById: async () => null }),
  createFeatRepository: () => ({ findByIds: async () => new Map() }),
  createFeatureRepository: () => ({ findByIds: async () => new Map() }),
  getCharacterAssemblyStructureQuery: async () => ({
    rootFeatureLinks: [],
    ancestryOptions: [],
    featureOptions: [],
    featureOptionChoices: []
  }),
  getRaceListQuery: async () => ({
    items: repositoryState.races.map((record) => ({
      id: record.id,
      label: record.label,
      category: record.category,
      parentRaceId: record.category === RACE_CATEGORY_CODE.SUBRACE ? record.parentRaceId : null
    })),
    meta: { categories: [], selectionModes: [], parentRaces: [], features: [] }
  }),
  getClassListQuery: async () => ({
    items: repositoryState.classes.map((record) => ({
      id: record.id,
      label: record.label,
      category: record.category,
      parentClassId: 'parentClassId' in record ? (record.parentClassId ?? null) : null,
      subclassSelectionLevel:
        'subclassSelectionLevel' in record ? (record.subclassSelectionLevel ?? null) : null
    })),
    meta: { categories: [], parentClasses: [], multiclass: [], features: [] }
  }),
  getBackgroundListQuery: async () => ({ items: [], meta: { features: [] } }),
  getEquipmentListQuery: async () => ({
    items: [],
    meta: { categories: [], rarities: [], properties: [], features: [] }
  }),
  getFeatListQuery: async () => ({ items: [], meta: { features: [] } }),
  getSpellListQuery: async () => ({
    items: [],
    meta: { attributes: [], classes: [], schools: [], levels: [], castingTimeUnits: [] }
  })
}))

import { createEmptyCharacterAuthored, resolveCharacterBuilder } from './builderService.js'

const FEATURE_ID = 'half-elf-ability-score-increase'

function createFighter(): Extract<ClassAuthored, { category: typeof CLASS_CATEGORY.BASE }> {
  return {
    id: 'fighter',
    label: 'Fighter',
    category: CLASS_CATEGORY.BASE,
    userId: 'user-1',
    systemId: 'system-1',
    startingGold: { multiplier: 5, currencyId: 'gp', dieConfig: '5d4' },
    startingEquipment: { id: 'fighter-equipment', sets: [] },
    hitpoint: { ability: 'CONSTITUTION', dieConfig: '1d10' },
    multiclass: { id: 'fighter-multiclass', requirementGroups: { groups: [] } }
  }
}

function createHalfElf(): CharacterBuilderRegistry['races'][number] {
  return {
    id: 'half-elf',
    label: 'Half-Elf',
    category: RACE_CATEGORY_CODE.BASE,
    selectionMode: 'DIRECT',
    size: 'MEDIUM',
    speeds: [],
    userId: 'user-1',
    systemId: 'system-1',
    features: [
      {
        id: FEATURE_ID,
        label: 'Ability Score Increase',
        description: 'Choose two different ability scores.',
        availableAtLevel: 1,
        order: 0,
        optionChoices: [{ level: 1, count: 2 }],
        options: [
          { id: 'strength', label: 'Strength', description: '', order: 0 },
          { id: 'dexterity', label: 'Dexterity', description: '', order: 1 },
          { id: 'constitution', label: 'Constitution', description: '', order: 2 }
        ]
      }
    ]
  } as CharacterBuilderRegistry['races'][number]
}

function createCharacter(selectedOptionIds: string[]) {
  const character = createEmptyCharacterAuthored({
    id: 'character-1',
    systemId: 'system-1',
    userId: 'user-1'
  })
  character.intent.race = { raceId: 'half-elf' }
  character.intent.classes = [{ classId: 'fighter', classLevel: 1 }]
  character.intent.hitpoints.levels = [{ level: 1, classId: 'fighter', classLevel: 1, value: 10 }]
  character.intent.featureAcquisitions = [
    {
      id: 'half-elf-ability-choice',
      featureId: FEATURE_ID,
      source: { kind: 'RACE', raceId: 'half-elf' },
      timing: { kind: 'CHARACTER_LEVEL', level: 1 },
      selections: [
        {
          selectionKey: 'options',
          values: [{ kind: 'IDS', ids: selectedOptionIds }]
        }
      ]
    }
  ]
  return character
}

describe('character Builder feature option selection', () => {
  beforeEach(() => {
    repositoryState.races = [createHalfElf()]
    repositoryState.classes = [createFighter()]
  })

  it.each([
    {
      label: 'duplicate options',
      optionIds: ['strength', 'strength'],
      code: 'FEATURE_SELECTION_DUPLICATE'
    },
    {
      label: 'an option outside the feature',
      optionIds: ['strength', 'charisma'],
      code: 'FEATURE_SELECTION_INVALID'
    },
    {
      label: 'too many options',
      optionIds: ['strength', 'dexterity', 'constitution'],
      code: 'FEATURE_SELECTION_OVER_LIMIT'
    }
  ])('blocks $label', async ({ optionIds, code }) => {
    const resolution = await resolveCharacterBuilder(
      {} as never,
      createCharacter(optionIds),
      'create'
    )

    expect(resolution.validations).toContainEqual(
      expect.objectContaining({
        code,
        severity: 'blocking'
      })
    )
    expect(resolution.readiness.ready).toBe(false)
  })

  it('accepts the required number of distinct feature options', async () => {
    const resolution = await resolveCharacterBuilder(
      {} as never,
      createCharacter(['strength', 'dexterity']),
      'create'
    )

    expect(resolution.validations.map((issue) => issue.code)).not.toContainEqual(
      expect.stringMatching(/^FEATURE_SELECTION_/)
    )
    expect(resolution.outstandingChoices.map((issue) => issue.code)).not.toContain(
      'FEATURE_SELECTION_INCOMPLETE'
    )
  })
})
