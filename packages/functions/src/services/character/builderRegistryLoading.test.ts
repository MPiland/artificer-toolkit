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
  FeatAuthored,
  SpellAuthored
} from '@artificer-toolkit/shared/subjects/authored'
import type { FeatureAuthored } from '@artificer-toolkit/shared/authored'

import type { CharacterBuilderContext, CharacterBuilderRegistry } from './builderService.js'
import {
  loadCharacterStructuralSpellCatalog,
  type CharacterBuilderSpellCatalogRecord
} from './builderCatalog.js'
import type { CampaignAuthoredSource } from './campaignCharacterContent.js'

vi.mock('./characterRuleEvaluation.js', async () => {
  const { evaluateCharacterBuilderTestPolicy } =
    await import('./characterBuilderRuleEvaluation.testUtils.js')
  return { evaluateCharacterRulePolicy: evaluateCharacterBuilderTestPolicy }
})

const repositoryState = vi.hoisted(() => ({
  backgrounds: [] as BackgroundAuthored[],
  classes: [] as ClassAuthored[],
  equipment: [] as CharacterBuilderRegistry['equipment'],
  features: [] as FeatureAuthored[],
  feats: [] as FeatAuthored[],
  races: [] as CharacterBuilderRegistry['races'],
  spells: [] as Array<
    CharacterBuilderSpellCatalogRecord &
      Partial<Pick<SpellAuthored, 'kind' | 'systemId' | 'userId'>>
  >,
  campaignAssignment: null as { campaignId: string; userId: string } | null
}))

const repositoryCalls = vi.hoisted(() => ({
  authoredVersionFindActiveByIds: vi.fn(),
  authoredVersionFindExactVersions: vi.fn(),
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
  snapshotFindActive: vi.fn(),
  spellListQuery: vi.fn(),
  structureQuery: vi.fn(),
  campaignContentListCurrentSources: vi.fn()
}))

