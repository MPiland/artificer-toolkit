import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  AUTHORING_MODE_KIND,
  AUTHORING_SELECTION_DUPLICATE_POLICY,
  AUTHORING_SELECTION_KIND,
  AUTHORED_RECORD_STATUS,
  CLASS_CATEGORY,
  GRANT_KIND,
  type NodeSubjectCode,
  PROFICIENCY_KIND,
  RACE_CATEGORY_CODE,
  SCALING,
  SCALING_AMOUNT_KIND,
  SPELLCASTING_ATTRIBUTE
} from '@artificer-toolkit/shared/core'
import type {
  BackgroundAuthored,
  ClassAuthored,
  FeatAuthored
} from '@artificer-toolkit/shared/subjects/authored'
import type { FeatureAuthored } from '@artificer-toolkit/shared/authored'

import type { CharacterBuilderContext, CharacterBuilderRegistry } from './builderService.js'
import type { CharacterBuilderSpellCatalogRecord } from './builderCatalog.js'

vi.mock('./characterRuleEvaluation.js', async () => {
  const { evaluateCharacterBuilderTestPolicy } =
    await import('./characterBuilderRuleEvaluation.testUtils.js')
  return { evaluateCharacterRulePolicy: evaluateCharacterBuilderTestPolicy }
})

const repositoryState = vi.hoisted(() => ({
  classes: [] as ClassAuthored[],
  equipment: [] as CharacterBuilderRegistry['equipment'],
  features: [] as FeatureAuthored[],
  feats: [] as FeatAuthored[],
  races: [] as CharacterBuilderRegistry['races'],
  spells: [] as CharacterBuilderSpellCatalogRecord[]
}))

const repositoryCalls = vi.hoisted(() => ({
  backgroundFindByIds: vi.fn(),
  backgroundListQuery: vi.fn(),
  classFindByIds: vi.fn(),
  classListQuery: vi.fn(),
  equipmentFindResolvedById: vi.fn(),
  equipmentListQuery: vi.fn(),
  featFindByIds: vi.fn(),
  featListQuery: vi.fn(),
  featureFindByIds: vi.fn(),
  raceFindResolvedAll: vi.fn(),
  raceFindResolvedById: vi.fn(),
  raceListQuery: vi.fn(),
  spellListQuery: vi.fn(),
  structureQuery: vi.fn()
}))

vi.mock('@artificer-toolkit/db', () => ({
  createCampaignContentRepository: () => ({ findAssignedCampaign: async () => null }),
  createSystemRepository: () => ({
    findById: async () => ({
      id: 'system-1',
      label: 'D&D 5e 2014',
      rulesetCode: 'dnd5e',
      rulesetVersion: '2014',
      userId: 'user-1',
      alignments: [],
      challengeRatings: [],
      conditionTypes: [],
      creatureTypes: [],
      currencies: [],
      damageTypes: [],
      heritages: [],
      lifestyles: [],
      magicSchools: [],
      passives: [],
      rarities: [],
      senses: [],
      terrains: [],
      skills: [
        { id: 'religion', label: 'Religion' },
        { id: 'medicine', label: 'Medicine' },
        { id: 'animal-handling', label: 'Animal Handling' }
      ],
      languages: [],
      speeds: []
    })
  }),
  createRaceRepository: () => ({
    findResolvedAll: repositoryCalls.raceFindResolvedAll,
    findResolvedById: repositoryCalls.raceFindResolvedById
  }),
  createClassRepository: () => ({ findByIds: repositoryCalls.classFindByIds }),
  createBackgroundRepository: () => ({ findByIds: repositoryCalls.backgroundFindByIds }),
  createEquipmentRepository: () => ({
    findResolvedById: repositoryCalls.equipmentFindResolvedById
  }),
  getBackgroundListQuery: repositoryCalls.backgroundListQuery,
  getClassListQuery: repositoryCalls.classListQuery,
  getEquipmentListQuery: repositoryCalls.equipmentListQuery,
  getFeatListQuery: repositoryCalls.featListQuery,
  getRaceListQuery: repositoryCalls.raceListQuery,
  getSpellListQuery: repositoryCalls.spellListQuery,
  getCharacterAssemblyStructureQuery: repositoryCalls.structureQuery,
  createFeatRepository: () => ({ findByIds: repositoryCalls.featFindByIds }),
  createFeatureRepository: () => ({ findByIds: repositoryCalls.featureFindByIds })
}))

