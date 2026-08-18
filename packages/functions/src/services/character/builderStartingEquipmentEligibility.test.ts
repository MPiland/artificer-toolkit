import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { DBLike } from '@artificer-toolkit/db'
import {
  CharacterStartingEquipmentSource,
  type ClassAuthored
} from '@artificer-toolkit/shared/subjects/authored'

import type { CharacterBuilderRegistry } from './builderService.js'

const repositoryState = vi.hoisted(() => ({
  classes: [] as ClassAuthored[],
  equipment: [] as CharacterBuilderRegistry['equipment'],
  races: [] as CharacterBuilderRegistry['races']
}))

vi.mock('@artificer-toolkit/db', () => ({
  createCampaignContentRepository: () => ({ findAssignedCampaign: async () => null }),
  createAuthoredVersionRepository: () => ({
    findActiveByIds: async ({ subjectIds, subjectKind }: { subjectIds: readonly string[]; subjectKind: string }) => {
      const records =
        subjectKind === 'RACE'
          ? repositoryState.races
          : subjectKind === 'CLASS'
            ? repositoryState.classes
            : subjectKind === 'EQUIPMENT'
              ? repositoryState.equipment
              : []
      return new Map(
        records
          .filter((record) => subjectIds.includes(record.id))
          .map((record) => [
            record.id,
            {
              authored: { document: record },
              compiled: {
                authoredDependencies:
                  'parentRaceId' in record && typeof record.parentRaceId === 'string'
                    ? [
                        {
                          subjectKind: 'RACE',
                          subjectId: record.parentRaceId,
                          versionId: `${record.parentRaceId}-version`,
                          version: 1,
                          checksum: 'a'.repeat(64)
                        }
                      ]
                    : []
              }
            }
          ])
      )
    },
    findExactVersions: async ({ entries }: { entries: readonly { subjectId: string; subjectKind: string }[] }) => {
      const records = [...repositoryState.races, ...repositoryState.equipment]
      return new Map(
        entries.flatMap((entry) => {
          const record = records.find((candidate) => candidate.id === entry.subjectId)
          return record
            ? [[`${entry.subjectKind}:${entry.subjectId}`, { authored: { document: record }, compiled: { authoredDependencies: [] } }] as const]
            : []
        })
      )
    }
  }),
  createSystemRepository: () => ({ findById: async () => createSystem() }),
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
  createEquipmentRepository: () => ({
    findResolvedById: async (id: string) =>
      repositoryState.equipment.find((record) => record.id === id) ?? null
  }),
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
      parentRaceId: record.category === 'SUBRACE' ? record.parentRaceId : null
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
    items: repositoryState.equipment.map((record) => ({
      id: record.id,
      label: record.label,
      category: record.category,
      capacityAmount: record.capacity?.amount ?? null,
      properties: record.properties,
      requiresAttunement: record.requiresAttunement
    })),
    meta: { categories: [], rarities: [], properties: [], features: [] }
  }),
  getFeatListQuery: async () => ({ items: [], meta: { features: [] } }),
  getSpellListQuery: async () => ({
    items: [],
    meta: { attributes: [], classes: [], schools: [], levels: [], castingTimeUnits: [] }
  })
}))

vi.mock('./characterRuleEvaluation.js', async () => {
  const { evaluateCharacterBuilderTestPolicy } =
    await import('./characterBuilderRuleEvaluation.testUtils.js')
  return { evaluateCharacterRulePolicy: evaluateCharacterBuilderTestPolicy }
})

import { createEmptyCharacterAuthored, resolveCharacterBuilder } from './builderService.js'
import { reconcileCharacterBuilderCharacter } from './builderReconciliation.js'