vi.mock('@artificer-toolkit/db', () => ({
  createCampaignRepository: () => ({
    findCampaignByCharacter: async () => repositoryState.campaignAssignment
  }),
  createCampaignContentShareRepository: () => ({
    listCurrentSources: repositoryCalls.campaignContentListCurrentSources
  }),
  createAuthoredVersionRepository: () => ({
    findActiveByIds: repositoryCalls.authoredVersionFindActiveByIds,
    findExactVersions: repositoryCalls.authoredVersionFindExactVersions
  }),
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
  createSystemVocabularySnapshotRepository: () => ({
    findActive: repositoryCalls.snapshotFindActive
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
  loadCharacterStructuralRuleContext,
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

function activeVersionInput(subjectKind: string, subjectIds: readonly string[]) {
  return {
    subjectKind,
    subjectIds,
    systemId: 'system-1',
    userId: 'user-1',
    includeMaster: true
  }
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

function createChosenFeatFeature(featId = 'chosen-feat'): FeatureAuthored {
  return {
    id: 'chosen-feat-feature',
    label: 'Chosen Feat Feature',
    description: '',
    order: 0,
    grants: {
      feats: [
        {
          id: 'chosen-feat-grant',
          grantKind: GRANT_KIND.FEAT_GRANT,
          selectionKind: AUTHORING_SELECTION_KIND.CHOSEN,
          selectionDuplicatePolicy: AUTHORING_SELECTION_DUPLICATE_POLICY.UNIQUE,
          scalingKind: SCALING.NONE,
          authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
          featIds: [featId],
          count: 1,
          order: 0
        }
      ]
    }
  }
}

function createChosenEquipmentFeature(equipmentId = 'chosen-equipment'): FeatureAuthored {
  return {
    id: 'chosen-equipment-feature',
    label: 'Chosen Equipment Feature',
    description: '',
    order: 0,
    grants: {
      proficiencies: [
        {
          id: 'chosen-equipment-grant',
          grantKind: GRANT_KIND.PROFICIENCY_GRANT,
          proficiencyKind: PROFICIENCY_KIND.EQUIPMENT,
          level: SCALING_AMOUNT_KIND.FULL,
          selectionKind: AUTHORING_SELECTION_KIND.CHOSEN,
          selectionDuplicatePolicy: AUTHORING_SELECTION_DUPLICATE_POLICY.UNIQUE,
          scalingKind: SCALING.NONE,
          authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
          equipmentIds: [equipmentId],
          count: 1,
          order: 0
        }
      ]
    }
  }
}

function createCampaignSource(
  subjectKind: CampaignAuthoredSource['subjectKind'],
  subjectId: string,
  authored: unknown
): CampaignAuthoredSource {
  return {
    subjectKind,
    subjectId,
    authoredVersionId: `${subjectId}-authored-version`,
    authoredVersion: 1,
    authoredChecksum: 'a'.repeat(64),
    compiledProjectionChecksum: 'b'.repeat(64),
    authoredDependencies: [],
    authored: authored as CampaignAuthoredSource['authored']
  }
}

function createCampaignVersionRecord(source: CampaignAuthoredSource) {
  return {
    authored: {
      subjectKind: source.subjectKind,
      subjectId: source.subjectId,
      versionId: source.authoredVersionId,
      version: source.authoredVersion,
      checksum: source.authoredChecksum,
      document: source.authored
    },
    compiled: {
      projectionChecksum: source.compiledProjectionChecksum,
      authoredDependencies: []
    }
  }
}

describe('character Builder conditional spell registry loading', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    repositoryState.classes = []
    repositoryState.backgrounds = []
    repositoryState.equipment = []
    repositoryState.features = []
    repositoryState.feats = []
    repositoryState.races = []
    repositoryState.spells = [createFireBolt()]
    repositoryState.campaignAssignment = null
    repositoryCalls.authoredVersionFindActiveByIds.mockImplementation(
      async ({
        subjectIds,
        subjectKind
      }: {
        subjectIds: readonly string[]
        subjectKind: string
      }) => {
        const records =
          subjectKind === 'RACE'
            ? repositoryState.races
            : subjectKind === 'CLASS'
              ? repositoryState.classes
              : subjectKind === 'BACKGROUND'
                ? repositoryState.backgrounds
                : subjectKind === 'EQUIPMENT'
                  ? repositoryState.equipment
                  : subjectKind === 'FEAT'
                    ? repositoryState.feats
                    : subjectKind === 'SPELL'
                      ? repositoryState.spells.map((spell) => ({
                          ...spell,
                          systemId: 'system-1',
                          userId: spell.userId ?? 'user-1'
                        }))
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
      }
    )
    repositoryCalls.authoredVersionFindExactVersions.mockImplementation(
      async ({ entries }: { entries: readonly { subjectId: string; subjectKind: string }[] }) => {
        const records = [...repositoryState.races, ...repositoryState.equipment]
        return new Map(
          entries.flatMap((entry) => {
            const record = records.find((candidate) => candidate.id === entry.subjectId)
            return record
              ? [
                  [
                    `${entry.subjectKind}:${entry.subjectId}`,
                    { authored: { document: record }, compiled: { authoredDependencies: [] } }
                  ] as const
                ]
              : []
          })
        )
      }
    )
    repositoryCalls.structureQuery.mockResolvedValue({
      rootFeatureLinks: [],
      ancestryOptions: [],
      featureOptions: [],
      featureOptionChoices: []
    })
    repositoryCalls.campaignContentListCurrentSources.mockResolvedValue([])
    repositoryCalls.snapshotFindActive.mockResolvedValue({
      document: {
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
        skills: [],
        languages: [],
        speeds: []
      }
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
    repositoryState.backgrounds = [unselectedBackground]

    const resolution = await resolveCharacterBuilder(
      {} as never,
      createCharacter(selectedRace.id, selectedClass.id),
      'create'
    )

    expect(repositoryCalls.raceFindResolvedAll).not.toHaveBeenCalled()
    expect(repositoryCalls.classFindByIds).not.toHaveBeenCalled()
    expect(repositoryCalls.backgroundFindByIds).not.toHaveBeenCalled()
    expect(repositoryCalls.authoredVersionFindActiveByIds).toHaveBeenCalledWith(
      activeVersionInput('RACE', [selectedRace.id, unselectedRace.id])
    )
    expect(repositoryCalls.authoredVersionFindActiveByIds).toHaveBeenCalledWith(
      activeVersionInput('CLASS', [selectedClass.id, unselectedClass.id])
    )
    expect(repositoryCalls.authoredVersionFindActiveByIds).toHaveBeenCalledWith(
      activeVersionInput('BACKGROUND', [unselectedBackground.id])
    )
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

  it('loads selected Builder roots through active immutable versions', async () => {
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

    expect(repositoryCalls.authoredVersionFindActiveByIds).toHaveBeenCalledWith(
      activeVersionInput('CLASS', ['fighter'])
    )
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
    repositoryState.spells = [
      createFireBolt(),
      { ...createFireBolt(), id: 'irrelevant-catalogue-spell', label: 'Irrelevant' }
    ]
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
    expect(resolution.catalog.spells.map((spell) => spell.label)).toEqual([
      'Fire Bolt',
      'Irrelevant'
    ])
    expect(resolution.catalog.spells[0]).not.toHaveProperty('kind')
    expect(repositoryCalls.authoredVersionFindActiveByIds).toHaveBeenCalledWith(
      activeVersionInput('SPELL', ['fire-bolt'])
    )
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

    expect(repositoryCalls.authoredVersionFindActiveByIds).toHaveBeenCalledWith(
      activeVersionInput('EQUIPMENT', ['wand-of-sparks'])
    )
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
    repositoryState.backgrounds = [background]

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

    expect(repositoryCalls.authoredVersionFindActiveByIds).toHaveBeenCalledWith(
      activeVersionInput('RACE', ['human'])
    )
    expect(repositoryCalls.authoredVersionFindActiveByIds).toHaveBeenCalledWith(
      activeVersionInput('CLASS', ['fighter'])
    )
    expect(repositoryCalls.authoredVersionFindActiveByIds).toHaveBeenCalledWith(
      activeVersionInput('BACKGROUND', ['acolyte'])
    )
    expect(repositoryCalls.authoredVersionFindActiveByIds).toHaveBeenCalledWith(
      activeVersionInput('FEAT', ['magic-initiate'])
    )
    expect(repositoryCalls.authoredVersionFindActiveByIds).toHaveBeenCalledWith(
      activeVersionInput('EQUIPMENT', ['wand-of-sparks'])
    )
    expect(repositoryCalls.featureFindByIds).toHaveBeenLastCalledWith(['direct-feature'], {
      includeEffects: false
    })

    vi.clearAllMocks()

    await loadCharacterBuilderContext({} as never, character, [], { includeEffects: true })

    expect(repositoryCalls.authoredVersionFindActiveByIds).toHaveBeenCalledWith(
      activeVersionInput('RACE', ['human'])
    )
    expect(repositoryCalls.authoredVersionFindActiveByIds).toHaveBeenCalledWith(
      activeVersionInput('CLASS', ['fighter'])
    )
    expect(repositoryCalls.authoredVersionFindActiveByIds).toHaveBeenCalledWith(
      activeVersionInput('BACKGROUND', ['acolyte'])
    )
    expect(repositoryCalls.authoredVersionFindActiveByIds).toHaveBeenCalledWith(
      activeVersionInput('FEAT', ['magic-initiate'])
    )
    expect(repositoryCalls.authoredVersionFindActiveByIds).toHaveBeenCalledWith(
      activeVersionInput('EQUIPMENT', ['wand-of-sparks'])
    )
    expect(repositoryCalls.featureFindByIds).toHaveBeenLastCalledWith(['direct-feature'], {
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

  it('loads structural facts from the vocabulary snapshot without presentation catalog queries', async () => {
    const race = createRace('human')
    const fighter = createFighter()
    repositoryState.races = [race]
    repositoryState.classes = [fighter]
    const chain = {
      limit: () => chain,
      select: () => chain,
      where: () => chain,
      execute: async () => []
    }
    const db = { selectFrom: () => chain }

    const context = await loadCharacterStructuralRuleContext(
      db as never,
      createCharacter(race.id, fighter.id)
    )

    expect(context.registry.system).toMatchObject({ id: 'system-1', label: 'D&D 5e 2014' })
    expect(repositoryCalls.snapshotFindActive).toHaveBeenCalledWith('system-1')
    expect(repositoryCalls.backgroundListQuery).not.toHaveBeenCalled()
    expect(repositoryCalls.classListQuery).not.toHaveBeenCalled()
    expect(repositoryCalls.equipmentListQuery).not.toHaveBeenCalled()
    expect(repositoryCalls.featListQuery).not.toHaveBeenCalled()
    expect(repositoryCalls.raceListQuery).not.toHaveBeenCalled()
    expect(repositoryCalls.spellListQuery).not.toHaveBeenCalled()
  })

  it('keeps selected Feat and Equipment grant targets in the bounded structural registry', async () => {
    const race = createRace('human')
    const fighter = createFighter()
    const featFeature = createChosenFeatFeature()
    const equipmentFeature = createChosenEquipmentFeature()
    const feat: FeatAuthored = {
      id: 'chosen-feat',
      label: 'Chosen Feat',
      description: '',
      userId: 'user-1',
      systemId: 'system-1'
    }
    const equipment: CharacterBuilderRegistry['equipment'][number] = {
      kind: 'EQUIPMENT' as const,
      id: 'chosen-equipment',
      label: 'Chosen Equipment',
      description: null,
      category: 'ADVENTURING_GEAR',
      properties: [],
      weight: { amount: 1, unit: 'POUNDS' as const },
      rarityId: 'COMMON',
      userId: 'user-1',
      systemId: 'system-1'
    }
    repositoryState.races = [race]
    repositoryState.classes = [{ ...fighter, features: [featFeature, equipmentFeature] }]
    repositoryState.feats = [feat]
    repositoryState.equipment = [equipment]
    const character = createCharacter(race.id, fighter.id)
    repositoryCalls.structureQuery.mockResolvedValue({
      rootFeatureLinks: [
        {
          ownerKind: 'CLASS',
          ownerId: fighter.id,
          featureId: featFeature.id,
          order: 0,
          availableAtLevel: 1
        },
        {
          ownerKind: 'CLASS',
          ownerId: fighter.id,
          featureId: equipmentFeature.id,
          order: 1,
          availableAtLevel: 1
        }
      ],
      ancestryOptions: [],
      featureOptions: [],
      featureOptionChoices: []
    })
    character.intent.chosenGrantSelections = [
      {
        id: 'chosen-feat-selection',
        grantId: 'chosen-feat-grant',
        source: { kind: 'CLASS', classId: fighter.id, classLevel: 1 },
        timing: { kind: 'IMMEDIATE' },
        targetIds: [feat.id]
      },
      {
        id: 'chosen-equipment-selection',
        grantId: 'chosen-equipment-grant',
        source: { kind: 'CLASS', classId: fighter.id, classLevel: 1 },
        timing: { kind: 'IMMEDIATE' },
        targetIds: [equipment.id]
      }
    ]
    const expression = Object.assign((...args: unknown[]) => args, {
      or: (terms: unknown[]) => terms
    })
    const chain = {
      innerJoin: () => chain,
      limit: () => chain,
      select: () => chain,
      where: (condition?: unknown) => {
        if (typeof condition === 'function') condition(expression)
        return chain
      },
      whereRef: () => chain,
      execute: async () => []
    }
    const context = await loadCharacterStructuralRuleContext(
      { selectFrom: () => chain } as never,
      character
    )
    const resolution = await resolveCharacterBuilder({} as never, character, 'create', context)

    expect(context.registry.feats?.map((record) => record.id)).toEqual([feat.id])
    expect(context.registry.equipment.map((record) => record.id)).toEqual([equipment.id])
    expect(resolution.chosenGrantChoices).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          grantId: 'chosen-feat-grant',
          options: [{ id: feat.id, label: feat.label }]
        }),
        expect.objectContaining({
          grantId: 'chosen-equipment-grant',
          options: [{ id: equipment.id, label: equipment.label }]
        })
      ])
    )
    expect(repositoryCalls.backgroundListQuery).not.toHaveBeenCalled()
    expect(repositoryCalls.classListQuery).not.toHaveBeenCalled()
    expect(repositoryCalls.equipmentListQuery).not.toHaveBeenCalled()
    expect(repositoryCalls.featListQuery).not.toHaveBeenCalled()
    expect(repositoryCalls.raceListQuery).not.toHaveBeenCalled()
    expect(repositoryCalls.spellListQuery).not.toHaveBeenCalled()
  })

  it('rejects selected Feat and Equipment targets that are absent from bounded structural records', async () => {
    const race = createRace('human')
    const fighter = createFighter()
    const featFeature = createChosenFeatFeature('unavailable-feat')
    const equipmentFeature = createChosenEquipmentFeature('unavailable-equipment')
    repositoryState.races = [race]
    repositoryState.classes = [{ ...fighter, features: [featFeature, equipmentFeature] }]
    const character = createCharacter(race.id, fighter.id)
    repositoryCalls.structureQuery.mockResolvedValue({
      rootFeatureLinks: [
        {
          ownerKind: 'CLASS',
          ownerId: fighter.id,
          featureId: featFeature.id,
          order: 0,
          availableAtLevel: 1
        },
        {
          ownerKind: 'CLASS',
          ownerId: fighter.id,
          featureId: equipmentFeature.id,
          order: 1,
          availableAtLevel: 1
        }
      ],
      ancestryOptions: [],
      featureOptions: [],
      featureOptionChoices: []
    })
    character.intent.chosenGrantSelections = [
      {
        id: 'chosen-feat-selection',
        grantId: 'chosen-feat-grant',
        source: { kind: 'CLASS', classId: fighter.id, classLevel: 1 },
        timing: { kind: 'IMMEDIATE' },
        targetIds: ['unavailable-feat']
      },
      {
        id: 'chosen-equipment-selection',
        grantId: 'chosen-equipment-grant',
        source: { kind: 'CLASS', classId: fighter.id, classLevel: 1 },
        timing: { kind: 'IMMEDIATE' },
        targetIds: ['unavailable-equipment']
      }
    ]
    const chain = {
      innerJoin: () => chain,
      limit: () => chain,
      select: () => chain,
      where: () => chain,
      execute: async () => []
    }
    const context = await loadCharacterStructuralRuleContext(
      { selectFrom: () => chain } as never,
      character
    )
    const resolution = await resolveCharacterBuilder({} as never, character, 'create', context)

    expect(resolution.chosenGrantChoices.map((choice) => choice.options)).toEqual([[], []])
    expect(resolution.validations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'CHOSEN_GRANT_OPTIONS_UNAVAILABLE' })
      ])
    )
    expect(repositoryCalls.backgroundListQuery).not.toHaveBeenCalled()
    expect(repositoryCalls.classListQuery).not.toHaveBeenCalled()
    expect(repositoryCalls.equipmentListQuery).not.toHaveBeenCalled()
    expect(repositoryCalls.featListQuery).not.toHaveBeenCalled()
    expect(repositoryCalls.raceListQuery).not.toHaveBeenCalled()
    expect(repositoryCalls.spellListQuery).not.toHaveBeenCalled()
  })

  it('keeps Campaign-only structural Spell summaries separate from exact documents', async () => {
    const race = createRace('human')
    const baseClass = {
      ...createCleric(),
      id: 'campaign-cleric',
      label: 'Campaign Cleric',
      subclassSelectionLevel: 1
    }
    const subclass: Extract<ClassAuthored, { category: typeof CLASS_CATEGORY.SUBCLASS }> = {
      id: 'campaign-domain',
      label: 'Campaign Domain',
      category: CLASS_CATEGORY.SUBCLASS,
      parentClassId: baseClass.id,
      userId: 'user-1',
      systemId: 'system-1'
    }
    const spell = {
      ...createFireBolt(),
      kind: 'SPELL' as const,
      classIds: [baseClass.id],
      userId: 'user-1',
      systemId: 'system-1'
    } satisfies SpellAuthored
    const unrelatedSpell = {
      ...spell,
      id: 'unrelated-campaign-spell',
      classIds: ['other-class']
    } satisfies SpellAuthored
    repositoryState.races = [race]
    repositoryState.campaignAssignment = { campaignId: 'campaign-1', userId: 'user-1' }
    const character = createCharacter(race.id, baseClass.id)
    const overrides = [
      createCampaignSource('CLASS', baseClass.id, baseClass),
      createCampaignSource('CLASS', subclass.id, subclass),
      createCampaignSource('SPELL', spell.id, spell),
      createCampaignSource('SPELL', unrelatedSpell.id, unrelatedSpell)
    ]
    const expression = Object.assign((...args: unknown[]) => args, {
      or: (terms: unknown[]) => terms
    })
    const chain = {
      innerJoin: () => chain,
      limit: () => chain,
      select: () => chain,
      where: (condition?: unknown) => {
        if (typeof condition === 'function') condition(expression)
        return chain
      },
      whereRef: () => chain,
      execute: async () => []
    }
    const context = await loadCharacterStructuralRuleContext(
      { selectFrom: () => chain } as never,
      character,
      overrides
    )
    const resolution = await resolveCharacterBuilder({} as never, character, 'create', context)

    expect(context.catalog.classes).toContainEqual(
      expect.objectContaining({ id: subclass.id, parentClassId: baseClass.id })
    )
    expect(context.catalog.spells).toContainEqual(expect.objectContaining({ id: spell.id }))
    expect(
      context.catalog.spells.find((candidate) => candidate.id === spell.id)
    ).not.toHaveProperty('kind')
    expect(context.catalog.spells).not.toContainEqual(
      expect.objectContaining({ id: unrelatedSpell.id })
    )
    expect(context.spellDocumentsById?.has(spell.id)).toBe(false)
    expect(resolution.outstandingChoices).toContainEqual(
      expect.objectContaining({ code: 'SUBCLASS_SELECTION_REQUIRED' })
    )
    expect(repositoryCalls.backgroundListQuery).not.toHaveBeenCalled()
    expect(repositoryCalls.classListQuery).not.toHaveBeenCalled()
    expect(repositoryCalls.equipmentListQuery).not.toHaveBeenCalled()
    expect(repositoryCalls.featListQuery).not.toHaveBeenCalled()
    expect(repositoryCalls.raceListQuery).not.toHaveBeenCalled()
    expect(repositoryCalls.spellListQuery).toHaveBeenCalledOnce()
  })

  it("hydrates a different member's exact current shared Spell without widening the catalogue", async () => {
    const race = createRace('human')
    const cleric = createCleric()
    const sharedSpell = {
      ...createFireBolt(),
      kind: 'SPELL' as const,
      id: 'shared-campaign-spell',
      classIds: [cleric.id],
      userId: 'author-2',
      systemId: 'system-1'
    } satisfies SpellAuthored
    const unrelatedSpell = {
      ...sharedSpell,
      id: 'unrelated-shared-spell',
      classIds: ['other-class']
    } satisfies SpellAuthored
    repositoryState.races = [race]
    repositoryState.classes = [cleric]
    repositoryState.spells = []
    repositoryState.campaignAssignment = { campaignId: 'campaign-1', userId: 'user-1' }
    repositoryCalls.campaignContentListCurrentSources.mockResolvedValue(
      [sharedSpell, unrelatedSpell].map((spell) => {
        const source = createCampaignSource('SPELL', spell.id, spell)
        return {
          share: {
            campaignId: 'campaign-1',
            subjectKind: 'SPELL',
            subjectId: spell.id,
            sharedBy: 'author-2',
            createdAt: '2026-08-22T00:00:00.000Z',
            updatedAt: '2026-08-22T00:00:00.000Z'
          },
          source: createCampaignVersionRecord(source)
        }
      })
    )
    const character = createCharacter(race.id, cleric.id)
    character.intent.spellSelections = [
      {
        id: 'cleric-spells',
        source: { kind: 'CLASS', classId: cleric.id },
        timing: { kind: 'IMMEDIATE' },
        spells: [sharedSpell.id]
      }
    ]
    const chain = {
      limit: () => chain,
      select: () => chain,
      where: () => chain,
      execute: async () => []
    }

    const context = await loadCharacterStructuralRuleContext(
      { selectFrom: () => chain } as never,
      character
    )

    expect(context.catalog.spells.map((spell) => spell.id)).toEqual([sharedSpell.id])
    expect(context.catalog.spells[0]).not.toHaveProperty('kind')
    expect(context.spellDocumentsById).toEqual(new Map([[sharedSpell.id, sharedSpell]]))
    expect(context.spellDocumentsById?.has(unrelatedSpell.id)).toBe(false)
  })

  it('loads exact owner and Master Spell documents through the bounded active-version seam', async () => {
    const ownerSpell = {
      ...createFireBolt(),
      kind: 'SPELL' as const,
      id: 'owner-spell',
      userId: 'user-1',
      systemId: 'system-1'
    } satisfies SpellAuthored
    const masterSpell = {
      ...createFireBolt(),
      kind: 'SPELL' as const,
      id: 'master-spell',
      userId: 'master',
      systemId: 'system-1'
    } satisfies SpellAuthored
    repositoryState.spells = [ownerSpell, masterSpell]

    const documents = await loadCharacterStructuralSpellCatalog({
      db: {} as never,
      systemId: 'system-1',
      userId: 'user-1',
      spellIds: [ownerSpell.id, masterSpell.id]
    })

    expect(documents).toEqual([ownerSpell, masterSpell])
    expect(repositoryCalls.authoredVersionFindActiveByIds).toHaveBeenCalledWith(
      activeVersionInput('SPELL', [ownerSpell.id, masterSpell.id])
    )
  })

  it('uses the exact current shared Campaign Feat without a Character binding', async () => {
    const race = createRace('human')
    const fighter = createFighter()
    const currentFeat: FeatAuthored = {
      id: 'campaign-feat',
      label: 'Current Campaign Feat',
      description: '',
      userId: 'user-1',
      systemId: 'system-1'
    }
    const currentSource = createCampaignSource('FEAT', currentFeat.id, currentFeat)
    repositoryState.races = [race]
    repositoryState.classes = [fighter]
    repositoryState.campaignAssignment = { campaignId: 'campaign-1', userId: 'user-1' }
    repositoryCalls.campaignContentListCurrentSources.mockResolvedValue([
      {
        share: {
          campaignId: 'campaign-1',
          subjectKind: 'FEAT',
          subjectId: currentFeat.id,
          sharedBy: 'user-1',
          createdAt: '2026-08-22T00:00:00.000Z',
          updatedAt: '2026-08-22T00:00:00.000Z'
        },
        source: createCampaignVersionRecord(currentSource)
      }
    ])
    const character = createCharacter(race.id, fighter.id)
    character.intent.featureAcquisitions = [
      {
        id: 'campaign-feat-acquisition',
        featureId: currentFeat.id,
        source: { kind: 'FEAT', featId: currentFeat.id },
        timing: { kind: 'IMMEDIATE' }
      }
    ]
    const chain = {
      limit: () => chain,
      select: () => chain,
      where: () => chain,
      execute: async () => []
    }
    const context = await loadCharacterStructuralRuleContext(
      { selectFrom: () => chain } as never,
      character
    )

    expect(context.registry.feats).toEqual([expect.objectContaining({ label: currentFeat.label })])
    expect(repositoryCalls.backgroundListQuery).not.toHaveBeenCalled()
    expect(repositoryCalls.classListQuery).not.toHaveBeenCalled()
    expect(repositoryCalls.equipmentListQuery).not.toHaveBeenCalled()
    expect(repositoryCalls.featListQuery).not.toHaveBeenCalled()
    expect(repositoryCalls.raceListQuery).not.toHaveBeenCalled()
    expect(repositoryCalls.spellListQuery).not.toHaveBeenCalled()
  })

  it('fails closed when exact structural Spell candidates exceed the bound before hydration', async () => {
    await expect(
      loadCharacterStructuralSpellCatalog({
        db: {} as never,
        systemId: 'system-1',
        userId: 'user-1',
        spellIds: Array.from({ length: 501 }, (_, index) => `spell-${index}`)
      })
    ).rejects.toThrow('Character structural spell candidates exceed the bounded catalogue limit.')
    expect(repositoryCalls.authoredVersionFindActiveByIds).not.toHaveBeenCalled()
    expect(repositoryCalls.spellListQuery).not.toHaveBeenCalled()
  })
})