import {
  createEmptyCharacterAuthored,
  loadCharacterBuilderContext,
  resolveCharacterBuilder
} from './builderService.js'
import { reconcileCharacterBuilderCharacter } from './builderReconciliation.js'

function createRace(
  id: string,
  features: CharacterBuilderRegistry['races'][number]['features'] = []
) {
  return {
    id,
    label: id === 'human' ? 'Human' : 'Tiefling',
    category: RACE_CATEGORY_CODE.BASE,
    selectionMode: 'DIRECT',
    size: 'MEDIUM',
    speeds: [],
    features,
    userId: 'user-1',
    systemId: 'system-1'
  } satisfies CharacterBuilderRegistry['races'][number]
}

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

function createCleric(): Extract<ClassAuthored, { category: typeof CLASS_CATEGORY.BASE }> {
  return {
    ...createFighter(),
    id: 'cleric',
    label: 'Cleric',
    spellcasting: {
      spellLimits: [],
      attributes: [SPELLCASTING_ATTRIBUTE.PREPARES_SPELLS],
      ability: 'WISDOM',
      maxSpellLevel: 9,
      charges: {
        id: 'cleric-spellcasting-charge',
        resetKind: 'LONG_REST',
        limitKind: 'FIXED_AMOUNT',
        scalingKind: SCALING.NONE,
        amount: 1
      }
    }
  }
}

function createSpellGrantFeature<N extends NodeSubjectCode = NodeSubjectCode>(
  id: string
): FeatureAuthored<N> {
  return {
    id,
    label: 'Spell Grant Feature',
    description: '',
    order: 0,
    grants: {
      spells: [
        {
          id: `${id}-spell-grant`,
          grantKind: GRANT_KIND.SPELL_GRANT,
          selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
          scalingKind: SCALING.NONE,
          authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
          spellIds: ['fire-bolt'],
          order: 0
        }
      ]
    }
  }
}

function createLevelRestrictedChoiceFeature(): FeatureAuthored {
  return {
    id: 'veteran-feat',
    label: 'Veteran',
    description: '',
    order: 0,
    optionChoices: [{ level: 1, count: 1 }],
    options: [
      {
        id: 'veteran',
        label: 'Veteran',
        description: 'Requires Fighter level 2.',
        order: 0,
        restrictions: {
          id: 'veteran-restrictions',
          groups: [
            {
              id: 'veteran-group',
              order: 0,
              contexts: [
                {
                  id: 'veteran-context',
                  order: 0,
                  subject: 'CHARACTER',
                  conditions: [
                    {
                      id: 'veteran-condition',
                      order: 0,
                      kind: 'PREDICATE',
                      constraint: 'INCLUDE',
                      predicateCode: 'CLASS_LEVEL',
                      classIds: ['fighter'],
                      min: 2
                    }
                  ]
                }
              ]
            }
          ]
        }
      },
      {
        id: 'rookie',
        label: 'Rookie',
        description: 'Always valid option.',
        order: 1
      }
    ]
  } satisfies FeatureAuthored
}

function createCharacter(raceId: string, classId: string) {
  const character = createEmptyCharacterAuthored({
    id: 'character-1',
    systemId: 'system-1',
    userId: 'user-1'
  })
  character.intent.race = { raceId }
  character.intent.classes = [{ classId, classLevel: 1 }]
  character.intent.hitpoints.levels = [{ level: 1, classId, classLevel: 1, value: 10 }]
  return character
}

function createFireBolt(): CharacterBuilderSpellCatalogRecord {
  return {
    id: 'fire-bolt',
    label: 'Fire Bolt',
    description: '',
    castingTime: { unit: 'ROUND', amount: 1 },
    level: 0,
    classIds: ['cleric'],
    magicSchoolId: 'evocation'
  }
}