function createSystem(): NonNullable<CharacterBuilderRegistry['system']> {
  return {
    id: 'system-1',
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

function createEquipment(
  id: string,
  label: string,
  properties: CharacterBuilderRegistry['equipment'][number]['properties']
): CharacterBuilderRegistry['equipment'][number] {
  return {
    kind: 'EQUIPMENT',
    id,
    label,
    description: null,
    status: 'ACTIVE',
    category: 'ARMOR',
    properties,
    weight: { amount: 0, unit: 'POUNDS' },
    rarityId: 'COMMON',
    systemId: 'system-1',
    userId: 'user-1'
  }
}

function createCleric(): Extract<ClassAuthored, { category: 'BASE' }> {
  return {
    id: 'cleric',
    label: 'Cleric',
    category: 'BASE',
    subclassSelectionLevel: 1,
    userId: 'user-1',
    systemId: 'system-1',
    startingGold: { multiplier: 10, currencyId: 'gp', dieConfig: '5d4' },
    startingEquipment: {
      id: 'cleric-equipment',
      sets: [
        {
          id: 'cleric-set',
          order: 1,
          groups: [
            {
              id: 'armor-group',
              order: 1,
              options: [
                {
                  id: 'leather-option',
                  order: 1,
                  items: [
                    {
                      id: 'leather-item',
                      order: 1,
                      startingEquipmentKind: 'EQUIPMENT',
                      selectionKind: 'GRANTED',
                      authoringModeKind: 'SELECTED',
                      equipmentIds: ['leather'],
                      quantity: 1
                    }
                  ]
                },
                {
                  id: 'chain-option',
                  order: 2,
                  eligibility: {
                    id: 'chain-eligibility',
                    groups: [
                      {
                        id: 'chain-eligibility-group',
                        order: 1,
                        contexts: [
                          {
                            id: 'chain-eligibility-context',
                            order: 1,
                            subject: 'CHARACTER',
                            conditions: [
                              {
                                id: 'chain-heavy-armor',
                                order: 1,
                                kind: 'PREDICATE',
                                constraint: 'INCLUDE',
                                predicateCode: 'EQUIPMENT_PROPERTY_PROFICIENCY',
                                authoringModeKind: 'SELECTED',
                                category: 'ARMOR',
                                properties: ['HEAVY']
                              }
                            ]
                          }
                        ]
                      }
                    ]
                  },
                  items: [
                    {
                      id: 'chain-item',
                      order: 1,
                      startingEquipmentKind: 'EQUIPMENT',
                      selectionKind: 'GRANTED',
                      authoringModeKind: 'SELECTED',
                      equipmentIds: ['chain'],
                      quantity: 1
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    },
    hitpoint: { ability: 'CONSTITUTION', dieConfig: 'd8' },
    multiclass: { id: 'cleric-multiclass', requirementGroups: { groups: [] } },
    proficiencies: [
      {
        id: 'cleric-light-armor',
        order: 1,
        grantKind: 'PROFICIENCY_GRANT',
        proficiencyKind: 'EQUIPMENT_PROPERTY',
        selectionKind: 'GRANTED',
        scalingKind: 'NONE',
        authoringModeKind: 'SELECTED',
        category: 'ARMOR',
        properties: ['LIGHT'],
        level: 'FULL'
      }
    ]
  }
}

function createDomain(
  category: 'ARMOR' | 'WEAPON'
): Extract<ClassAuthored, { category: 'SUBCLASS' }> {
  return {
    id: `heavy-${category.toLowerCase()}-domain`,
    label: `Heavy ${category.toLowerCase()} Domain`,
    category: 'SUBCLASS',
    parentClassId: 'cleric',
    userId: 'user-1',
    systemId: 'system-1',
    features: [
      {
        id: `heavy-${category.toLowerCase()}-training`,
        label: `Heavy ${category.toLowerCase()} Training`,
        description: `Grants heavy ${category.toLowerCase()} proficiency.`,
        order: 1,
        availableAtLevel: 1,
        grants: {
          proficiencies: [
            {
              id: `heavy-${category.toLowerCase()}-proficiency`,
              order: 1,
              grantKind: 'PROFICIENCY_GRANT',
              proficiencyKind: 'EQUIPMENT_PROPERTY',
              selectionKind: 'GRANTED',
              scalingKind: 'NONE',
              authoringModeKind: 'SELECTED',
              category,
              properties: ['HEAVY'],
              level: 'FULL'
            }
          ]
        }
      }
    ]
  }
}

function createElfRaces(): CharacterBuilderRegistry['races'] {
  return [
    {
      id: 'elf',
      label: 'Elf',
      category: 'BASE',
      selectionMode: 'REQUIRES_SUBRACE',
      size: 'MEDIUM',
      speeds: [],
      systemId: 'system-1',
      userId: 'user-1',
      features: [
        {
          id: 'elf-heavy-armor-training',
          label: 'Elf Heavy Armor Training',
          description: 'Grants heavy armor proficiency.',
          order: 1,
          grants: {
            proficiencies: [
              {
                id: 'elf-heavy-armor-proficiency',
                order: 1,
                grantKind: 'PROFICIENCY_GRANT',
                proficiencyKind: 'EQUIPMENT_PROPERTY',
                selectionKind: 'GRANTED',
                scalingKind: 'NONE',
                authoringModeKind: 'SELECTED',
                category: 'ARMOR',
                properties: ['HEAVY'],
                level: 'FULL'
              }
            ]
          }
        }
      ]
    },
    {
      id: 'high-elf',
      label: 'High Elf',
      category: 'SUBRACE',
      parentRaceId: 'elf',
      size: 'MEDIUM',
      speeds: [],
      systemId: 'system-1',
      userId: 'user-1',
      subrace: {
        parentRaceId: 'elf',
        parentLabel: 'Elf',
        inherited: {
          size: 'MEDIUM',
          speeds: []
        }
      }
    }
  ]
}

function createCharacter(subclassId?: string) {
  const character = createEmptyCharacterAuthored({
    id: 'character-1',
    systemId: 'system-1',
    userId: 'user-1'
  })
  character.intent.classes = [{ classId: 'cleric', classLevel: 1, subclassId }]
  return character
}

function classArmorOptions(resolution: Awaited<ReturnType<typeof resolveCharacterBuilder>>) {
  const cleric = resolution.registry.classes.find((record) => record.id === 'cleric')
  return cleric?.category === 'BASE'
    ? cleric.startingEquipment.sets[0]?.groups[0]?.options.map((option) => option.id)
    : undefined
}

describe('character Builder starting-equipment eligibility', () => {
  beforeEach(() => {
    repositoryState.classes = [createCleric()]
    repositoryState.races = []
    repositoryState.equipment = [
      createEquipment('leather', 'Leather Armor', ['LIGHT']),
      createEquipment('chain', 'Chain Mail', ['HEAVY'])
    ]
  })

  it('filters conditional options and respects equipment category', async () => {
    repositoryState.classes.push(createDomain('WEAPON'))
    const wrongCategory = await resolveCharacterBuilder(
      {} as unknown as DBLike,
      createCharacter('heavy-weapon-domain'),
      'create'
    )
    expect(classArmorOptions(wrongCategory)).toEqual(['leather-option'])

    repositoryState.classes = [createCleric(), createDomain('ARMOR')]
    const eligible = await resolveCharacterBuilder(
      {} as unknown as DBLike,
      createCharacter('heavy-armor-domain'),
      'create'
    )
    expect(classArmorOptions(eligible)).toEqual(['leather-option', 'chain-option'])
  })

  it('removes a now-ineligible saved option during reconciliation', async () => {
    const character = createCharacter()
    character.intent.startingEquipment = {
      class: {
        source: CharacterStartingEquipmentSource.CLASS,
        tookGold: false,
        groups: [{ groupId: 'armor-group', optionId: 'chain-option' }]
      }
    }

    const reconciled = await reconcileCharacterBuilderCharacter({} as unknown as DBLike, character)

    expect(reconciled.intent.startingEquipment?.class).toBeUndefined()
  })

  it('retains base-race grants when a subrace is selected', async () => {
    repositoryState.races = createElfRaces()
    const character = createCharacter()
    character.intent.race = { raceId: 'elf', subraceId: 'high-elf' }

    const resolution = await resolveCharacterBuilder({} as unknown as DBLike, character, 'create')

    expect(classArmorOptions(resolution)).toEqual(['leather-option', 'chain-option'])
  })

  it('records root grant choices at their actual class acquisition levels', async () => {
    const baseClass = createCleric()
    baseClass.subclassSelectionLevel = 2
    baseClass.proficiencies?.push({
      id: 'cleric-root-skill-choice',
      order: 2,
      grantKind: 'PROFICIENCY_GRANT',
      proficiencyKind: 'SKILL',
      selectionKind: 'CHOSEN',
      selectionDuplicatePolicy: 'UNIQUE',
      scalingKind: 'NONE',
      authoringModeKind: 'ALL',
      count: 1,
      level: 'FULL'
    })
    const subclass = createDomain('ARMOR')
    subclass.proficiencies = [
      {
        id: 'domain-root-skill-choice',
        order: 1,
        grantKind: 'PROFICIENCY_GRANT',
        proficiencyKind: 'SKILL',
        selectionKind: 'CHOSEN',
        selectionDuplicatePolicy: 'UNIQUE',
        scalingKind: 'NONE',
        authoringModeKind: 'ALL',
        count: 1,
        level: 'FULL'
      }
    ]
    repositoryState.classes = [baseClass, subclass]
    const character = createCharacter(subclass.id)
    character.intent.classes[0] = {
      classId: baseClass.id,
      classLevel: 3,
      subclassId: subclass.id
    }

    const resolution = await resolveCharacterBuilder({} as unknown as DBLike, character, 'create')

    expect(resolution.chosenGrantChoices).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          grantId: 'cleric-root-skill-choice',
          timing: { kind: 'CLASS_LEVEL', classId: 'cleric', classLevel: 1 }
        }),
        expect.objectContaining({
          grantId: 'domain-root-skill-choice',
          timing: { kind: 'CLASS_LEVEL', classId: 'cleric', classLevel: 2 }
        })
      ])
    )
  })

  it('does not let another owner with the same grant id hide a stale selection', async () => {
    const baseClass = createCleric()
    baseClass.proficiencies?.push({
      id: 'reused-skill-choice',
      order: 2,
      grantKind: 'PROFICIENCY_GRANT',
      proficiencyKind: 'SKILL',
      selectionKind: 'CHOSEN',
      selectionDuplicatePolicy: 'UNIQUE',
      scalingKind: 'NONE',
      authoringModeKind: 'ALL',
      count: 1,
      level: 'FULL'
    })
    repositoryState.classes = [baseClass]
    const character = createCharacter()
    character.intent.chosenGrantSelections = [
      {
        id: 'stale-subclass-selection',
        grantId: 'reused-skill-choice',
        source: { kind: 'SUBCLASS', subclassId: 'removed-domain' },
        timing: { kind: 'CLASS_LEVEL', classId: 'cleric', classLevel: 1 },
        targetIds: ['religion']
      }
    ]

    const resolution = await resolveCharacterBuilder({} as unknown as DBLike, character, 'create')

    expect(resolution.validations).toContainEqual(
      expect.objectContaining({
        code: 'STALE_CHOSEN_GRANT_SELECTION'
      })
    )
  })

  it('blocks duplicate chosen grant selections for one owner identity', async () => {
    const baseClass = createCleric()
    baseClass.proficiencies?.push({
      id: 'cleric-skill-choice',
      order: 2,
      grantKind: 'PROFICIENCY_GRANT',
      proficiencyKind: 'SKILL',
      selectionKind: 'CHOSEN',
      selectionDuplicatePolicy: 'UNIQUE',
      scalingKind: 'NONE',
      authoringModeKind: 'ALL',
      count: 1,
      level: 'FULL'
    })
    repositoryState.classes = [baseClass]
    const character = createCharacter()
    character.intent.chosenGrantSelections = [1, 2].map((classLevel) => ({
      id: `duplicate-selection-${classLevel}`,
      grantId: 'cleric-skill-choice',
      source: { kind: 'CLASS' as const, classId: 'cleric', classLevel },
      timing: { kind: 'CLASS_LEVEL' as const, classId: 'cleric', classLevel },
      targetIds: ['religion']
    }))

    const resolution = await resolveCharacterBuilder({} as unknown as DBLike, character, 'create')

    expect(resolution.validations).toContainEqual(
      expect.objectContaining({
        code: 'DUPLICATE_CHOSEN_GRANT_SELECTION_IDENTITY'
      })
    )
    expect(resolution.readiness.ready).toBe(false)
  })
})