describe('character Builder conditional spell registry loading', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    repositoryState.classes = []
    repositoryState.equipment = []
    repositoryState.features = []
    repositoryState.feats = []
    repositoryState.races = []
    repositoryState.spells = [createFireBolt()]
    repositoryCalls.structureQuery.mockResolvedValue({
      rootFeatureLinks: [],
      ancestryOptions: [],
      featureOptions: [],
      featureOptionChoices: []
    })
    repositoryCalls.backgroundFindByIds.mockResolvedValue(new Map())
    repositoryCalls.backgroundListQuery.mockResolvedValue({ items: [], meta: {} })
    repositoryCalls.classFindByIds.mockImplementation(
      async (ids: readonly string[]) =>
        new Map(
          repositoryState.classes
            .filter((record) => ids.includes(record.id))
            .map((record) => [record.id, record])
        )
    )
    repositoryCalls.classListQuery.mockImplementation(async () => ({
      items: repositoryState.classes.map((record) => ({
        id: record.id,
        label: record.label,
        category: record.category,
        parentClassId: 'parentClassId' in record ? (record.parentClassId ?? null) : null,
        subclassSelectionLevel:
          'subclassSelectionLevel' in record ? (record.subclassSelectionLevel ?? null) : null
      })),
      meta: {}
    }))
    repositoryCalls.equipmentFindResolvedById.mockImplementation(
      async (id: string) => repositoryState.equipment.find((record) => record.id === id) ?? null
    )
    repositoryCalls.equipmentListQuery.mockResolvedValue({ items: [], meta: {} })
    repositoryCalls.featureFindByIds.mockImplementation(
      async (ids: readonly string[]) =>
        new Map(
          repositoryState.features
            .filter((record) => ids.includes(record.id))
            .map((record) => [record.id, record])
        )
    )
    repositoryCalls.featFindByIds.mockImplementation(
      async (ids: readonly string[]) =>
        new Map(
          repositoryState.feats
            .filter((record) => ids.includes(record.id))
            .map((record) => [record.id, record])
        )
    )
    repositoryCalls.featListQuery.mockImplementation(async () => ({
      items: repositoryState.feats.map((record) => ({ id: record.id, label: record.label })),
      meta: {}
    }))
    repositoryCalls.raceFindResolvedById.mockImplementation(
      async (id: string) => repositoryState.races.find((record) => record.id === id) ?? null
    )
    repositoryCalls.raceFindResolvedAll.mockImplementation(async () => repositoryState.races)
    repositoryCalls.raceListQuery.mockImplementation(async () => ({
      items: repositoryState.races.map((record) => ({
        id: record.id,
        label: record.label,
        category: record.category,
        parentRaceId: record.category === RACE_CATEGORY_CODE.SUBRACE ? record.parentRaceId : null
      })),
      meta: {}
    }))
    repositoryCalls.spellListQuery.mockImplementation(async () => ({
      items: repositoryState.spells.map((spell) => ({
        id: spell.id,
        label: spell.label,
        description: spell.description,
        status: 'ACTIVE',
        systemId: 'system-1',
        magicSchoolId: spell.magicSchoolId,
        level: spell.level,
        castingTimeUnit: spell.castingTime.unit,
        castingTimeAmount: spell.castingTime.amount,
        materialDescription: spell.materialDescription ?? null,
        userId: 'master',
        ownerUserId: null,
        isMaster: true
      })),
      meta: {
        attributes: [],
        classes: [
          {
            id: 'cleric',
            label: 'Cleric',
            spellIds: repositoryState.spells.map((spell) => spell.id)
          }
        ],
        schools: [],
        levels: [],
        castingTimeUnits: []
      }
    }))
  })

  it('reuses a supplied registry across reconciliation and resolution', async () => {
    const race = createRace('human')
    const cleric = createCleric()
    const spell = createFireBolt()
    const character = createCharacter(race.id, cleric.id)
    const context: CharacterBuilderContext = {
      catalog: {
        races: [{ id: race.id, label: race.label, category: race.category }],
        classes: [{ id: cleric.id, label: cleric.label, category: cleric.category }],
        backgrounds: [],
        equipment: [],
        feats: [],
        spells: [spell]
      },
      registry: {
        system: null,
        races: [race],
        classes: [cleric],
        backgrounds: [],
        equipment: [],
        feats: [],
        features: []
      }
    }

    const reconciled = await reconcileCharacterBuilderCharacter(
      {} as never,
      character,
      null,
      context
    )
    const resolution = await resolveCharacterBuilder({} as never, reconciled, 'create', context)

    expect(resolution.catalog.spells).toEqual([spell])
    expect(repositoryCalls.raceListQuery).not.toHaveBeenCalled()
    expect(repositoryCalls.classListQuery).not.toHaveBeenCalled()
    expect(repositoryCalls.backgroundListQuery).not.toHaveBeenCalled()
    expect(repositoryCalls.featListQuery).not.toHaveBeenCalled()
    expect(repositoryCalls.spellListQuery).not.toHaveBeenCalled()
  })

  it('does not load spells for a Human Fighter without a spell-grant source', async () => {
    repositoryState.races = [createRace('human')]
    repositoryState.classes = [createFighter()]

    const resolution = await resolveCharacterBuilder(
      {} as never,
      createCharacter('human', 'fighter'),
      'create'
    )

    expect(repositoryCalls.spellListQuery).not.toHaveBeenCalled()
    expect(resolution.catalog.spells).toEqual([])
  })

  it('hydrates unselected catalog records for chooser comparison metadata', async () => {
    const selectedRace = createRace('human')
    const unselectedRace = {
      ...createRace('dragonborn', [
        {
          id: 'dragonborn-ability-score-increase',
          label: 'Ability Score Increase',
          description: 'Strength increases by 2 and Charisma increases by 1.',
          availableAtLevel: 1,
          order: 0,
          grants: {
            modifiers: [
              {
                id: 'dragonborn-strength-plus-two',
                grantKind: GRANT_KIND.MODIFIER_GRANT,
                valueDomainCode: 'ABILITY_SCORE',
                domain: { ability: 'STRENGTH' },
                modifierKind: 'BONUS',
                scope: 'GLOBAL',
                selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                payload: { valueKind: 'FIXED', amount: 2 },
                order: 0
              },
              {
                id: 'dragonborn-charisma-plus-one',
                grantKind: GRANT_KIND.MODIFIER_GRANT,
                valueDomainCode: 'ABILITY_SCORE',
                domain: { ability: 'CHARISMA' },
                modifierKind: 'BONUS',
                scope: 'GLOBAL',
                selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                payload: { valueKind: 'FIXED', amount: 1 },
                order: 1
              }
            ]
          }
        }
      ]),
      label: 'Dragonborn',
      description: 'Draconic heritage.'
    }
    const selectedClass = createFighter()
    const unselectedClass = {
      ...createCleric(),
      description: 'Divine spellcaster.',
      proficiencies: [
        {
          id: 'cleric-light-armor',
          grantKind: GRANT_KIND.PROFICIENCY_GRANT,
          proficiencyKind: PROFICIENCY_KIND.EQUIPMENT_PROPERTY,
          level: SCALING_AMOUNT_KIND.FULL,
          selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
          scalingKind: SCALING.NONE,
          authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
          properties: ['LIGHT'],
          category: 'ARMOR',
          order: 0
        },
        {
          id: 'cleric-skills',
          grantKind: GRANT_KIND.PROFICIENCY_GRANT,
          proficiencyKind: PROFICIENCY_KIND.SKILL,
          level: SCALING_AMOUNT_KIND.FULL,
          selectionKind: AUTHORING_SELECTION_KIND.CHOSEN,
          selectionDuplicatePolicy: AUTHORING_SELECTION_DUPLICATE_POLICY.UNIQUE,
          scalingKind: SCALING.NONE,
          authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
          skillIds: ['religion', 'medicine'],
          count: 1,
          order: 1
        },
        {
          id: 'cleric-shields',
          grantKind: GRANT_KIND.PROFICIENCY_GRANT,
          proficiencyKind: PROFICIENCY_KIND.EQUIPMENT,
          level: SCALING_AMOUNT_KIND.FULL,
          selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
          scalingKind: SCALING.NONE,
          authoringModeKind: AUTHORING_MODE_KIND.ALL,
          category: 'SHIELD',
          order: 2
        }
      ]
    } satisfies Extract<ClassAuthored, { category: typeof CLASS_CATEGORY.BASE }>
    repositoryState.races = [selectedRace, unselectedRace]
    repositoryState.classes = [selectedClass, unselectedClass]
    const unselectedBackground = {
      kind: 'BACKGROUND' as const,
      id: 'background-acolyte',
      label: 'Acolyte',
      description: 'You have spent your life in service.',
      userId: 'user-1',
      systemId: 'system-1',
      features: [
        {
          id: 'shelter-of-the-faithful',
          label: 'Shelter of the Faithful',
          description: 'Faithful allies provide support.',
          order: 0
        }
      ]
    }
    repositoryCalls.backgroundListQuery.mockResolvedValue({
      items: [{ id: unselectedBackground.id, label: unselectedBackground.label }],
      meta: {}
    })
    repositoryCalls.backgroundFindByIds.mockResolvedValue(
      new Map([[unselectedBackground.id, unselectedBackground]])
    )

    const resolution = await resolveCharacterBuilder(
      {} as never,
      createCharacter(selectedRace.id, selectedClass.id),
      'create'
    )

    expect(repositoryCalls.raceFindResolvedAll).toHaveBeenCalledWith({
      systemId: 'system-1',
      includeFeatureEffects: false
    })
    expect(repositoryCalls.classFindByIds).toHaveBeenCalledWith(
      [selectedClass.id, unselectedClass.id],
      {
        systemId: 'system-1',
        allowedFeatureIds: new Set(),
        includeFeatureEffects: false
      }
    )
    expect(repositoryCalls.backgroundFindByIds).toHaveBeenCalledWith([unselectedBackground.id], {
      systemId: 'system-1',
      includeFeatureEffects: false
    })
    expect(resolution.registry.races.map((race) => race.id)).toEqual([selectedRace.id])
    expect(resolution.catalog.races.find((race) => race.id === unselectedRace.id)).toMatchObject({
      description: 'Draconic heritage.',
      sizeLabel: 'Medium',
      speedLabels: [],
      abilityScoreIncreaseFacts: [
        { label: 'Strength', value: '+2' },
        { label: 'Charisma', value: '+1' }
      ]
    })
    expect(
      resolution.catalog.classes.find((record) => record.id === unselectedClass.id)
    ).toMatchObject({
      description: 'Divine spellcaster.',
      hitpoint: unselectedClass.hitpoint,
      savingThrowLabels: [],
      proficiencyGroups: [
        { label: 'Armor', entries: ['Light armor', 'Shields'] },
        { label: 'Skills', entries: ['Choose 1 from Medicine, Religion'] }
      ]
    })
    expect(resolution.catalog.backgrounds).toEqual([
      expect.objectContaining({
        id: unselectedBackground.id,
        label: unselectedBackground.label,
        description: unselectedBackground.description,
        featureLabels: ['Shelter of the Faithful']
      })
    ])
  })

  it('passes only current-level feature ids to selected-root repositories', async () => {
    repositoryState.races = [createRace('human')]
    repositoryState.classes = [createFighter()]
    repositoryCalls.structureQuery.mockResolvedValue({
      rootFeatureLinks: [
        {
          ownerKind: 'CLASS',
          ownerId: 'fighter',
          featureId: 'feature-level-1',
          order: 1,
          availableAtLevel: 1
        },
        {
          ownerKind: 'CLASS',
          ownerId: 'fighter',
          featureId: 'feature-level-5',
          order: 2,
          availableAtLevel: 5
        }
      ],
      ancestryOptions: [],
      featureOptions: [],
      featureOptionChoices: []
    })

    await resolveCharacterBuilder({} as never, createCharacter('human', 'fighter'), 'create')

    expect(repositoryCalls.classFindByIds).toHaveBeenCalledWith(['fighter'], {
      systemId: 'system-1',
      allowedFeatureIds: new Set(['feature-level-1']),
      includeFeatureEffects: false
    })
  })

  it('reconciles a Human Fighter without loading the full spell registry', async () => {
    repositoryState.races = [createRace('human')]
    repositoryState.classes = [createFighter()]

    const character = createCharacter('human', 'fighter')
    character.state.hitpoints.hitDice = [{ die: 10, total: 4, used: 3 }]
    const reconciled = await reconcileCharacterBuilderCharacter({} as never, character)

    expect(reconciled).toMatchObject({ id: character.id })
    expect(reconciled.state.hitpoints.current).toBe(10)
    expect(reconciled.state.hitpoints.hitDice).toEqual([{ die: 10, total: 1, used: 1 }])
    expect(repositoryCalls.spellListQuery).not.toHaveBeenCalled()
  })

  it('preserves live hit point state when reconciling an active character', async () => {
    repositoryState.races = [createRace('human')]
    repositoryState.classes = [createFighter()]

    const character = createCharacter('human', 'fighter')
    character.status = AUTHORED_RECORD_STATUS.ACTIVE
    character.state.hitpoints.current = 3

    const reconciled = await reconcileCharacterBuilderCharacter(
      {} as never,
      character,
      structuredClone(character),
      undefined,
      'builder-test-rule-revision'
    )

    expect(reconciled.state.hitpoints.current).toBe(3)
  })

  it('loads spells when the selected race contributes a SpellGrant', async () => {
    repositoryState.races = [createRace('tiefling', [createSpellGrantFeature('infernal-legacy')])]
    repositoryState.classes = [createFighter()]
    repositoryCalls.structureQuery.mockResolvedValue({
      rootFeatureLinks: [
        {
          ownerKind: 'RACE',
          ownerId: 'tiefling',
          featureId: 'infernal-legacy',
          order: 0,
          availableAtLevel: 1
        }
      ],
      ancestryOptions: [],
      featureOptions: [],
      featureOptionChoices: []
    })

    const resolution = await resolveCharacterBuilder(
      {} as never,
      createCharacter('tiefling', 'fighter'),
      'create'
    )

    expect(repositoryCalls.spellListQuery).toHaveBeenCalledOnce()
    expect(resolution.catalog.spells.map((spell) => spell.label)).toEqual(['Fire Bolt'])
  })

  it('loads spells for a normal spellcasting class', async () => {
    repositoryState.races = [createRace('human')]
    repositoryState.classes = [createCleric()]

    await resolveCharacterBuilder({} as never, createCharacter('human', 'cleric'), 'create')

    expect(repositoryCalls.spellListQuery).toHaveBeenCalledOnce()
  })

  it('loads only the selected authored feature before its SpellGrant requires spells', async () => {
    repositoryState.races = [createRace('human')]
    repositoryState.classes = [createFighter()]
    repositoryState.features = [
      createSpellGrantFeature('arcane-initiate'),
      { id: 'unselected-feature', label: 'Unselected', description: '', order: 1 }
    ]
    const character = createCharacter('human', 'fighter')
    character.intent.featureAcquisitions = [
      {
        id: 'arcane-initiate-acquisition',
        featureId: 'arcane-initiate',
        source: { kind: 'FEATURE', featureId: 'arcane-initiate' },
        timing: { kind: 'IMMEDIATE' }
      }
    ]

    await resolveCharacterBuilder({} as never, character, 'create')

    expect(repositoryCalls.featureFindByIds).toHaveBeenCalledWith(['arcane-initiate'], {
      includeEffects: false
    })
    expect(repositoryCalls.spellListQuery).toHaveBeenCalledOnce()
  })

  it('loads spells when a selected feat contributes a SpellGrant', async () => {
    repositoryState.races = [createRace('human')]
    repositoryState.classes = [createFighter()]
    repositoryState.feats = [
      {
        id: 'magic-initiate',
        label: 'Magic Initiate',
        description: '',
        userId: 'user-1',
        systemId: 'system-1',
        grants: createSpellGrantFeature('magic-initiate').grants
      }
    ]
    const character = createCharacter('human', 'fighter')
    character.intent.featureAcquisitions = [
      {
        id: 'magic-initiate-acquisition',
        featureId: 'magic-initiate',
        source: { kind: 'FEAT', featId: 'magic-initiate' },
        timing: { kind: 'IMMEDIATE' }
      }
    ]

    await resolveCharacterBuilder({} as never, character, 'create')

    expect(repositoryCalls.featureFindByIds).not.toHaveBeenCalled()
    expect(repositoryCalls.spellListQuery).toHaveBeenCalledOnce()
  })

  it('loads only owned equipment before its SpellGrant requires spells', async () => {
    repositoryState.races = [createRace('human')]
    repositoryState.classes = [createFighter()]
    repositoryState.equipment = [
      {
        kind: 'EQUIPMENT',
        id: 'wand-of-sparks',
        label: 'Wand of Sparks',
        description: null,
        category: 'ADVENTURING_GEAR',
        properties: [],
        weight: { amount: 1, unit: 'POUNDS' },
        rarityId: 'COMMON',
        features: [createSpellGrantFeature<'EQUIPMENT'>('wand-spell')],
        userId: 'user-1',
        systemId: 'system-1'
      }
    ]
    const character = createCharacter('human', 'fighter')
    character.state.equipment.inventory = [
      {
        id: 'owned-wand',
        equipmentId: 'wand-of-sparks',
        quantity: 1
      }
    ]
    character.state.equipment.equipped = ['owned-wand']
    character.state.equipment.attuned = ['owned-wand']
    repositoryCalls.structureQuery.mockResolvedValue({
      rootFeatureLinks: [
        {
          ownerKind: 'EQUIPMENT',
          ownerId: 'wand-of-sparks',
          featureId: 'wand-spell',
          order: 0,
          availableAtLevel: 1
        }
      ],
      ancestryOptions: [],
      featureOptions: [],
      featureOptionChoices: []
    })

    await resolveCharacterBuilder({} as never, character, 'create')

    expect(repositoryCalls.equipmentFindResolvedById).toHaveBeenCalledWith('wand-of-sparks', {
      systemId: 'system-1',
      allowedFeatureIds: new Set(['wand-spell']),
      includeEffects: false
    })
    expect(repositoryCalls.spellListQuery).toHaveBeenCalledOnce()
  })

  it('loads Builder sources without effects and Sheet sources with effects', async () => {
    repositoryState.races = [createRace('human')]
    repositoryState.classes = [createFighter()]
    repositoryState.feats = [
      {
        id: 'magic-initiate',
        label: 'Magic Initiate',
        description: '',
        userId: 'user-1',
        systemId: 'system-1'
      }
    ]
    repositoryState.features = [
      { id: 'direct-feature', label: 'Direct Feature', description: '', order: 0 }
    ]
    repositoryState.equipment = [
      {
        kind: 'EQUIPMENT',
        id: 'wand-of-sparks',
        label: 'Wand of Sparks',
        description: null,
        category: 'ADVENTURING_GEAR',
        properties: [],
        weight: { amount: 1, unit: 'POUNDS' },
        rarityId: 'COMMON',
        userId: 'user-1',
        systemId: 'system-1'
      }
    ]
    const background: BackgroundAuthored = {
      kind: 'BACKGROUND',
      id: 'acolyte',
      label: 'Acolyte',
      description: '',
      userId: 'user-1',
      systemId: 'system-1'
    }
    repositoryCalls.backgroundFindByIds.mockResolvedValue(new Map([[background.id, background]]))

    const character = createCharacter('human', 'fighter')
    character.intent.background = { backgroundId: background.id }
    character.intent.featureAcquisitions = [
      {
        id: 'direct-feature-acquisition',
        featureId: 'direct-feature',
        source: { kind: 'FEATURE', featureId: 'direct-feature' },
        timing: { kind: 'IMMEDIATE' }
      },
      {
        id: 'feat-acquisition',
        featureId: 'magic-initiate',
        source: { kind: 'FEAT', featId: 'magic-initiate' },
        timing: { kind: 'IMMEDIATE' }
      }
    ]
    character.state.equipment.inventory = [
      { id: 'owned-wand', equipmentId: 'wand-of-sparks', quantity: 1 }
    ]

    await loadCharacterBuilderContext({} as never, character)

    expect(repositoryCalls.raceFindResolvedById).toHaveBeenLastCalledWith('human', {
      systemId: 'system-1',
      includeFeatureEffects: false
    })
    expect(repositoryCalls.classFindByIds).toHaveBeenLastCalledWith(['fighter'], {
      systemId: 'system-1',
      allowedFeatureIds: new Set(['direct-feature', 'magic-initiate']),
      includeFeatureEffects: false
    })
    expect(repositoryCalls.backgroundFindByIds).toHaveBeenLastCalledWith(['acolyte'], {
      systemId: 'system-1',
      allowedFeatureIds: new Set(['direct-feature', 'magic-initiate']),
      includeFeatureEffects: false
    })
    expect(repositoryCalls.featFindByIds).toHaveBeenLastCalledWith(['magic-initiate'], {
      systemId: 'system-1',
      allowedFeatureIds: new Set(['direct-feature', 'magic-initiate']),
      includeEffects: false
    })
    expect(repositoryCalls.featureFindByIds).toHaveBeenLastCalledWith(['direct-feature'], {
      includeEffects: false
    })
    expect(repositoryCalls.equipmentFindResolvedById).toHaveBeenLastCalledWith('wand-of-sparks', {
      systemId: 'system-1',
      allowedFeatureIds: new Set(['direct-feature', 'magic-initiate']),
      includeEffects: false
    })

    vi.clearAllMocks()

    await loadCharacterBuilderContext({} as never, character, [], { includeEffects: true })

    expect(repositoryCalls.raceFindResolvedById).toHaveBeenLastCalledWith('human', {
      systemId: 'system-1',
      includeFeatureEffects: true
    })
    expect(repositoryCalls.classFindByIds).toHaveBeenLastCalledWith(['fighter'], {
      systemId: 'system-1',
      allowedFeatureIds: new Set(['direct-feature', 'magic-initiate']),
      includeFeatureEffects: true
    })
    expect(repositoryCalls.backgroundFindByIds).toHaveBeenLastCalledWith(['acolyte'], {
      systemId: 'system-1',
      allowedFeatureIds: new Set(['direct-feature', 'magic-initiate']),
      includeFeatureEffects: true
    })
    expect(repositoryCalls.featFindByIds).toHaveBeenLastCalledWith(['magic-initiate'], {
      systemId: 'system-1',
      allowedFeatureIds: new Set(['direct-feature', 'magic-initiate']),
      includeEffects: true
    })
    expect(repositoryCalls.featureFindByIds).toHaveBeenLastCalledWith(['direct-feature'], {
      includeEffects: true
    })
    expect(repositoryCalls.equipmentFindResolvedById).toHaveBeenLastCalledWith('wand-of-sparks', {
      systemId: 'system-1',
      allowedFeatureIds: new Set(['direct-feature', 'magic-initiate']),
      includeEffects: true
    })
  })

  it('keeps filtered out feature options out of registry while preserving sourceRegistry', async () => {
    repositoryState.races = [createRace('human', [createLevelRestrictedChoiceFeature()])]
    repositoryState.classes = [createFighter()]

    const resolution = await resolveCharacterBuilder(
      {} as never,
      createCharacter('human', 'fighter'),
      'create'
    )

    const sourceFeature = resolution.sourceRegistry.races
      .find((race) => race.id === 'human')
      ?.features?.find((feature) => feature.id === 'veteran-feat')
    const filteredFeature = resolution.registry.races
      .find((race) => race.id === 'human')
      ?.features?.find((feature) => feature.id === 'veteran-feat')

    expect(sourceFeature).toMatchObject({
      options: expect.arrayContaining([
        expect.objectContaining({ id: 'veteran' }),
        expect.objectContaining({ id: 'rookie' })
      ])
    })
    expect(filteredFeature).toMatchObject({
      options: expect.arrayContaining([expect.objectContaining({ id: 'rookie' })])
    })
    expect(filteredFeature?.options?.map((option) => option.id)).not.toContain('veteran')
  })
})
