import { describe, expect, it } from 'vitest'
import type { DBLike } from '@artificer-toolkit/db'
import type { CharacterSheetResponseDto } from '@artificer-toolkit/schema/api/characters'
import {
  AUTHORING_MODE_KIND,
  AUTHORING_SELECTION_KIND,
  FEATURE_ATTRIBUTE,
  GRANT_KIND,
  MODIFIER_KIND,
  MODIFIER_SCOPE_KIND,
  SCALING,
  SPELL_GRANT_ATTRIBUTE,
  SPELLCASTING_ATTRIBUTE,
  VALUE_DOMAIN_CODE
} from '@artificer-toolkit/shared/core'
import type { CharacterAuthored } from '@artificer-toolkit/shared/subjects/authored'
import type { CharacterBuilderResolution } from './builderService.js'
import {
  CharacterSheetCommandError,
  applyCharacterSheetCommand,
  assertCampaignGmSheetCommandAllowed,
  buildCharacterSheetResponse,
  summarizeCharacterSheetCommand
} from './sheetService.js'

function createCharacter(): CharacterAuthored {
  return {
    id: 'character-1',
    label: 'Aria',
    description: 'A test character.',
    status: 'ACTIVE',
    profile: {},
    systemId: 'system-1',
    userId: 'user-1',
    intent: {
      advancement: { method: 'MILESTONE' },
      race: { raceId: 'race-1' },
      background: { backgroundId: 'background-1' },
      classes: [{ classId: 'class-1', classLevel: 1 }],
      abilities: {
        method: 'STANDARD_ARRAY',
        assignments: [{ ability: 'DEXTERITY', option: '14' }]
      },
      hitpoints: {
        method: 'FIXED',
        levels: [{ level: 1, classId: 'class-1', classLevel: 1, value: 12 }]
      },
      featureAcquisitions: [],
      spellSelections: [
        {
          id: 'spell-selection-1',
          source: { kind: 'CLASS', classId: 'class-1' },
          timing: { kind: 'IMMEDIATE' },
          spells: ['spell-1']
        }
      ],
      resourceGrants: [
        {
          id: 'resource-1',
          resourceId: 'resource-1',
          source: { kind: 'CLASS', classId: 'class-1' },
          timing: { kind: 'IMMEDIATE' }
        }
      ]
    },
    state: {
      equipment: {
        inventory: [
          { id: 'item-1', equipmentId: 'equipment-1', quantity: 1 },
          { id: 'item-2', equipmentId: 'equipment-2', quantity: 1 },
          { id: 'item-3', equipmentId: 'equipment-3', quantity: 1 }
        ],
        equipped: [],
        attuned: ['item-1', 'item-2', 'item-3']
      },
      currency: [],
      hitpoints: {
        current: 10,
        temp: 3,
        hitDice: [{ die: 8, total: 1, used: 0 }]
      },
      resources: [{ resourceGrantId: 'resource-1', used: 1 }],
      spellSlots: [{ slotKey: 'STANDARD:1', used: 1 }],
      classes: [
        {
          classId: 'class-1',
          spells: {
            learned: ['spell-1']
          }
        }
      ]
    }
  }
}

type SheetResource = CharacterSheetResponseDto['resources']['items'][number]
type SheetSpellSource = NonNullable<
  CharacterSheetResponseDto['spells']['spells'][number]['sources']
>[number]

function createSheetResource(overrides: Partial<SheetResource> = {}): SheetResource {
  return {
    id: 'resource-1',
    owner: {
      kind: 'AUTHORED_GRANT',
      resourceGrantId: 'resource-1',
      source: {
        kind: 'AUTHORED',
        sourceKind: 'CLASS',
        definitionId: 'class-1',
        sourceInstanceId: 'CLASS:class-1'
      }
    },
    label: 'Second Wind',
    sourceLabel: 'Fighter',
    used: 1,
    max: 2,
    remaining: 1,
    recoveries: [{ trigger: 'LONG_REST', amount: { kind: 'ALL' } }],
    ...overrides
  }
}

function createSheetSpellSource(
  spellId: string,
  overrides: Partial<SheetSpellSource> = {}
): SheetSpellSource {
  return {
    source: {
      spellId,
      sourceKind: 'CLASS',
      sourceInstanceId: 'CLASS:class-1'
    },
    classId: 'class-1',
    label: 'Fighter',
    canPrepare: true,
    prepared: false,
    ...overrides
  }
}

function createSheet(
  overrides: Partial<CharacterSheetResponseDto> = {}
): CharacterSheetResponseDto {
  return {
    meta: {
      characterId: 'character-1',
      viewer: 'CHARACTER_OWNER',
      capabilities: {
        managePlayState: true,
        managePrivateNotes: true,
        manageInventory: true,
        openBuilder: true
      },
      systemId: 'system-1',
      status: 'ACTIVE',
      streamVersion: 1
    },
    identity: {
      label: 'Aria',
      classSummary: 'Fighter 1',
      totalLevel: 1
    },
    overview: {
      abilities: [{ ability: 'DEXTERITY', score: 14, modifier: 2, rollMode: 'NORMAL' }],
      savingThrows: [],
      skills: [],
      facts: [],
      armorClass: 12,
      initiative: 2,
      initiativeRollMode: 'NORMAL',
      proficiencyBonus: 2,
      currentHitPoints: 10,
      maxHitPoints: 12,
      tempHitPoints: 3,
      maxHitPointsOverride: null,
      maxHitPointsModifier: 0,
      maxHitPointsModifierAdjustmentId: null,
      exhaustion: {
        label: 'Exhaustion',
        description: 'Exhaustion measures cumulative physical and mental fatigue.',
        level: 0,
        minimumLevel: 0,
        maximumLevel: 6
      },
      conditions: [],
      hitDice: [{ die: 8, total: 1, used: 0, remaining: 1 }]
    },
    actions: { items: [] },
    resources: {
      items: [createSheetResource()],
      hitDice: [{ die: 8, total: 1, used: 0, remaining: 1 }]
    },
    spells: {
      saveDc: 12,
      attackBonus: 4,
      slots: [
        {
          slotKey: 'STANDARD:1',
          label: 'Level 1',
          level: 1,
          max: 2,
          used: 1,
          remaining: 1
        }
      ],
      spells: [
        {
          id: 'spell-1',
          label: 'Shield',
          level: 1,
          prepared: false,
          known: true,
          sources: [createSheetSpellSource('spell-1')]
        }
      ],
      activeGroups: [],
      preparationSources: [{ classId: 'class-1', label: 'Fighter', preparedSpellIds: [] }]
    },
    inventory: {
      items: [],
      currencies: []
    },
    reference: {
      features: [],
      proficiencies: [],
      defenses: [],
      senses: [],
      conditionOptions: [{ id: 'condition-1', code: 'POISONED', label: 'Poisoned' }],
      equipmentOptions: [
        {
          id: 'equipment-1',
          label: 'Sword',
          isContainer: false,
          requiresAttunement: true
        }
      ],
      currencyOptions: [{ id: 'currency-1', label: 'Gold' }]
    },
    notes: {},
    ...overrides,
    extras: overrides.extras ?? {
      kindOptions: [],
      originOptions: [],
      creatureOptions: [],
      vehicleOptions: [],
      items: []
    }
  }
}

function createConditionDb(
  rows: Array<{ id: string; code: string; label: string; description?: string | null }> = [],
  rowsByTable: Readonly<Record<string, unknown[]>> = {}
): DBLike {
  type TestQueryBuilder = {
    select: (...args: unknown[]) => TestQueryBuilder
    innerJoin: (...args: unknown[]) => TestQueryBuilder
    leftJoin: (...args: unknown[]) => TestQueryBuilder
    where: (...args: unknown[]) => TestQueryBuilder
    orderBy: (...args: unknown[]) => TestQueryBuilder
    execute: () => Promise<unknown[]>
  }

  function createQueryBuilder(result: unknown[]): TestQueryBuilder {
    const builder: TestQueryBuilder = {
      select: () => builder,
      innerJoin: () => builder,
      leftJoin: () => builder,
      where: () => builder,
      orderBy: () => builder,
      execute: async () => result
    }
    return builder
  }

  return {
    selectFrom: (table: string) =>
      createQueryBuilder(rowsByTable[table] ?? (table === 'condition_types' ? rows : []))
  } as unknown as DBLike
}

function createSystem(
  overrides: Partial<NonNullable<CharacterBuilderResolution['registry']['system']>> = {}
): NonNullable<CharacterBuilderResolution['registry']['system']> {
  return {
    id: 'system-1',
    label: 'D&D 5e',
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
    userId: 'user-1',
    ...overrides
  }
}

function createResolution(): CharacterBuilderResolution {
  return {
    mode: 'edit',
    catalog: {
      races: [],
      classes: [],
      backgrounds: [],
      equipment: [],
      feats: [],
      spells: []
    },
    registry: {
      system: createSystem(),
      races: [],
      classes: [
        {
          id: 'subclass-1',
          label: 'Battle Master',
          category: 'SUBCLASS',
          parentClassId: 'class-1',
          resources: {
            id: 'resource-1',
            label: 'Superiority Dice',
            description: 'Spend a die to fuel combat maneuvers.',
            availableAtLevel: 1,
            charges: {
              id: 'charge-1',
              resetKind: 'SHORT_REST',
              limitKind: 'FIXED_AMOUNT',
              scalingKind: 'NONE',
              amount: 4
            }
          },
          systemId: 'system-1',
          userId: 'user-1'
        }
      ],
      backgrounds: [],
      equipment: [],
      features: []
    },
    summary: {
      totalLevel: 3,
      abilities: { DEXTERITY: 14 },
      classes: []
    },
    grants: {
      features: [],
      resources: [
        {
          id: 'resource-1',
          label: 'Superiority Dice',
          description: 'Spend a die to fuel combat maneuvers.',
          sourceLabel: 'Battle Master',
          source: { kind: 'SUBCLASS', subclassId: 'subclass-1', classLevel: 3 }
        }
      ],
      spellcasting: []
    },
    chosenGrantChoices: [],
    outstandingChoices: [],
    validations: [],
    readiness: {
      ready: true,
      blockingIssues: [],
      outstandingRequiredChoices: []
    },
    recommendedSectionId: 'REVIEW'
  }
}

function createSpellcastingClass(params: {
  ability?: NonNullable<
    CharacterBuilderResolution['registry']['classes'][number]['spellcasting']
  >['ability']
  attributes?: NonNullable<
    CharacterBuilderResolution['registry']['classes'][number]['spellcasting']
  >['attributes']
  id: string
  label: string
  resetKind: 'LONG_REST' | 'SHORT_REST'
  spellLimits: NonNullable<
    CharacterBuilderResolution['registry']['classes'][number]['spellcasting']
  >['spellLimits']
  maxSpellLevel?: number
}): CharacterBuilderResolution['registry']['classes'][number] {
  return {
    id: params.id,
    label: params.label,
    category: 'BASE',
    spellcasting: {
      spellLimits: params.spellLimits,
      attributes: params.attributes ?? [SPELLCASTING_ATTRIBUTE.PREPARES_SPELLS],
      ability: params.ability,
      maxSpellLevel: params.maxSpellLevel ?? 9,
      charges: {
        id: `${params.id}-spellcasting-charge`,
        resetKind: params.resetKind,
        limitKind: 'FIXED_AMOUNT',
        scalingKind: 'NONE',
        amount: 1
      }
    },
    startingGold: {
      multiplier: 1,
      currencyId: 'gp',
      dieConfig: '1d4'
    },
    startingEquipment: {
      id: `${params.id}-starting-equipment`,
      sets: []
    },
    hitpoint: {
      ability: 'CONSTITUTION',
      dieConfig: '1d8'
    },
    multiclass: {
      id: `${params.id}-multiclass`,
      requirementGroups: {
        groups: []
      }
    },
    systemId: 'system-1',
    userId: 'user-1'
  }
}

function createSpellcastingSubclass(params: {
  attributes?: NonNullable<
    CharacterBuilderResolution['registry']['classes'][number]['spellcasting']
  >['attributes']
  id: string
  label: string
  parentClassId: string
  resetKind: 'LONG_REST' | 'SHORT_REST'
  spellLimits: NonNullable<
    CharacterBuilderResolution['registry']['classes'][number]['spellcasting']
  >['spellLimits']
}): CharacterBuilderResolution['registry']['classes'][number] {
  return {
    id: params.id,
    label: params.label,
    category: 'SUBCLASS',
    parentClassId: params.parentClassId,
    specializations: [{ id: 'subclass-choice-1', label: params.label, order: 1 }],
    spellcasting: {
      spellLimits: params.spellLimits,
      attributes: params.attributes ?? [SPELLCASTING_ATTRIBUTE.PREPARES_SPELLS],
      maxSpellLevel: 9,
      charges: {
        id: `${params.id}-spellcasting-charge`,
        resetKind: params.resetKind,
        limitKind: 'FIXED_AMOUNT',
        scalingKind: 'NONE',
        amount: 1
      }
    },
    userId: 'user-1',
    systemId: 'system-1'
  }
}

function createSpell(params: {
  classIds: string[]
  id: string
  label: string
  level: number
}): CharacterBuilderResolution['catalog']['spells'][number] {
  return {
    id: params.id,
    label: params.label,
    description: '',
    castingTime: {
      unit: 'ROUND',
      amount: 1
    },
    level: params.level,
    classIds: params.classIds,
    magicSchoolId: 'ABJURATION'
  }
}

function createEquipment(params: {
  armorClass?: number
  category: CharacterBuilderResolution['registry']['equipment'][number]['category']
  id: string
  label: string
}): CharacterBuilderResolution['registry']['equipment'][number] {
  return {
    kind: 'EQUIPMENT',
    id: params.id,
    label: params.label,
    description: null,
    status: 'ACTIVE',
    category: params.category,
    properties: [],
    weight: {
      amount: 0,
      unit: 'POUNDS'
    },
    armorClass: params.armorClass,
    rarityId: 'COMMON',
    systemId: 'system-1',
    userId: 'user-1'
  }
}

function createFullCasterSpellLimits() {
  return [
    { classLevel: 1, slots: [{ spellLevel: 1, slotCount: 2 }] },
    { classLevel: 17, slots: [{ spellLevel: 9, slotCount: 1 }] }
  ]
}

describe('character sheet command application', () => {
  it('applies damage to temporary hit points before current hit points', () => {
    const next = applyCharacterSheetCommand(
      createCharacter(),
      {
        type: 'ADJUST_HIT_POINTS',
        mode: 'DAMAGE',
        amount: 5,
        expectedVersion: 1
      },
      createSheet()
    )

    expect(next.state.hitpoints.temp).toBe(0)
    expect(next.state.hitpoints.current).toBe(8)
  })

  it('clamps current hit points when max override is lowered', () => {
    const next = applyCharacterSheetCommand(
      createCharacter(),
      {
        type: 'SET_HIT_POINTS',
        maxOverride: 6,
        expectedVersion: 1
      },
      createSheet()
    )

    expect(next.state.hitpoints).not.toHaveProperty('maxOverride')
    expect(next.state.hitpoints.current).toBe(6)
  })

  it('preserves exhaustion notes when only the exhaustion level changes', () => {
    const character = createCharacter()
    character.state.exhaustion = {
      level: 1,
      notes: 'Forced march through the swamp.'
    }

    const next = applyCharacterSheetCommand(
      character,
      {
        type: 'SET_EXHAUSTION',
        level: 2,
        expectedVersion: 1
      },
      createSheet()
    )

    expect(next.state.exhaustion).toEqual({
      level: 2,
      notes: 'Forced march through the swamp.'
    })
  })

  it('validates exhaustion against the resolved Sheet policy limit', () => {
    expect(() =>
      applyCharacterSheetCommand(
        createCharacter(),
        {
          type: 'SET_EXHAUSTION',
          level: 7,
          expectedVersion: 1
        },
        createSheet()
      )
    ).toThrow('Exhaustion level must be between 0 and 6.')
  })

  it('removes conditions from character state', () => {
    const character = createCharacter()
    character.state.conditions = [
      {
        conditionTypeId: 'condition-1',
        notes: 'Spider venom'
      }
    ]

    const next = applyCharacterSheetCommand(
      character,
      {
        type: 'REMOVE_CONDITION',
        conditionTypeId: 'condition-1',
        expectedVersion: 1
      },
      createSheet()
    )

    expect(next.state.conditions).toBeUndefined()
  })

  it('hydrates exhaustion notes into the sheet overview', async () => {
    const character = createCharacter()
    character.state.exhaustion = {
      level: 1,
      notes: 'Forced march through the swamp.'
    }

    const sheet = await buildCharacterSheetResponse({
      character,
      db: createConditionDb(),
      hasBuilderDraft: false,
      resolution: createResolution(),
      streamVersion: 1
    })

    expect(sheet.overview.exhaustion.level).toBe(1)
    expect(sheet.overview.exhaustion.notes).toBe('Forced march through the swamp.')
  })

  it('hydrates condition descriptions from system vocabulary', async () => {
    const character = createCharacter()
    character.state.conditions = [
      {
        conditionTypeId: 'condition-1',
        notes: 'Spider venom'
      }
    ]

    const sheet = await buildCharacterSheetResponse({
      character,
      db: createConditionDb([
        {
          id: 'condition-1',
          code: 'POISONED',
          label: 'Poisoned',
          description: 'A poisoned creature suffers from toxins affecting its body.'
        }
      ]),
      hasBuilderDraft: false,
      resolution: createResolution(),
      streamVersion: 1
    })

    expect(sheet.overview.conditions).toEqual([
      {
        conditionTypeId: 'condition-1',
        label: 'Poisoned',
        description: 'A poisoned creature suffers from toxins affecting its body.',
        notes: 'Spider venom'
      }
    ])
    expect(sheet.reference.conditionOptions).toEqual([
      {
        id: 'condition-1',
        code: 'POISONED',
        label: 'Poisoned',
        description: 'A poisoned creature suffers from toxins affecting its body.'
      }
    ])
  })

  it('hydrates only displayable engine proficiencies into typed reference facts', async () => {
    const resolution = createResolution()
    const fighter = createSpellcastingClass({
      id: 'class-1',
      label: 'Fighter',
      resetKind: 'LONG_REST',
      spellLimits: []
    })
    fighter.proficiencies = [
      {
        id: 'prof-skill-1',
        order: 1,
        grantKind: 'PROFICIENCY_GRANT',
        proficiencyKind: 'SKILL',
        selectionKind: 'GRANTED',
        scalingKind: 'NONE',
        authoringModeKind: 'SELECTED',
        skillIds: ['skill-athletics'],
        level: 'FULL'
      },
      {
        id: 'prof-save-1',
        order: 2,
        grantKind: 'PROFICIENCY_GRANT',
        proficiencyKind: 'SAVE_ABILITY',
        selectionKind: 'GRANTED',
        scalingKind: 'NONE',
        authoringModeKind: 'SELECTED',
        abilities: ['DEXTERITY'],
        level: 'DOUBLE'
      },
      {
        id: 'prof-armor-1',
        order: 3,
        grantKind: 'PROFICIENCY_GRANT',
        proficiencyKind: 'EQUIPMENT_PROPERTY',
        selectionKind: 'GRANTED',
        scalingKind: 'NONE',
        authoringModeKind: 'SELECTED',
        category: 'ARMOR',
        properties: ['LIGHT'],
        level: 'FULL'
      },
      {
        id: 'prof-weapon-1',
        order: 4,
        grantKind: 'PROFICIENCY_GRANT',
        proficiencyKind: 'EQUIPMENT_PROPERTY',
        selectionKind: 'GRANTED',
        scalingKind: 'NONE',
        authoringModeKind: 'SELECTED',
        category: 'WEAPON',
        properties: ['MARTIAL', 'FINESSE'],
        level: 'FULL'
      },
      {
        id: 'prof-tool-1',
        order: 5,
        grantKind: 'PROFICIENCY_GRANT',
        proficiencyKind: 'EQUIPMENT_PROPERTY',
        selectionKind: 'GRANTED',
        scalingKind: 'NONE',
        authoringModeKind: 'SELECTED',
        category: 'TOOL',
        properties: ['MUSICAL_INSTRUMENT'],
        level: 'FULL'
      },
      {
        id: 'prof-explicit-tool-1',
        order: 6,
        grantKind: 'PROFICIENCY_GRANT',
        proficiencyKind: 'EQUIPMENT',
        selectionKind: 'GRANTED',
        scalingKind: 'NONE',
        authoringModeKind: 'SELECTED',
        category: 'TOOL',
        equipmentIds: ['smiths-tools'],
        level: 'FULL'
      }
    ]
    resolution.catalog.equipment = [
      {
        id: 'smiths-tools',
        label: "Smith's Tools",
        category: 'TOOL',
        isContainer: false,
        properties: [],
        requiresAttunement: false
      }
    ]
    resolution.registry.classes = [fighter]
    resolution.registry.system = createSystem({
      skills: [
        {
          id: 'skill-athletics',
          code: 'ATHLETICS',
          label: 'Athletics'
        }
      ]
    })
    resolution.summary.totalLevel = 1

    const character = createCharacter()
    character.intent.featureAcquisitions = [
      {
        id: 'feature-acquisition-1',
        featureId: 'fighter-training',
        source: { kind: 'CLASS', classId: 'class-1', classLevel: 1 },
        timing: { kind: 'IMMEDIATE' }
      }
    ]

    const sheet = await buildCharacterSheetResponse({
      character,
      db: createConditionDb(),
      hasBuilderDraft: false,
      resolution,
      streamVersion: 1
    })

    expect(sheet.reference.proficiencies).toEqual([
      expect.objectContaining({ kind: 'ARMOR', label: 'Light Armor' }),
      expect.objectContaining({ kind: 'WEAPON', label: 'Martial Weapons' }),
      expect.objectContaining({ kind: 'TOOL', label: 'Musical Instrument' }),
      expect.objectContaining({ kind: 'TOOL', label: "Smith's Tools" })
    ])
  })

  it('applies grants from automatic class features without a redundant acquisition record', async () => {
    const resolution = createResolution()
    const fighter = createSpellcastingClass({
      id: 'class-1',
      label: 'Fighter',
      resetKind: 'LONG_REST',
      spellLimits: []
    })
    fighter.features = [
      {
        id: 'automatic-training',
        label: 'Automatic Training',
        description: 'Gain proficiency in Athletics.',
        order: 1,
        availableAtLevel: 1,
        grants: {
          proficiencies: [
            {
              id: 'automatic-athletics',
              order: 1,
              grantKind: 'PROFICIENCY_GRANT',
              proficiencyKind: 'SKILL',
              selectionKind: 'GRANTED',
              scalingKind: 'NONE',
              authoringModeKind: 'SELECTED',
              skillIds: ['skill-athletics'],
              level: 'FULL'
            }
          ]
        }
      }
    ]
    resolution.registry.classes = [fighter]
    resolution.registry.system = createSystem({
      skills: [{ id: 'skill-athletics', code: 'ATHLETICS', label: 'Athletics' }]
    })
    resolution.summary.totalLevel = 1
    resolution.grants.features = [
      {
        id: 'automatic-training',
        label: 'Automatic Training',
        description: 'Gain proficiency in Athletics.',
        sourceLabel: 'Fighter',
        source: { kind: 'CLASS', classId: 'class-1', classLevel: 1 }
      }
    ]

    const character = createCharacter()
    character.intent.featureAcquisitions = []

    const sheet = await buildCharacterSheetResponse({
      character,
      db: createConditionDb(),
      hasBuilderDraft: false,
      resolution,
      streamVersion: 1
    })

    expect(sheet.reference.proficiencies).toEqual([])
    expect(sheet.overview.skills).toContainEqual(
      expect.objectContaining({ label: 'Athletics', proficiency: 'FULL' })
    )
  })

  it('hydrates engine-derived saving throw overview rows with proficiency levels', async () => {
    const resolution = createResolution()
    const fighter = createSpellcastingClass({
      id: 'class-1',
      label: 'Fighter',
      resetKind: 'LONG_REST',
      spellLimits: []
    })
    fighter.proficiencies = [
      {
        id: 'prof-save-1',
        order: 1,
        grantKind: 'PROFICIENCY_GRANT',
        proficiencyKind: 'SAVE_ABILITY',
        selectionKind: 'GRANTED',
        scalingKind: 'NONE',
        authoringModeKind: 'SELECTED',
        abilities: ['DEXTERITY'],
        level: 'FULL'
      }
    ]
    resolution.registry.classes = [fighter]
    resolution.summary.totalLevel = 1
    resolution.summary.abilities = { DEXTERITY: 14 }

    const character = createCharacter()
    character.intent.featureAcquisitions = [
      {
        id: 'feature-acquisition-1',
        featureId: 'fighter-training',
        source: { kind: 'CLASS', classId: 'class-1', classLevel: 1 },
        timing: { kind: 'IMMEDIATE' }
      }
    ]

    const sheet = await buildCharacterSheetResponse({
      character,
      db: createConditionDb(),
      hasBuilderDraft: false,
      resolution,
      streamVersion: 1
    })

    expect(sheet.overview.savingThrows).toEqual(
      expect.arrayContaining([
        {
          ability: 'DEXTERITY',
          label: 'Dexterity',
          total: 4,
          proficiency: 'FULL',
          rollMode: 'NORMAL'
        }
      ])
    )
    expect(sheet.overview.abilities).toContainEqual({
      ability: 'DEXTERITY',
      score: 14,
      modifier: 2,
      rollMode: 'NORMAL'
    })
  })

  it('hydrates engine-derived skill overview rows with vocabulary-id skill matching', async () => {
    const resolution = createResolution()
    const athleticsSkillId = '00000000-0000-0000-0000-000000000101'
    const fighter = createSpellcastingClass({
      id: 'class-1',
      label: 'Fighter',
      resetKind: 'LONG_REST',
      spellLimits: []
    })
    fighter.proficiencies = [
      {
        id: 'prof-skill-1',
        order: 1,
        grantKind: 'PROFICIENCY_GRANT',
        proficiencyKind: 'SKILL',
        selectionKind: 'GRANTED',
        scalingKind: 'NONE',
        authoringModeKind: 'SELECTED',
        skillIds: [athleticsSkillId],
        level: 'FULL'
      }
    ]
    fighter.features = [
      {
        id: 'athletics-roll-mode',
        label: 'Athletics Roll Mode',
        description: 'Tests projected check modes.',
        order: 1,
        availableAtLevel: 1,
        grants: {
          modifiers: [
            {
              id: 'global-ability-advantage',
              grantKind: 'MODIFIER_GRANT',
              valueDomainCode: 'ABILITY_CHECK',
              modifierKind: 'ADVANTAGE',
              domain: {},
              scope: 'GLOBAL',
              selectionKind: 'GRANTED',
              order: 0
            },
            {
              id: 'athletics-disadvantage',
              grantKind: 'MODIFIER_GRANT',
              valueDomainCode: 'SKILL_MODIFIER',
              modifierKind: 'DISADVANTAGE',
              domain: { skillId: athleticsSkillId },
              scope: 'GLOBAL',
              selectionKind: 'GRANTED',
              order: 1
            }
          ]
        }
      }
    ]
    resolution.registry.classes = [fighter]
    resolution.registry.system = createSystem({
      skills: [
        {
          id: athleticsSkillId,
          code: 'ATHLETICS',
          label: 'Athletics'
        }
      ]
    })
    resolution.summary.totalLevel = 1
    resolution.summary.abilities = { STRENGTH: 14 }

    const character = createCharacter()
    character.intent.featureAcquisitions = [
      {
        id: 'feature-acquisition-1',
        featureId: 'athletics-roll-mode',
        source: { kind: 'CLASS', classId: 'class-1', classLevel: 1 },
        timing: { kind: 'IMMEDIATE' }
      }
    ]

    const sheet = await buildCharacterSheetResponse({
      character,
      db: createConditionDb(),
      hasBuilderDraft: false,
      resolution,
      streamVersion: 1
    })

    expect(sheet.overview.skills).toEqual(
      expect.arrayContaining([
        {
          skillId: athleticsSkillId,
          code: 'ATHLETICS',
          label: 'Athletics',
          ability: 'STRENGTH',
          total: 4,
          rollMode: 'NORMAL',
          proficiency: 'FULL'
        }
      ])
    )
    expect(sheet.overview.abilities).toContainEqual({
      ability: 'STRENGTH',
      score: 14,
      modifier: 2,
      rollMode: 'ADVANTAGE'
    })
  })

  it('projects passive sense facts from resolved skill totals', async () => {
    const resolution = createResolution()
    resolution.registry.system = createSystem({
      passives: [
        { id: 'passive-perception', code: 'PASSIVE_PERCEPTION', label: 'Passive Perception' },
        {
          id: 'passive-investigation',
          code: 'PASSIVE_INVESTIGATION',
          label: 'Passive Investigation'
        },
        { id: 'passive-insight', code: 'PASSIVE_INSIGHT', label: 'Passive Insight' }
      ],
      skills: [
        { id: 'skill-perception', code: 'PERCEPTION', label: 'Perception' },
        { id: 'skill-investigation', code: 'INVESTIGATION', label: 'Investigation' },
        { id: 'skill-insight', code: 'INSIGHT', label: 'Insight' }
      ]
    })
    resolution.summary.abilities = {
      INTELLIGENCE: 12,
      WISDOM: 14
    }

    const sheet = await buildCharacterSheetResponse({
      character: createCharacter(),
      db: createConditionDb(),
      hasBuilderDraft: false,
      resolution,
      streamVersion: 1
    })

    expect(sheet.overview.facts).toEqual(
      expect.arrayContaining([
        { label: 'Passive Perception', value: '12' },
        { label: 'Passive Investigation', value: '11' },
        { label: 'Passive Insight', value: '12' }
      ])
    )
  })

  it('filters sheet reference features without inventing actions from attributes alone', async () => {
    const resolution = createResolution()
    resolution.grants.features = [
      {
        id: 'feature-hidden',
        label: 'Ability Score Increase',
        description: '<p>Your Strength score increases by 2.</p>',
        attributes: [FEATURE_ATTRIBUTE.HIDDEN_ON_SHEET],
        sourceLabel: 'Dragonborn',
        source: { kind: 'RACE', raceId: 'race-1' }
      },
      {
        id: 'feature-visible',
        label: 'Danger Sense',
        description: '<p>You have advantage on Dexterity saving throws.</p>',
        sourceLabel: 'Barbarian',
        source: { kind: 'CLASS', classId: 'class-1', classLevel: 2 }
      },
      {
        id: 'feature-limited',
        label: 'Second Wind',
        description: '<p>Regain hit points as a bonus action.</p>',
        attributes: [FEATURE_ATTRIBUTE.LIMITED_USE],
        sourceLabel: 'Fighter',
        source: { kind: 'CLASS', classId: 'class-1', classLevel: 1 }
      }
    ]

    const sheet = await buildCharacterSheetResponse({
      character: createCharacter(),
      db: createConditionDb(),
      hasBuilderDraft: false,
      resolution,
      streamVersion: 1
    })

    expect(sheet.actions.items).toEqual([])
    expect(sheet.reference.features).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'feature-visible' }),
        expect.objectContaining({ id: 'feature-limited' })
      ])
    )
    expect(sheet.reference.features).not.toContainEqual(
      expect.objectContaining({ id: 'feature-hidden' })
    )
  })

  it('links a recovery-only feature action to its resource row', async () => {
    const character = createCharacter()
    character.intent.classes = [{ classId: 'class-1', subclassId: 'subclass-1', classLevel: 3 }]
    const resolution = createResolution()
    resolution.grants.features = [
      {
        id: 'subclass-1',
        label: 'Superiority Dice',
        description: '<p>Recover your expended superiority dice.</p>',
        sourceLabel: 'Battle Master',
        source: { kind: 'SUBCLASS', subclassId: 'subclass-1', classLevel: 3 }
      }
    ]
    const rowsByTable = {
      features: [
        {
          ownerId: 'subclass-1',
          label: 'Superiority Dice',
          description: 'Recover your expended superiority dice.',
          sectionCode: 'ACTION',
          availableAtLevel: 3,
          chargeId: null,
          effectId: 'recover-superiority-dice',
          ownerEffectOrder: 1,
          effectOrder: 1
        }
      ],
      effect_invocations: [
        {
          effectId: 'recover-superiority-dice',
          triggerCode: 'ACTIVATED',
          activationType: 'OTHER',
          activationValue: 1,
          rangeCharacteristicId: null,
          shapeCharacteristicId: null,
          savingThrowId: null,
          targetSelectionKind: null,
          targetDispositionKind: null,
          maxTargets: null,
          maxTargetsScaling: null,
          resolutionCount: null,
          resolutionCountScaling: null,
          allowRepeatedTargets: null,
          excludedCreatureTypeIds: null
        }
      ],
      effect_paths: [
        {
          pathId: 'recover-superiority-dice-path',
          effectId: 'recover-superiority-dice',
          order: 1,
          pathCode: 'ON_USE',
          groupType: 'SINGLE',
          selectionKind: 'FIXED',
          originKind: null,
          rangeOverrideCharacteristicId: null,
          targetSelectionKind: null,
          targetDispositionKind: null,
          maxTargets: null,
          maxTargetsScaling: null,
          resolutionCount: null,
          resolutionCountScaling: null,
          allowRepeatedTargets: null,
          excludedCreatureTypeIds: null,
          resultBlockId: 'recover-superiority-dice-result',
          rollTableKind: null,
          die: null
        }
      ],
      effect_result_blocks: [
        {
          resultBlockId: 'recover-superiority-dice-result',
          resultKind: 'SINGLE',
          durationCharacteristicId: null,
          lifecycleRecurringKind: null,
          lifecycleConsumeOnFirstEvent: null,
          lifecycleEndOnEvents: null
        }
      ],
      effect_result_block_outcomes: [
        {
          resultBlockId: 'recover-superiority-dice-result',
          outcomeId: 'recover-superiority-dice-outcome',
          effectKind: 'RESOURCE_RECOVERY',
          order: 1
        }
      ],
      effect_generic_outcomes: [
        {
          outcomeId: 'recover-superiority-dice-outcome',
          effectKind: 'RESOURCE_RECOVERY',
          payload: { label: 'Recover expended superiority dice' }
        }
      ]
    }

    const sheet = await buildCharacterSheetResponse({
      character,
      db: createConditionDb([], rowsByTable),
      hasBuilderDraft: false,
      resolution,
      streamVersion: 1
    })

    const resource = sheet.resources.items.find(({ label }) => label === 'Superiority Dice')
    expect(resource).toBeDefined()
    expect(sheet.actions.items).toContainEqual(
      expect.objectContaining({
        label: 'Superiority Dice',
        kind: 'OTHER',
        resourceGrantId: resource?.id
      })
    )
  })

  it('binds source-charged feature actions to each physical equipment copy', async () => {
    const character = createCharacter()
    character.state.equipment.inventory = [
      {
        id: 'astral-tear-one',
        equipmentId: 'astral-tear',
        quantity: 1,
        customName: 'Vyrre’s Blade'
      },
      {
        id: 'astral-tear-two',
        equipmentId: 'astral-tear',
        quantity: 1,
        customName: 'Vyrre’s Blade'
      }
    ]
    character.state.equipment.attuned = ['astral-tear-one', 'astral-tear-two']
    const resolution = createResolution()
    const equipment = createEquipment({
      category: 'WEAPON',
      id: 'astral-tear',
      label: 'Astral Tear'
    })
    equipment.requiresAttunement = true
    equipment.charges = {
      id: 'astral-tear-charges',
      resetKind: 'DAWN',
      limitKind: 'FIXED_AMOUNT',
      scalingKind: 'NONE',
      amount: 3
    }
    equipment.features = [
      {
        id: 'astral-tear-warping-strike',
        label: 'Warping Strike',
        description: 'Teleport before or after the attack.',
        attributes: ['LIMITED_USE'],
        charges: {
          id: 'astral-tear-warping-strike-charges',
          limitKind: 'SOURCE_CHARGES',
          scalingKind: 'NONE',
          cost: 2
        },
        section: 'ACTION',
        order: 1
      },
      {
        id: 'astral-tear-void-step',
        label: 'Void Step',
        description: 'Step through the void.',
        attributes: ['LIMITED_USE'],
        charges: {
          id: 'astral-tear-void-step-charges',
          limitKind: 'SOURCE_CHARGES',
          scalingKind: 'NONE',
          cost: 1
        },
        section: 'ACTION',
        order: 2
      }
    ]
    resolution.registry.equipment = [equipment]
    const sheet = await buildCharacterSheetResponse({
      character,
      db: createConditionDb([], {
        features: [
          {
            ownerId: 'astral-tear-warping-strike',
            label: 'Warping Strike',
            description: 'Teleport before or after the attack.',
            sectionCode: 'ACTION',
            availableAtLevel: 1,
            chargeId: 'astral-tear-warping-strike-charges',
            effectId: 'warping-strike-effect',
            ownerEffectOrder: 1,
            effectOrder: 1
          }
        ],
        effect_invocations: [
          {
            effectId: 'warping-strike-effect',
            triggerCode: 'ACTIVATED',
            activationType: 'ACTION',
            activationValue: 1,
            rangeCharacteristicId: null,
            shapeCharacteristicId: null,
            savingThrowId: null,
            targetSelectionKind: null,
            targetDispositionKind: null,
            maxTargets: null,
            maxTargetsScaling: null,
            resolutionCount: null,
            resolutionCountScaling: null,
            allowRepeatedTargets: null,
            excludedCreatureTypeIds: null
          }
        ]
      }),
      hasBuilderDraft: false,
      resolution,
      streamVersion: 1
    })

    const actions = sheet.actions.items.filter(({ label }) => label === 'Warping Strike')
    expect(actions).toEqual([
      expect.objectContaining({
        id: 'FEATURE:astral-tear-warping-strike:astral-tear-one:warping-strike-effect',
        resourceGrantId: 'ITEM_INSTANCE:astral-tear-one:astral-tear-charges',
        resourceCost: 2,
        sourceLabel: 'Vyrre’s Blade #1'
      }),
      expect.objectContaining({
        id: 'FEATURE:astral-tear-warping-strike:astral-tear-two:warping-strike-effect',
        resourceGrantId: 'ITEM_INSTANCE:astral-tear-two:astral-tear-charges',
        resourceCost: 2,
        sourceLabel: 'Vyrre’s Blade #2'
      })
    ])
    expect(
      sheet.resources.items
        .filter(({ owner }) => owner.kind === 'ITEM_INSTANCE')
        .map(({ owner }) => (owner.kind === 'ITEM_INSTANCE' ? owner.itemInstanceId : ''))
    ).toEqual(['astral-tear-one', 'astral-tear-two'])
    expect(
      sheet.reference.features
        .filter((feature) => feature.source.kind === 'EQUIPMENT_INSTANCE')
        .map((feature) => ({
          id: feature.id,
          resourceGrantId: feature.resourceGrantId,
          source: feature.source
        }))
    ).toEqual([
      {
        id: 'astral-tear-warping-strike:astral-tear-one',
        resourceGrantId: 'ITEM_INSTANCE:astral-tear-one:astral-tear-charges',
        source: {
          kind: 'EQUIPMENT_INSTANCE',
          equipmentId: 'astral-tear',
          itemInstanceId: 'astral-tear-one'
        }
      },
      {
        id: 'astral-tear-void-step:astral-tear-one',
        resourceGrantId: 'ITEM_INSTANCE:astral-tear-one:astral-tear-charges',
        source: {
          kind: 'EQUIPMENT_INSTANCE',
          equipmentId: 'astral-tear',
          itemInstanceId: 'astral-tear-one'
        }
      },
      {
        id: 'astral-tear-warping-strike:astral-tear-two',
        resourceGrantId: 'ITEM_INSTANCE:astral-tear-two:astral-tear-charges',
        source: {
          kind: 'EQUIPMENT_INSTANCE',
          equipmentId: 'astral-tear',
          itemInstanceId: 'astral-tear-two'
        }
      },
      {
        id: 'astral-tear-void-step:astral-tear-two',
        resourceGrantId: 'ITEM_INSTANCE:astral-tear-two:astral-tear-charges',
        source: {
          kind: 'EQUIPMENT_INSTANCE',
          equipmentId: 'astral-tear',
          itemInstanceId: 'astral-tear-two'
        }
      }
    ])
  })

  it('hydrates spell casting reference details into sheet spells', async () => {
    const resolution = createResolution()
    const spell = createSpell({
      classIds: ['class-1'],
      id: 'spell-1',
      label: 'Shield',
      level: 1
    })
    spell.description = '<p>A shimmering barrier protects you.</p>'
    spell.components = ['VERBAL', 'SOMATIC', 'MATERIAL']
    spell.attributes = ['CONCENTRATION']
    spell.materialDescription = '<p>A pinch of powdered silver.</p>'
    resolution.catalog.spells = [spell]

    const sheet = await buildCharacterSheetResponse({
      character: createCharacter(),
      db: createConditionDb(),
      hasBuilderDraft: false,
      resolution,
      streamVersion: 1
    })

    expect(sheet.spells.spells).toContainEqual(
      expect.objectContaining({
        id: 'spell-1',
        description: '<p>A shimmering barrier protects you.</p>',
        castingTime: { unit: 'ROUND', amount: 1 },
        components: ['VERBAL', 'SOMATIC', 'MATERIAL'],
        attributes: ['CONCENTRATION'],
        materialDescription: '<p>A pinch of powdered silver.</p>'
      })
    )
  })

  it('hydrates inventory item reference details from equipment records', async () => {
    const resolution = createResolution()
    resolution.registry.system = createSystem({
      currencies: [{ id: 'gp', code: 'GP', label: 'Gold' }]
    })
    const equipment = createEquipment({
      category: 'WEAPON',
      id: 'equipment-1',
      label: 'Longsword'
    })
    equipment.description = '<p>A balanced knightly blade.</p>'
    equipment.cost = { amount: 15, currencyId: 'gp' }
    equipment.properties = ['MARTIAL', 'ONE_HANDED']
    equipment.armorClass = 1
    resolution.registry.equipment = [equipment]

    const sheet = await buildCharacterSheetResponse({
      character: createCharacter(),
      db: createConditionDb(),
      hasBuilderDraft: false,
      resolution,
      streamVersion: 1
    })

    expect(sheet.inventory.items).toContainEqual(
      expect.objectContaining({
        id: 'item-1',
        equipmentLabel: 'Longsword',
        description: '<p>A balanced knightly blade.</p>',
        category: 'WEAPON',
        cost: { amount: 15, currencyId: 'gp' },
        costLabel: 'Gold',
        weight: { amount: 0, unit: 'POUNDS' },
        properties: [
          { code: 'MARTIAL', label: 'Martial' },
          { code: 'ONE_HANDED', label: 'One-Handed' }
        ],
        armorClass: 1
      })
    )
  })

  it('uses the slim equipment catalog for add-item options', async () => {
    const resolution = createResolution()
    resolution.catalog.equipment = [
      {
        id: 'backpack',
        label: 'Backpack',
        isContainer: true,
        properties: [],
        requiresAttunement: false
      }
    ]

    const sheet = await buildCharacterSheetResponse({
      character: createCharacter(),
      db: createConditionDb(),
      hasBuilderDraft: false,
      resolution,
      streamVersion: 1
    })

    expect(sheet.reference.equipmentOptions).toEqual([
      {
        id: 'backpack',
        label: 'Backpack',
        isContainer: true,
        requiresAttunement: false
      }
    ])
    expect(resolution.registry.equipment).toEqual([])
  })

  it('rejects resource costs that exceed the remaining uses', () => {
    expect(() =>
      applyCharacterSheetCommand(
        createCharacter(),
        {
          type: 'USE_RESOURCE',
          resourceGrantId: 'resource-1',
          amount: 2,
          expectedVersion: 1
        },
        createSheet()
      )
    ).toThrow('Resource "Second Wind" only has 1 use remaining.')
  })

  it('caps spell slot usage at the sheet maximum', () => {
    const slotNext = applyCharacterSheetCommand(
      createCharacter(),
      {
        type: 'USE_SPELL_SLOT',
        slotKey: 'STANDARD:1',
        expectedVersion: 1
      },
      createSheet()
    )

    expect(slotNext.state.spellSlots).toEqual([{ slotKey: 'STANDARD:1', used: 2 }])
  })

  it('restores resource and spell slot usage fully', () => {
    const character = createCharacter()
    character.state.resources = [{ resourceGrantId: 'resource-1', used: 2 }]
    character.state.spellSlots = [{ slotKey: 'STANDARD:1', used: 2 }]

    const resourceNext = applyCharacterSheetCommand(
      character,
      {
        type: 'RESTORE_RESOURCE',
        resourceGrantId: 'resource-1',
        all: true,
        expectedVersion: 1
      },
      createSheet()
    )
    const slotNext = applyCharacterSheetCommand(
      character,
      {
        type: 'RESTORE_SPELL_SLOT',
        slotKey: 'STANDARD:1',
        all: true,
        expectedVersion: 1
      },
      createSheet()
    )

    expect(resourceNext.state.resources).toBeUndefined()
    expect(slotNext.state.spellSlots).toBeUndefined()
  })

  it('rejects spending unavailable hit dice', () => {
    const character = createCharacter()
    character.state.hitpoints.hitDice = [{ die: 8, total: 1, used: 1 }]

    expect(() =>
      applyCharacterSheetCommand(
        character,
        {
          type: 'USE_HIT_DIE',
          die: 8,
          expectedVersion: 1
        },
        createSheet()
      )
    ).toThrow(CharacterSheetCommandError)

    expect(() =>
      applyCharacterSheetCommand(
        character,
        {
          type: 'USE_HIT_DIE',
          die: 10,
          expectedVersion: 1
        },
        createSheet()
      )
    ).toThrow(CharacterSheetCommandError)
  })

  it('applies short rest recovery without clearing long-rest resources or standard slots', () => {
    const character = createCharacter()
    character.state.resources = [
      { resourceGrantId: 'resource-1', used: 1 },
      { resourceGrantId: 'long-resource', used: 1 }
    ]
    character.state.spellSlots = [
      { slotKey: 'STANDARD:1', used: 1 },
      { slotKey: 'PACT', used: 1 }
    ]
    const sheet = createSheet()
    sheet.resources.items = [
      createSheetResource({
        recoveries: [{ trigger: 'SHORT_REST', amount: { kind: 'ALL' } }]
      }),
      createSheetResource({
        id: 'long-resource',
        label: 'Daily Resolve',
        used: 1,
        max: 1,
        remaining: 0,
        recoveries: [{ trigger: 'LONG_REST', amount: { kind: 'ALL' } }]
      })
    ]
    sheet.spells.slots = [
      ...sheet.spells.slots,
      {
        slotKey: 'PACT',
        label: 'Pact Magic',
        level: null,
        max: 1,
        used: 1,
        remaining: 0
      }
    ]

    const next = applyCharacterSheetCommand(
      character,
      {
        type: 'APPLY_REST',
        restKind: 'SHORT',
        expectedVersion: 1
      },
      sheet
    )

    expect(next.state.resources).toEqual([{ resourceGrantId: 'long-resource', used: 1 }])
    expect(next.state.spellSlots).toEqual([{ slotKey: 'STANDARD:1', used: 1 }])
  })

  it('preserves manual resources on long rest while restoring rest resources', () => {
    const character = createCharacter()
    character.state.resources = [
      { resourceGrantId: 'short-resource', used: 1 },
      { resourceGrantId: 'long-resource', used: 1 },
      { resourceGrantId: 'manual-resource', used: 2 }
    ]
    const sheet = createSheet()
    sheet.resources.items = [
      createSheetResource({
        id: 'short-resource',
        label: 'Action Surge',
        used: 1,
        max: 1,
        remaining: 0,
        recoveries: [{ trigger: 'SHORT_REST', amount: { kind: 'ALL' } }]
      }),
      createSheetResource({
        id: 'long-resource',
        label: 'Daily Resolve',
        used: 1,
        max: 1,
        remaining: 0,
        recoveries: [{ trigger: 'LONG_REST', amount: { kind: 'ALL' } }]
      }),
      createSheetResource({
        id: 'manual-resource',
        label: 'Manual Charge',
        sourceLabel: 'Item',
        used: 2,
        max: 3,
        remaining: 1,
        recoveries: [{ trigger: 'MANUAL', amount: { kind: 'ALL' } }]
      })
    ]

    const next = applyCharacterSheetCommand(
      character,
      {
        type: 'APPLY_REST',
        restKind: 'LONG',
        expectedVersion: 1
      },
      sheet
    )

    expect(next.state.resources).toEqual([{ resourceGrantId: 'manual-resource', used: 2 }])
  })

  it('recovers long-rest hit dice from one shared floor-half pool', () => {
    const character = createCharacter()
    character.state.hitpoints.hitDice = [
      { die: 8, total: 3, used: 3 },
      { die: 10, total: 1, used: 1 }
    ]

    const next = applyCharacterSheetCommand(
      character,
      {
        type: 'APPLY_REST',
        restKind: 'LONG',
        expectedVersion: 1
      },
      createSheet()
    )

    expect(next.state.hitpoints.hitDice).toEqual([
      { die: 8, total: 3, used: 1 },
      { die: 10, total: 1, used: 1 }
    ])
  })

  it('recovers a minimum of one hit die on long rest', () => {
    const character = createCharacter()
    character.state.hitpoints.hitDice = [{ die: 8, total: 1, used: 1 }]

    const next = applyCharacterSheetCommand(
      character,
      {
        type: 'APPLY_REST',
        restKind: 'LONG',
        expectedVersion: 1
      },
      createSheet()
    )

    expect(next.state.hitpoints.hitDice).toEqual([{ die: 8, total: 1, used: 0 }])
  })

  it('removes the final exhaustion level on long rest', () => {
    const character = createCharacter()
    character.state.exhaustion = { level: 1, notes: 'One level remaining.' }

    const next = applyCharacterSheetCommand(
      character,
      {
        type: 'APPLY_REST',
        restKind: 'LONG',
        expectedVersion: 1
      },
      createSheet()
    )

    expect(next.state.exhaustion).toBeUndefined()
  })

  it('rejects commands for unavailable resources and spell slots', () => {
    expect(() =>
      applyCharacterSheetCommand(
        createCharacter(),
        {
          type: 'USE_RESOURCE',
          resourceGrantId: 'missing-resource',
          expectedVersion: 1
        },
        createSheet()
      )
    ).toThrow(CharacterSheetCommandError)

    expect(() =>
      applyCharacterSheetCommand(
        createCharacter(),
        {
          type: 'USE_SPELL_SLOT',
          slotKey: 'STANDARD:9',
          expectedVersion: 1
        },
        createSheet()
      )
    ).toThrow(CharacterSheetCommandError)
  })

  it('rejects impossible inventory and attunement commands', () => {
    expect(() =>
      applyCharacterSheetCommand(
        createCharacter(),
        {
          type: 'EQUIP_ITEM',
          itemId: 'missing-item',
          expectedVersion: 1
        },
        createSheet()
      )
    ).toThrow(CharacterSheetCommandError)

    const character = createCharacter()
    character.state.equipment.inventory.push({
      id: 'item-4',
      equipmentId: 'equipment-1',
      quantity: 1
    })

    expect(() =>
      applyCharacterSheetCommand(
        character,
        {
          type: 'ATTUNE_ITEM',
          itemId: 'item-4',
          expectedVersion: 1
        },
        createSheet()
      )
    ).toThrow(CharacterSheetCommandError)
  })

  it('keeps equipped and attuned flags when partially removing an inventory stack', () => {
    const character = createCharacter()
    character.state.equipment.inventory = [
      { id: 'item-1', equipmentId: 'equipment-1', quantity: 3 }
    ]
    character.state.equipment.equipped = ['item-1']
    character.state.equipment.attuned = ['item-1']

    const next = applyCharacterSheetCommand(
      character,
      {
        type: 'REMOVE_INVENTORY_ITEM',
        itemId: 'item-1',
        quantity: 1,
        expectedVersion: 1
      },
      createSheet()
    )

    expect(next.state.equipment.inventory).toEqual([
      { id: 'item-1', equipmentId: 'equipment-1', quantity: 2 }
    ])
    expect(next.state.equipment.equipped).toEqual(['item-1'])
    expect(next.state.equipment.attuned).toEqual(['item-1'])
  })

  it('creates a separate owned instance for each non-stackable physical copy', () => {
    const character = createCharacter()
    const sheet = createSheet()
    sheet.reference.equipmentOptions[0] = {
      ...sheet.reference.equipmentOptions[0]!,
      maxStack: 1
    }

    const next = applyCharacterSheetCommand(
      character,
      {
        type: 'ADD_INVENTORY_ITEM',
        equipmentId: 'equipment-1',
        quantity: 2,
        expectedVersion: 1
      },
      sheet
    )

    const addedItems = next.state.equipment.inventory.slice(-2)
    expect(addedItems).toHaveLength(2)
    expect(addedItems.map(({ quantity }) => quantity)).toEqual([1, 1])
    expect([...new Set(addedItems.map(({ id }) => id))]).toHaveLength(2)
  })

  it('does not allow a non-stackable owned instance to represent multiple physical copies', () => {
    const character = createCharacter()
    const sheet = createSheet()
    sheet.reference.equipmentOptions[0] = {
      ...sheet.reference.equipmentOptions[0]!,
      maxStack: 1
    }

    expect(() =>
      applyCharacterSheetCommand(
        character,
        {
          type: 'UPDATE_INVENTORY_ITEM',
          itemId: 'item-1',
          quantity: 2,
          expectedVersion: 1
        },
        sheet
      )
    ).toThrow(/at most 1 item/i)
  })

  it('bounds multi-copy expansion for non-stackable equipment', () => {
    const sheet = createSheet()
    sheet.reference.equipmentOptions[0] = {
      ...sheet.reference.equipmentOptions[0]!,
      maxStack: 1
    }

    expect(() =>
      applyCharacterSheetCommand(
        createCharacter(),
        {
          type: 'ADD_INVENTORY_ITEM',
          equipmentId: 'equipment-1',
          quantity: 101,
          expectedVersion: 1
        },
        sheet
      )
    ).toThrow(/at most 100 non-stackable copies/i)
  })

  it('removes inventory rows and flags when removing a full stack', () => {
    const character = createCharacter()
    character.state.equipment.inventory = [
      { id: 'item-1', equipmentId: 'equipment-1', quantity: 2 },
      { id: 'item-2', equipmentId: 'equipment-2', quantity: 1 }
    ]
    character.state.equipment.equipped = ['item-1']
    character.state.equipment.attuned = ['item-1']

    const next = applyCharacterSheetCommand(
      character,
      {
        type: 'REMOVE_INVENTORY_ITEM',
        itemId: 'item-1',
        expectedVersion: 1
      },
      createSheet()
    )

    expect(next.state.equipment.inventory).toEqual([
      { id: 'item-2', equipmentId: 'equipment-2', quantity: 1 }
    ])
    expect(next.state.equipment.equipped).toEqual([])
    expect(next.state.equipment.attuned).toEqual([])
  })

  it('removes inventory rows and flags when updating quantity to zero', () => {
    const character = createCharacter()
    character.state.equipment.inventory = [
      { id: 'item-1', equipmentId: 'equipment-1', quantity: 2 },
      { id: 'item-2', equipmentId: 'equipment-2', quantity: 1 }
    ]
    character.state.equipment.equipped = ['item-1']
    character.state.equipment.attuned = ['item-1']

    const next = applyCharacterSheetCommand(
      character,
      {
        type: 'UPDATE_INVENTORY_ITEM',
        itemId: 'item-1',
        quantity: 0,
        expectedVersion: 1
      },
      createSheet()
    )

    expect(next.state.equipment.inventory).toEqual([
      { id: 'item-2', equipmentId: 'equipment-2', quantity: 1 }
    ])
    expect(next.state.equipment.equipped).toEqual([])
    expect(next.state.equipment.attuned).toEqual([])
  })

  it('hydrates inventory custom names and notes for sheet editing', async () => {
    const character = createCharacter()
    character.state.equipment.inventory = [
      {
        id: 'item-1',
        equipmentId: 'equipment-1',
        quantity: 1,
        customName: 'Moonlit Blade',
        notes: 'Loaned by the captain'
      }
    ]

    const sheet = await buildCharacterSheetResponse({
      character,
      db: createConditionDb(),
      hasBuilderDraft: false,
      resolution: createResolution(),
      streamVersion: 1
    })

    expect(sheet.inventory.items).toEqual([
      expect.objectContaining({
        id: 'item-1',
        label: 'Moonlit Blade',
        customName: 'Moonlit Blade',
        notes: 'Loaned by the captain'
      })
    ])
  })

  it('validates system-backed condition, equipment, and currency options', () => {
    expect(() =>
      applyCharacterSheetCommand(
        createCharacter(),
        {
          type: 'ADD_CONDITION',
          conditionTypeId: 'missing-condition',
          expectedVersion: 1
        },
        createSheet()
      )
    ).toThrow(CharacterSheetCommandError)

    expect(() =>
      applyCharacterSheetCommand(
        createCharacter(),
        {
          type: 'ADD_INVENTORY_ITEM',
          equipmentId: 'missing-equipment',
          quantity: 1,
          expectedVersion: 1
        },
        createSheet()
      )
    ).toThrow(CharacterSheetCommandError)

    expect(() =>
      applyCharacterSheetCommand(
        createCharacter(),
        {
          type: 'ADJUST_CURRENCY',
          currencyId: 'missing-currency',
          amount: 1,
          expectedVersion: 1
        },
        createSheet()
      )
    ).toThrow(CharacterSheetCommandError)

    expect(() =>
      applyCharacterSheetCommand(
        createCharacter(),
        {
          type: 'ADJUST_CURRENCY',
          currencyId: 'currency-1',
          amount: 1,
          containerId: 'missing-container',
          expectedVersion: 1
        },
        createSheet()
      )
    ).toThrow(CharacterSheetCommandError)
  })

  it('rejects attunement for equipment that does not require it', () => {
    const character = createCharacter()
    character.state.equipment.attuned = []
    const sheet = createSheet({
      inventory: {
        items: [
          {
            id: 'item-1',
            equipmentId: 'equipment-1',
            label: 'Longsword',
            quantity: 1,
            equipped: false,
            attuned: false,
            requiresAttunement: false
          }
        ],
        currencies: []
      }
    })

    expect(() =>
      applyCharacterSheetCommand(
        character,
        {
          type: 'ATTUNE_ITEM',
          itemId: 'item-1',
          expectedVersion: 1
        },
        sheet
      )
    ).toThrow('does not require attunement')
  })

  it('uses the default attunement limit unless the Campaign overrides it', () => {
    const character = createCharacter()
    character.state.equipment.inventory.push({
      id: 'item-4',
      equipmentId: 'equipment-1',
      quantity: 1
    })
    const sheet = createSheet({
      inventory: {
        items: [
          {
            id: 'item-4',
            equipmentId: 'equipment-1',
            label: 'Ring',
            quantity: 1,
            equipped: false,
            attuned: false,
            requiresAttunement: true
          }
        ],
        currencies: []
      }
    })
    const command = { type: 'ATTUNE_ITEM' as const, itemId: 'item-4', expectedVersion: 1 }

    expect(() => applyCharacterSheetCommand(character, command, sheet)).toThrow(
      'more than 3 items'
    )
    expect(
      applyCharacterSheetCommand(character, command, sheet, { attunementSlotLimit: 4 }).state.equipment
        .attuned
    ).toContain('item-4')
  })

  it('rejects adding or moving a container into another container', () => {
    const character = createCharacter()
    character.state.equipment.inventory = [
      { id: 'bag-1', equipmentId: 'bag-equipment', quantity: 1 },
      { id: 'bag-2', equipmentId: 'bag-equipment', quantity: 1 }
    ]
    const baseSheet = createSheet()
    const sheet = createSheet({
      inventory: {
        items: [
          {
            id: 'bag-1',
            equipmentId: 'bag-equipment',
            label: 'Backpack',
            quantity: 1,
            equipped: false,
            attuned: false,
            requiresAttunement: false,
            capacity: { amount: 30, unit: 'POUNDS' }
          },
          {
            id: 'bag-2',
            equipmentId: 'bag-equipment',
            label: 'Satchel',
            quantity: 1,
            equipped: false,
            attuned: false,
            requiresAttunement: false,
            capacity: { amount: 15, unit: 'POUNDS' }
          }
        ],
        currencies: [],
        containers: [
          { id: 'bag-1', label: 'Backpack', itemIds: [], currencies: [] },
          { id: 'bag-2', label: 'Satchel', itemIds: [], currencies: [] }
        ]
      },
      reference: {
        ...baseSheet.reference,
        equipmentOptions: [
          {
            id: 'bag-equipment',
            label: 'Backpack',
            isContainer: true,
            requiresAttunement: false
          }
        ]
      }
    })

    expect(() =>
      applyCharacterSheetCommand(
        character,
        {
          type: 'ADD_INVENTORY_ITEM',
          equipmentId: 'bag-equipment',
          quantity: 1,
          containerId: 'bag-1',
          expectedVersion: 1
        },
        sheet
      )
    ).toThrow('Nested containers are not supported')

    expect(() =>
      applyCharacterSheetCommand(
        character,
        {
          type: 'UPDATE_INVENTORY_ITEM',
          itemId: 'bag-2',
          containerId: 'bag-1',
          expectedVersion: 1
        },
        sheet
      )
    ).toThrow('Nested containers are not supported')
  })

  it('preserves zero currency rows after sheet currency adjustments', () => {
    const character = createCharacter()
    character.state.currency = [
      {
        id: 'currency-group-1',
        containerId: 'coin-pouch',
        currencies: [
          { currencyId: 'currency-1', amount: 1 },
          { currencyId: 'currency-2', amount: 4 }
        ]
      }
    ]

    const next = applyCharacterSheetCommand(
      character,
      {
        type: 'ADJUST_CURRENCY',
        currencyId: 'currency-1',
        amount: -1,
        containerId: 'coin-pouch',
        expectedVersion: 1
      },
      createSheet({
        inventory: {
          items: [],
          currencies: [],
          containers: [
            {
              id: 'coin-pouch',
              label: 'Coin Pouch',
              itemIds: [],
              currencies: []
            }
          ]
        }
      })
    )

    expect(next.state.currency).toEqual([
      {
        id: 'currency-group-1',
        containerId: 'coin-pouch',
        currencies: [
          { currencyId: 'currency-1', amount: 0 },
          { currencyId: 'currency-2', amount: 4 }
        ]
      }
    ])
  })

  it('does not create zero currency rows when subtracting missing currency', () => {
    const next = applyCharacterSheetCommand(
      createCharacter(),
      {
        type: 'ADJUST_CURRENCY',
        currencyId: 'currency-1',
        amount: -1,
        expectedVersion: 1
      },
      createSheet()
    )

    expect(next.state.currency).toEqual([])
  })

  it('summarizes sheet commands with current sheet labels', () => {
    const sheet = createSheet()
    sheet.overview.conditions = [{ conditionTypeId: 'condition-1', label: 'Poisoned' }]
    sheet.inventory.items = [
      {
        id: 'item-1',
        equipmentId: 'equipment-1',
        label: 'Moonlit Blade',
        quantity: 5,
        equipped: false,
        attuned: false,
        requiresAttunement: false
      }
    ]

    expect(
      summarizeCharacterSheetCommand(
        {
          type: 'ADD_CONDITION',
          conditionTypeId: 'condition-1',
          expectedVersion: 1
        },
        sheet
      )
    ).toBe('Poisoned added')
    expect(
      summarizeCharacterSheetCommand(
        {
          type: 'USE_RESOURCE',
          resourceGrantId: 'resource-1',
          expectedVersion: 1
        },
        sheet
      )
    ).toBe('Second Wind used')
    expect(
      summarizeCharacterSheetCommand(
        {
          type: 'USE_SPELL_SLOT',
          slotKey: 'STANDARD:1',
          expectedVersion: 1
        },
        sheet
      )
    ).toBe('Level 1 spell slot used')
    expect(
      summarizeCharacterSheetCommand(
        {
          type: 'EQUIP_ITEM',
          itemId: 'item-1',
          expectedVersion: 1
        },
        sheet
      )
    ).toBe('Moonlit Blade equipped')
    expect(
      summarizeCharacterSheetCommand(
        {
          type: 'REMOVE_INVENTORY_ITEM',
          itemId: 'item-1',
          quantity: 1,
          expectedVersion: 1
        },
        sheet
      )
    ).toBe('Moonlit Blade quantity reduced by 1')
    expect(
      summarizeCharacterSheetCommand(
        {
          type: 'REMOVE_INVENTORY_ITEM',
          itemId: 'item-1',
          expectedVersion: 1
        },
        sheet
      )
    ).toBe('Moonlit Blade removed')
    expect(
      summarizeCharacterSheetCommand(
        {
          type: 'ADJUST_CURRENCY',
          currencyId: 'currency-1',
          amount: 5,
          expectedVersion: 1
        },
        sheet
      )
    ).toBe('Gold updated')
  })

  it('creates Sheet notes without mutating Builder-owned profile fields', () => {
    const character = createCharacter()
    character.description = 'A test character.'
    character.profile.personalityTraits = 'Curious.'
    character.profile.backstory = 'Raised among dangerous archives.'
    character.profile.notes = 'Keep watch at midnight.'
    const ids = ['00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000102']

    const next = applyCharacterSheetCommand(
      character,
      {
        type: 'CREATE_NOTE',
        title: 'Midnight watch',
        body: 'Keep watch at midnight.',
        groupId: 'session-notes',
        expectedVersion: 1
      },
      createSheet(),
      { createId: () => ids.shift() ?? 'unexpected-id' }
    )

    expect(next.description).toBe('A test character.')
    expect(next.profile.personalityTraits).toBe('Curious.')
    expect(next.profile.backstory).toBe('Raised among dangerous archives.')
    expect(next.profile.notes).toBe('Keep watch at midnight.')
    expect(next.state.notes).toEqual([
      expect.objectContaining({
        title: 'Midnight watch',
        body: 'Keep watch at midnight.',
        groupId: '00000000-0000-4000-8000-000000000101'
      })
    ])
    expect(next.state.noteGroups).toContainEqual(
      expect.objectContaining({
        id: '00000000-0000-4000-8000-000000000101',
        kind: 'SESSION'
      })
    )

    const withSecondNote = applyCharacterSheetCommand(
      next,
      {
        type: 'CREATE_NOTE',
        title: 'Second watch',
        groupId: 'session-notes',
        expectedVersion: 1
      },
      createSheet(),
      {
        createId: () => '00000000-0000-4000-8000-000000000103'
      }
    )

    expect(withSecondNote.state.noteGroups).toHaveLength(1)
    expect(withSecondNote.state.notes?.map((note) => note.groupId)).toEqual([
      '00000000-0000-4000-8000-000000000101',
      '00000000-0000-4000-8000-000000000101'
    ])
  })

  it('supports the complete custom note group and note lifecycle', () => {
    const groupId = '00000000-0000-4000-8000-000000000111'
    const noteId = '00000000-0000-4000-8000-000000000112'
    const createdGroup = applyCharacterSheetCommand(
      createCharacter(),
      {
        type: 'CREATE_NOTE_GROUP',
        label: 'Quest Leads',
        expectedVersion: 1
      },
      createSheet(),
      { createId: () => groupId }
    )
    const createdNote = applyCharacterSheetCommand(
      createdGroup,
      {
        type: 'CREATE_NOTE',
        title: 'Find the archivist',
        body: 'Last seen at the western gate.',
        groupId,
        expectedVersion: 1
      },
      createSheet(),
      {
        createId: () => noteId,
        now: () => '2026-07-14T12:00:00.000Z'
      }
    )
    const updatedGroup = applyCharacterSheetCommand(
      createdNote,
      {
        type: 'UPDATE_NOTE_GROUP',
        groupId,
        label: 'Active Quests',
        sortOrder: 2,
        expectedVersion: 1
      },
      createSheet()
    )
    const updatedNote = applyCharacterSheetCommand(
      updatedGroup,
      {
        type: 'UPDATE_NOTE',
        noteId,
        title: 'Find Archivist Vale',
        body: 'Trace Vale through the western gate.',
        pinned: true,
        expectedVersion: 1
      },
      createSheet(),
      { now: () => '2026-07-14T13:00:00.000Z' }
    )

    expect(updatedNote.state.noteGroups).toContainEqual(
      expect.objectContaining({
        id: groupId,
        label: 'Active Quests',
        sortOrder: 2,
        kind: 'CUSTOM'
      })
    )
    expect(updatedNote.state.notes).toContainEqual(
      expect.objectContaining({
        id: noteId,
        groupId,
        title: 'Find Archivist Vale',
        body: 'Trace Vale through the western gate.',
        pinned: true,
        updatedAt: '2026-07-14T13:00:00.000Z'
      })
    )

    const deletedNote = applyCharacterSheetCommand(
      updatedNote,
      {
        type: 'DELETE_NOTE',
        noteId,
        expectedVersion: 1
      },
      createSheet()
    )
    const deletedGroup = applyCharacterSheetCommand(
      deletedNote,
      {
        type: 'DELETE_NOTE_GROUP',
        groupId,
        expectedVersion: 1
      },
      createSheet()
    )

    expect(deletedGroup.state.notes).toEqual([])
    expect(deletedGroup.state.noteGroups).toEqual([])
  })

  it('replaces existing condition notes when adding the same condition again', () => {
    const character = createCharacter()
    character.state.conditions = [
      {
        conditionTypeId: 'condition-1',
        notes: 'Spider venom'
      }
    ]

    const next = applyCharacterSheetCommand(
      character,
      {
        type: 'ADD_CONDITION',
        conditionTypeId: 'condition-1',
        notes: 'Wyvern sting',
        expectedVersion: 1
      },
      createSheet()
    )

    expect(next.state.conditions).toEqual([
      {
        conditionTypeId: 'condition-1',
        notes: 'Wyvern sting'
      }
    ])
  })

  it('validates prepared spells against the selected class spell list', () => {
    const character = createCharacter()
    character.intent.classes = [
      { classId: 'class-1', classLevel: 1 },
      { classId: 'class-2', classLevel: 1 }
    ]
    character.intent.spellSelections = [
      {
        id: 'spell-selection-1',
        source: { kind: 'CLASS', classId: 'class-1' },
        timing: { kind: 'IMMEDIATE' },
        spells: ['spell-1']
      },
      {
        id: 'spell-selection-2',
        source: { kind: 'CLASS', classId: 'class-2' },
        timing: { kind: 'IMMEDIATE' },
        spells: ['spell-2']
      }
    ]
    const sheet = createSheet()
    sheet.spells.spells = [
      ...sheet.spells.spells,
      {
        id: 'spell-2',
        label: 'Cure Wounds',
        level: 1,
        prepared: false,
        known: true
      }
    ]

    expect(() =>
      applyCharacterSheetCommand(
        character,
        {
          type: 'SET_PREPARED_SPELLS',
          classId: 'class-1',
          spellIds: ['spell-2'],
          expectedVersion: 1
        },
        sheet
      )
    ).toThrow(CharacterSheetCommandError)
  })

  it('changes only the active known list and keeps an explicit empty override', () => {
    const character = createCharacter()
    const next = applyCharacterSheetCommand(
      character,
      {
        type: 'SET_KNOWN_SPELLS',
        classId: 'class-1',
        spellIds: [],
        expectedVersion: 1
      },
      createSheet()
    )

    expect(next.intent.spellSelections?.[0]?.spells).toEqual(['spell-1'])
    expect(next.state.classes).toEqual([
      {
        classId: 'class-1',
        spells: { learned: [] }
      }
    ])

    const readded = applyCharacterSheetCommand(
      next,
      {
        type: 'SET_KNOWN_SPELLS',
        classId: 'class-1',
        spellIds: ['spell-1'],
        expectedVersion: 2
      },
      createSheet()
    )
    expect(readded.state.classes?.[0]?.spells?.learned).toEqual(['spell-1'])
  })

  it('keeps a removed known spell available for re-adding', async () => {
    const character = createCharacter()
    character.state.classes = [{ classId: 'class-1', spells: { learned: [] } }]
    const resolution = createResolution()
    resolution.registry.classes = [
      createSpellcastingClass({
        id: 'class-1',
        label: 'Sorcerer',
        attributes: [],
        resetKind: 'LONG_REST',
        spellLimits: createFullCasterSpellLimits()
      })
    ]
    resolution.catalog.spells = [
      createSpell({ classIds: ['class-1'], id: 'spell-1', label: 'Shield', level: 1 })
    ]

    const sheet = await buildCharacterSheetResponse({
      character,
      db: createConditionDb(),
      hasBuilderDraft: false,
      resolution,
      streamVersion: 1
    })
    expect(sheet.spells.spells).toEqual([
      expect.objectContaining({
        id: 'spell-1',
        known: false,
        sources: expect.arrayContaining([expect.objectContaining({ classId: 'class-1' })])
      })
    ])
  })

  it('rejects known spells outside existing class or subclass selections', () => {
    expect(() =>
      applyCharacterSheetCommand(
        createCharacter(),
        {
          type: 'SET_KNOWN_SPELLS',
          classId: 'class-1',
          spellIds: ['unavailable-spell'],
          expectedVersion: 1
        },
        createSheet()
      )
    ).toThrow(/is not available for class/)
  })

  it('keeps inherent grants outside the active known-list command', () => {
    const sheet = createSheet()
    sheet.spells.spells[0]!.sources = [
      createSheetSpellSource('spell-1', {
        classId: undefined,
        source: {
          spellId: 'spell-1',
          sourceKind: 'FEATURE',
          sourceInstanceId: 'feature:spell-1'
        },
        acquisition: 'GRANTED',
        prepared: true,
        canPrepare: false
      })
    ]

    expect(() =>
      applyCharacterSheetCommand(
        createCharacter(),
        {
          type: 'SET_KNOWN_SPELLS',
          classId: 'class-1',
          spellIds: ['spell-1'],
          expectedVersion: 1
        },
        sheet
      )
    ).toThrow(/is not available for class/)
    expect(() =>
      applyCharacterSheetCommand(
        createCharacter(),
        {
          type: 'CAST_SPELL',
          spellId: 'spell-1',
          slotKey: 'STANDARD:1',
          expectedVersion: 1
        },
        sheet
      )
    ).not.toThrow()
  })

  it('allows campaign owners to issue known-spell commands', () => {
    expect(() =>
      assertCampaignGmSheetCommandAllowed({
        type: 'SET_KNOWN_SPELLS',
        classId: 'class-1',
        spellIds: [],
        commandId: '00000000-0000-4000-8000-000000000001',
        expectedVersion: 1
      })
    ).not.toThrow()
  })

  it('rejects prepared spell commands over the class preparation limit', () => {
    const sheet = createSheet()
    sheet.spells.spells = [
      ...sheet.spells.spells,
      {
        id: 'spell-2',
        label: 'Mage Armor',
        level: 1,
        prepared: false,
        known: true,
        sources: [createSheetSpellSource('spell-2')]
      }
    ]
    sheet.spells.preparationSources = [
      {
        classId: 'class-1',
        label: 'Fighter',
        preparedSpellLimit: 1,
        preparedSpellIds: []
      }
    ]

    expect(() =>
      applyCharacterSheetCommand(
        createCharacter(),
        {
          type: 'SET_PREPARED_SPELLS',
          classId: 'class-1',
          spellIds: ['spell-1', 'spell-2'],
          expectedVersion: 1
        },
        sheet
      )
    ).toThrow(/can prepare up to 1 spells/)
  })

  it('enforces spell-source eligibility and preserves state when casting fails', () => {
    const unpreparedCharacter = createCharacter()
    const originalUnpreparedState = structuredClone(unpreparedCharacter.state)
    expect(() =>
      applyCharacterSheetCommand(
        unpreparedCharacter,
        {
          type: 'CAST_SPELL',
          spellId: 'spell-1',
          slotKey: 'STANDARD:1',
          expectedVersion: 1
        },
        createSheet()
      )
    ).toThrow(/is not prepared for this source/)
    expect(unpreparedCharacter.state).toEqual(originalUnpreparedState)

    const knownSheet = createSheet()
    knownSheet.spells.spells[0]!.sources = [
      createSheetSpellSource('spell-1', {
        id: 'bard:spell-1',
        label: 'Bard',
        canPrepare: false,
        prepared: false,
        acquisition: 'KNOWN',
        castMode: 'SPELL_SLOT'
      })
    ]
    const knownNext = applyCharacterSheetCommand(
      createCharacter(),
      {
        type: 'CAST_SPELL',
        spellId: 'spell-1',
        sourceId: 'bard:spell-1',
        slotKey: 'STANDARD:1',
        expectedVersion: 1
      },
      knownSheet
    )
    expect(knownNext.state.spellSlots).toEqual([{ slotKey: 'STANDARD:1', used: 2 }])
  })

  it('allows fixed-level grants without resources and rejects exhausted cast resources', () => {
    const ritualCharacter = createCharacter()
    const ritualSheet = createSheet()
    ritualSheet.spells.spells[0]!.sources = [
      createSheetSpellSource('spell-1', {
        id: 'feature:ritual-spell-1',
        label: 'Magic Item Analysis',
        canPrepare: false,
        prepared: false,
        acquisition: 'KNOWN',
        castMode: 'RITUAL'
      })
    ]
    const ritualNext = applyCharacterSheetCommand(
      ritualCharacter,
      {
        type: 'CAST_SPELL',
        spellId: 'spell-1',
        sourceId: 'feature:ritual-spell-1',
        expectedVersion: 1
      },
      ritualSheet
    )
    expect(ritualNext.state).toEqual(ritualCharacter.state)

    const fixedCharacter = createCharacter()
    const fixedSheet = createSheet()
    fixedSheet.spells.spells[0]!.sources = [
      createSheetSpellSource('spell-1', {
        id: 'feature:spell-1',
        label: 'Arcane Initiate',
        canPrepare: false,
        prepared: true,
        acquisition: 'GRANTED',
        castMode: 'FIXED_LEVEL',
        fixedLevel: 2
      })
    ]
    const fixedNext = applyCharacterSheetCommand(
      fixedCharacter,
      {
        type: 'CAST_SPELL',
        spellId: 'spell-1',
        sourceId: 'feature:spell-1',
        expectedVersion: 1
      },
      fixedSheet
    )
    expect(fixedNext.state).toEqual(fixedCharacter.state)

    const slotCharacter = createCharacter()
    slotCharacter.state.spellSlots = [{ slotKey: 'STANDARD:1', used: 2 }]
    const slotSheet = createSheet()
    slotSheet.spells.slots[0]!.used = 2
    slotSheet.spells.slots[0]!.remaining = 0
    slotSheet.spells.spells[0]!.sources![0]!.prepared = true
    slotSheet.spells.spells[0]!.sources![0]!.acquisition = 'PREPARED'
    const originalSlotState = structuredClone(slotCharacter.state)
    expect(() =>
      applyCharacterSheetCommand(
        slotCharacter,
        {
          type: 'CAST_SPELL',
          spellId: 'spell-1',
          slotKey: 'STANDARD:1',
          expectedVersion: 1
        },
        slotSheet
      )
    ).toThrow(/has no uses remaining/)
    expect(slotCharacter.state).toEqual(originalSlotState)

    const resourceOwner = {
      kind: 'SPELL_SOURCE' as const,
      resourceGrantId: 'resource-1',
      source: {
        spellId: 'spell-1',
        sourceKind: 'FEATURE' as const,
        sourceInstanceId: 'feature:spell-1'
      }
    }
    const resourceSheet = createSheet()
    resourceSheet.resources.items[0] = createSheetResource({
      id: 'SPELL_SOURCE:feature:spell-1:spell-1:resource-1',
      owner: resourceOwner,
      used: 1,
      remaining: 1
    })
    resourceSheet.spells.spells[0]!.sources = [
      createSheetSpellSource('spell-1', {
        id: 'feature:spell-1',
        label: 'Arcane Initiate',
        canPrepare: false,
        prepared: true,
        acquisition: 'GRANTED',
        castMode: 'LIMITED_USE',
        resourceGrantId: 'resource-1',
        resourceOwner
      })
    ]
    const castCharacter = createCharacter()
    castCharacter.state.resources = [
      { resourceGrantId: 'SPELL_SOURCE:feature:spell-1:spell-1:resource-1', used: 1 }
    ]
    const castResource = applyCharacterSheetCommand(
      castCharacter,
      {
        type: 'CAST_SPELL',
        spellId: 'spell-1',
        sourceId: 'feature:spell-1',
        expectedVersion: 1
      },
      resourceSheet
    )
    expect(castResource.state.resources).toEqual([
      { resourceGrantId: 'SPELL_SOURCE:feature:spell-1:spell-1:resource-1', used: 2 }
    ])

    const resourceCharacter = createCharacter()
    resourceCharacter.state.resources = [
      { resourceGrantId: 'SPELL_SOURCE:feature:spell-1:spell-1:resource-1', used: 2 }
    ]
    resourceSheet.resources.items[0]!.used = 2
    resourceSheet.resources.items[0]!.remaining = 0
    const originalResourceState = structuredClone(resourceCharacter.state)
    expect(() =>
      applyCharacterSheetCommand(
        resourceCharacter,
        {
          type: 'CAST_SPELL',
          spellId: 'spell-1',
          sourceId: 'feature:spell-1',
          expectedVersion: 1
        },
        resourceSheet
      )
    ).toThrow(/has no uses remaining/)
    expect(resourceCharacter.state).toEqual(originalResourceState)
  })

  it('preserves learned spells across prepare and unprepare cycles', () => {
    const character = createCharacter()
    character.state.classes = [
      {
        classId: 'class-1',
        spells: {
          learned: ['spell-1', 'spell-2']
        }
      }
    ]
    character.intent.spellSelections = [
      {
        id: 'spell-selection-1',
        source: { kind: 'CLASS', classId: 'class-1' },
        timing: { kind: 'IMMEDIATE' },
        spells: ['spell-1', 'spell-2']
      }
    ]

    const prepared = applyCharacterSheetCommand(
      character,
      {
        type: 'SET_PREPARED_SPELLS',
        classId: 'class-1',
        spellIds: ['spell-1', 'spell-1'],
        expectedVersion: 1
      },
      createSheet()
    )

    expect(prepared.state.classes).toEqual([
      {
        classId: 'class-1',
        spells: {
          learned: ['spell-1', 'spell-2'],
          prepared: ['spell-1']
        }
      }
    ])

    const unprepared = applyCharacterSheetCommand(
      prepared,
      {
        type: 'SET_PREPARED_SPELLS',
        classId: 'class-1',
        spellIds: [],
        expectedVersion: 1
      },
      createSheet()
    )

    expect(unprepared.state.classes).toEqual([
      {
        classId: 'class-1',
        spells: {
          learned: ['spell-1', 'spell-2']
        }
      }
    ])
  })

  it('preserves class state ordering when updating prepared spells', () => {
    const character = createCharacter()
    character.state.classes = [
      {
        classId: 'class-1',
        spells: {
          learned: ['spell-1']
        }
      },
      {
        classId: 'class-2',
        spells: {
          learned: ['spell-3'],
          prepared: ['spell-3']
        }
      }
    ]

    const next = applyCharacterSheetCommand(
      character,
      {
        type: 'SET_PREPARED_SPELLS',
        classId: 'class-1',
        spellIds: ['spell-1'],
        expectedVersion: 1
      },
      createSheet()
    )

    expect(next.state.classes).toEqual([
      {
        classId: 'class-1',
        spells: {
          learned: ['spell-1'],
          prepared: ['spell-1']
        }
      },
      {
        classId: 'class-2',
        spells: {
          learned: ['spell-3'],
          prepared: ['spell-3']
        }
      }
    ])
  })

  it('treats already prepared spells as known for future preparation updates', () => {
    const character = createCharacter()
    character.state.classes = [
      {
        classId: 'class-1',
        spells: {
          prepared: ['spell-1']
        }
      }
    ]
    character.intent.spellSelections = []

    const next = applyCharacterSheetCommand(
      character,
      {
        type: 'SET_PREPARED_SPELLS',
        classId: 'class-1',
        spellIds: ['spell-1'],
        expectedVersion: 1
      },
      createSheet()
    )

    expect(next.state.classes).toEqual([
      {
        classId: 'class-1',
        spells: {
          prepared: ['spell-1']
        }
      }
    ])
  })

  it('derives overview combat stats from engine equipment and ability output', async () => {
    const character = createCharacter()
    character.state.equipment.equipped = ['item-1']
    const resolution = createResolution()
    resolution.summary.abilities = { DEXTERITY: 16 }
    resolution.registry.equipment = [
      createEquipment({
        armorClass: 2,
        category: 'SHIELD',
        id: 'equipment-1',
        label: 'Shield'
      })
    ]

    const sheet = await buildCharacterSheetResponse({
      character,
      db: createConditionDb(),
      hasBuilderDraft: false,
      resolution,
      streamVersion: 1
    })

    expect(sheet.overview.armorClass).toBe(15)
    expect(sheet.overview.initiative).toBe(3)
    expect(sheet.overview.proficiencyBonus).toBe(2)
    expect(sheet.overview.facts).toEqual(
      expect.arrayContaining([
        { label: 'Initiative', value: '+3' },
        { label: 'Proficiency', value: '+2' }
      ])
    )
  })

  it('hydrates class-scoped spell sources for preparation commands', async () => {
    const character = createCharacter()
    character.intent.classes = [{ classId: 'wizard', classLevel: 1 }]
    character.intent.spellSelections = [
      {
        id: 'wizard-spells',
        source: { kind: 'CLASS', classId: 'wizard' },
        timing: { kind: 'IMMEDIATE' },
        spells: ['spell-1', 'spell-2']
      }
    ]
    character.state.classes = [
      {
        classId: 'wizard',
        spells: {
          learned: ['spell-1', 'spell-2'],
          prepared: ['spell-2']
        }
      }
    ]
    const resolution = createResolution()
    resolution.registry.classes = [
      createSpellcastingClass({
        id: 'wizard',
        label: 'Wizard',
        resetKind: 'LONG_REST',
        spellLimits: [
          { classLevel: 1, slots: [{ spellLevel: 1, slotCount: 2 }], preparedSpellsLimit: 1 },
          { classLevel: 17, slots: [{ spellLevel: 9, slotCount: 1 }], preparedSpellsLimit: 9 }
        ]
      })
    ]
    resolution.catalog.spells = [
      createSpell({
        classIds: ['wizard'],
        id: 'spell-1',
        label: 'Shield',
        level: 1
      }),
      createSpell({
        classIds: ['wizard'],
        id: 'spell-2',
        label: 'Mage Armor',
        level: 1
      })
    ]

    const sheet = await buildCharacterSheetResponse({
      character,
      db: createConditionDb(),
      hasBuilderDraft: false,
      resolution,
      streamVersion: 1
    })

    expect(sheet.spells.spells).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'spell-1',
          sources: expect.arrayContaining([
            expect.objectContaining({
              classId: 'wizard',
              label: 'Wizard',
              canPrepare: true,
              prepared: false
            })
          ])
        }),
        expect.objectContaining({
          id: 'spell-2',
          sources: expect.arrayContaining([
            expect.objectContaining({
              classId: 'wizard',
              label: 'Wizard',
              canPrepare: true,
              prepared: true
            })
          ])
        })
      ])
    )
    expect(sheet.spells.preparationSources).toEqual([
      {
        classId: 'wizard',
        label: 'Wizard',
        preparedSpellLimit: 1,
        preparedSpellIds: ['spell-2']
      }
    ])
    expect(sheet.spells.activeGroups).toEqual([
      expect.objectContaining({
        level: 1,
        entries: expect.arrayContaining([
          expect.objectContaining({
            spellId: 'spell-2',
            sourceLabel: 'Wizard',
            available: true
          })
        ])
      })
    ])
    expect(sheet.spells.activeGroups.flatMap((group) => group.entries)).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ spellId: 'spell-1' })])
    )
    expect(sheet.spells.activeGroups[0]?.entries[0]).not.toHaveProperty('sourceQualifier')
  })

  it('projects source-specific granted spell access and exhausted limited uses', async () => {
    const character = createCharacter()
    character.intent.classes = [{ classId: 'wizard', classLevel: 3 }]
    character.intent.spellSelections = []
    character.state.classes = []
    const resolution = createResolution()
    const grantedFeatures = [
      {
        id: 'at-will-feature',
        label: 'Arcane Gift',
        description: '',
        availableAtLevel: 1,
        order: 0,
        grants: {
          spells: [
            {
              id: 'at-will-grant',
              grantKind: GRANT_KIND.SPELL_GRANT,
              selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
              scalingKind: SCALING.NONE,
              authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
              spellIds: ['spell-1'],
              attributes: [SPELL_GRANT_ATTRIBUTE.CAST_AT_WILL],
              order: 0
            }
          ]
        }
      },
      {
        id: 'duplicate-feature',
        label: 'Magic Initiate',
        description: '',
        availableAtLevel: 1,
        order: 1,
        grants: {
          spells: [
            {
              id: 'duplicate-grant',
              grantKind: GRANT_KIND.SPELL_GRANT,
              selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
              scalingKind: SCALING.NONE,
              authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
              spellIds: ['spell-1'],
              attributes: [SPELL_GRANT_ATTRIBUTE.CAST_AT_WILL],
              order: 0
            }
          ]
        }
      },
      {
        id: 'fixed-feature',
        label: 'Fixed Magic',
        description: '',
        availableAtLevel: 1,
        order: 2,
        grants: {
          spells: [
            {
              id: 'fixed-grant',
              grantKind: GRANT_KIND.SPELL_GRANT,
              selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
              scalingKind: SCALING.NONE,
              authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
              spellIds: ['spell-2'],
              attributes: [SPELL_GRANT_ATTRIBUTE.CAST_AT_LEVEL],
              castAtLevel: 2,
              order: 0
            }
          ]
        }
      },
      {
        id: 'limited-feature',
        label: 'Limited Magic',
        description: '',
        availableAtLevel: 1,
        order: 3,
        grants: {
          spells: [
            {
              id: 'limited-grant',
              grantKind: GRANT_KIND.SPELL_GRANT,
              selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
              scalingKind: SCALING.NONE,
              authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
              spellIds: ['spell-3'],
              attributes: [SPELL_GRANT_ATTRIBUTE.LIMITED_USE],
              charges: {
                id: 'limited-charge',
                resetKind: 'LONG_REST',
                limitKind: 'FIXED_AMOUNT',
                scalingKind: 'NONE',
                amount: 1
              },
              order: 0
            }
          ]
        }
      }
    ] satisfies CharacterBuilderResolution['registry']['features']
    resolution.registry.classes = [
      {
        ...createSpellcastingClass({
          id: 'wizard',
          label: 'Wizard',
          resetKind: 'LONG_REST',
          spellLimits: [{ classLevel: 1, slots: [{ spellLevel: 1, slotCount: 2 }] }]
        }),
        features: grantedFeatures
      }
    ]
    resolution.grants.features = grantedFeatures.map((feature) => ({
      id: feature.id,
      label: feature.label,
      sourceLabel: 'Wizard',
      source: { kind: 'CLASS' as const, classId: 'wizard', classLevel: 3 }
    }))
    resolution.catalog.spells = [
      createSpell({ classIds: ['wizard'], id: 'spell-1', label: 'Magic Missile', level: 1 }),
      createSpell({ classIds: ['wizard'], id: 'spell-2', label: 'Misty Step', level: 2 }),
      createSpell({ classIds: ['wizard'], id: 'spell-3', label: 'Shield', level: 1 })
    ]
    const limitedSourceInstanceId = 'CLASS:wizard:wizard:limited-feature:limited-grant'
    const sheet = await buildCharacterSheetResponse({
      character,
      db: createConditionDb(),
      hasBuilderDraft: false,
      resolution,
      resourceUsage: [
        {
          id: 'limited-spell-usage',
          characterId: character.id,
          owner: {
            kind: 'SPELL_SOURCE',
            resourceGrantId: `${limitedSourceInstanceId}:spell-3`,
            spellId: 'spell-3',
            sourceKind: 'FEATURE',
            sourceInstanceId: limitedSourceInstanceId
          },
          used: 1,
          createdBy: 'user-1',
          updatedBy: 'user-1',
          createdAt: '2026-07-25T00:00:00.000Z',
          updatedAt: '2026-07-25T00:00:00.000Z'
        }
      ],
      streamVersion: 1
    })

    const entries = sheet.spells.activeGroups.flatMap((group) => group.entries)
    expect(entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          spellId: 'spell-1',
          available: true,
          sourceQualifier: 'Arcane Gift'
        }),
        expect.objectContaining({
          spellId: 'spell-1',
          available: true,
          sourceQualifier: 'Magic Initiate'
        }),
        expect.objectContaining({ spellId: 'spell-2', castLevel: 2, available: true }),
        expect.objectContaining({
          spellId: 'spell-3',
          available: false,
          unavailableReason: 'No uses remaining.'
        })
      ])
    )
    expect(sheet.resources.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          owner: expect.objectContaining({
            kind: 'SPELL_SOURCE',
            resourceGrantId: `${limitedSourceInstanceId}:spell-3`
          }),
          remaining: 0
        })
      ])
    )
  })

  it('projects active-spell activation, range, and source-adjusted attack or save facts', async () => {
    const character = createCharacter()
    character.intent.classes = [{ classId: 'wizard', classLevel: 3 }]
    character.intent.spellSelections = [
      {
        id: 'wizard-spell-selection',
        source: { kind: 'CLASS', classId: 'wizard' },
        timing: { kind: 'IMMEDIATE' },
        spells: ['spell-attack', 'spell-save', 'spell-utility']
      }
    ]
    character.state.classes = [
      {
        classId: 'wizard',
        spells: { learned: ['spell-attack', 'spell-save', 'spell-utility'] }
      }
    ]
    const resolution = createResolution()
    resolution.summary.abilities = { INTELLIGENCE: 16 }
    resolution.registry.classes = [
      createSpellcastingClass({
        ability: 'INTELLIGENCE',
        attributes: [SPELLCASTING_ATTRIBUTE.LIMIT_KNOWN_SPELL_AMOUNT],
        id: 'wizard',
        label: 'Wizard',
        resetKind: 'LONG_REST',
        spellLimits: [{ classLevel: 3, slots: [{ spellLevel: 1, slotCount: 3 }] }]
      })
    ]
    resolution.catalog.spells = [
      createSpell({
        classIds: ['wizard'],
        id: 'spell-attack',
        label: 'Arcane Bolt',
        level: 1
      }),
      createSpell({
        classIds: ['wizard'],
        id: 'spell-save',
        label: 'Arcane Burst',
        level: 1
      }),
      createSpell({
        classIds: ['wizard'],
        id: 'spell-utility',
        label: 'Arcane Ward',
        level: 1
      })
    ]

    const sheet = await buildCharacterSheetResponse({
      character,
      db: createConditionDb([], {
        spells: [
          {
            ownerId: 'spell-attack',
            label: 'Arcane Bolt',
            description: '',
            level: 1,
            magicSchoolId: 'school-1',
            magicSchoolCode: 'EVOCATION',
            magicSchoolLabel: 'Evocation',
            castingTimeUnit: 'ACTION',
            castingTimeAmount: 1,
            materialDescription: null,
            effectId: 'effect-attack',
            ownerEffectOrder: 0,
            effectOrder: 0
          },
          {
            ownerId: 'spell-save',
            label: 'Arcane Burst',
            description: '',
            level: 1,
            magicSchoolId: 'school-1',
            magicSchoolCode: 'EVOCATION',
            magicSchoolLabel: 'Evocation',
            castingTimeUnit: 'ACTION',
            castingTimeAmount: 1,
            materialDescription: null,
            effectId: 'effect-save',
            ownerEffectOrder: 0,
            effectOrder: 0
          },
          {
            ownerId: 'spell-utility',
            label: 'Arcane Ward',
            description: '',
            level: 1,
            magicSchoolId: 'school-1',
            magicSchoolCode: 'ABJURATION',
            magicSchoolLabel: 'Abjuration',
            castingTimeUnit: 'REACTION',
            castingTimeAmount: 1,
            materialDescription: null,
            effectId: 'effect-utility',
            ownerEffectOrder: 0,
            effectOrder: 0
          }
        ],
        effect_invocations: [
          {
            effectId: 'effect-attack',
            triggerCode: 'SPELL_ATTACK',
            activationType: 'ACTION',
            activationValue: 1,
            rangeCharacteristicId: 'range-attack',
            shapeCharacteristicId: null,
            savingThrowId: null,
            targetSelectionKind: null,
            targetDispositionKind: null,
            maxTargets: null,
            maxTargetsScaling: null,
            resolutionCount: null,
            resolutionCountScaling: null,
            allowRepeatedTargets: null,
            excludedCreatureTypeIds: null
          },
          {
            effectId: 'effect-save',
            triggerCode: 'SAVING_THROW',
            activationType: 'BONUS_ACTION',
            activationValue: 1,
            rangeCharacteristicId: 'range-save',
            shapeCharacteristicId: null,
            savingThrowId: 'save-dexterity',
            targetSelectionKind: null,
            targetDispositionKind: null,
            maxTargets: null,
            maxTargetsScaling: null,
            resolutionCount: null,
            resolutionCountScaling: null,
            allowRepeatedTargets: null,
            excludedCreatureTypeIds: null
          },
          {
            effectId: 'effect-utility',
            triggerCode: 'ACTIVATED',
            activationType: 'REACTION',
            activationValue: 1,
            rangeCharacteristicId: 'range-utility',
            shapeCharacteristicId: null,
            savingThrowId: null,
            targetSelectionKind: null,
            targetDispositionKind: null,
            maxTargets: null,
            maxTargetsScaling: null,
            resolutionCount: null,
            resolutionCountScaling: null,
            allowRepeatedTargets: null,
            excludedCreatureTypeIds: null
          }
        ],
        characteristics: [
          {
            characteristicId: 'range-attack',
            code: 'RANGE',
            rangeKind: 'DISTANCE',
            rangeMin: 120,
            rangeMax: null,
            rangeUnitCode: 'FEET',
            rangeScaling: null,
            shapeKind: null,
            durationKind: null,
            durationAmount: null,
            durationScaling: null
          },
          {
            characteristicId: 'range-save',
            code: 'RANGE',
            rangeKind: 'DISTANCE',
            rangeMin: 150,
            rangeMax: null,
            rangeUnitCode: 'FEET',
            rangeScaling: null,
            shapeKind: null,
            durationKind: null,
            durationAmount: null,
            durationScaling: null
          },
          {
            characteristicId: 'range-utility',
            code: 'RANGE',
            rangeKind: 'DISTANCE',
            rangeMin: 60,
            rangeMax: null,
            rangeUnitCode: 'FEET',
            rangeScaling: null,
            shapeKind: null,
            durationKind: null,
            durationAmount: null,
            durationScaling: null
          }
        ],
        saving_throws: [
          {
            savingThrowId: 'save-dexterity',
            dcMethod: 'SOURCE_SAVE_DC',
            abilityCode: 'DEXTERITY',
            baseDc: null
          }
        ]
      }),
      hasBuilderDraft: false,
      resolution,
      adjustments: [
        {
          id: 'attack-bonus-1',
          characterId: character.id,
          family: 'SPELL',
          source: {
            spellId: 'spell-attack',
            sourceKind: 'CLASS',
            sourceInstanceId: 'CLASS:wizard-spell-selection'
          },
          field: 'ATTACK_BONUS',
          value: 2,
          createdBy: 'user-1',
          updatedBy: 'user-1',
          createdAt: '2026-07-25T00:00:00.000Z',
          updatedAt: '2026-07-25T00:00:00.000Z'
        },
        {
          id: 'save-dc-bonus-1',
          characterId: character.id,
          family: 'SPELL',
          source: {
            spellId: 'spell-save',
            sourceKind: 'CLASS',
            sourceInstanceId: 'CLASS:wizard-spell-selection'
          },
          field: 'DC_BONUS',
          value: 2,
          createdBy: 'user-1',
          updatedBy: 'user-1',
          createdAt: '2026-07-25T00:00:00.000Z',
          updatedAt: '2026-07-25T00:00:00.000Z'
        }
      ],
      streamVersion: 1
    })

    const entries = sheet.spells.activeGroups.flatMap((group) => group.entries)
    expect(entries.find((entry) => entry.spellId === 'spell-attack')).toEqual(
      expect.objectContaining({
        activationType: 'ACTION',
        activationLabel: 'Action',
        rangeLabel: '120 ft',
        hitOrDcLabel: '+7'
      })
    )
    expect(entries.find((entry) => entry.spellId === 'spell-save')).toEqual(
      expect.objectContaining({
        activationType: 'BONUS_ACTION',
        activationLabel: 'Bonus Action',
        rangeLabel: '150 ft',
        hitOrDcLabel: 'DEX 15'
      })
    )
    const utilityEntry = entries.find((entry) => entry.spellId === 'spell-utility')
    expect(utilityEntry).toEqual(
      expect.objectContaining({
        activationType: 'REACTION',
        activationLabel: 'Reaction',
        rangeLabel: '60 ft'
      })
    )
    expect(utilityEntry).not.toHaveProperty('hitOrDcLabel')
    expect(utilityEntry).not.toHaveProperty('primaryEffect')
  })

  it('projects only explicit upcast levels with source-specific damage bonuses', async () => {
    const character = createCharacter()
    character.intent.classes = [{ classId: 'wizard', classLevel: 3 }]
    character.intent.spellSelections = [
      {
        id: 'wizard-spell-selection',
        source: { kind: 'CLASS', classId: 'wizard' },
        timing: { kind: 'IMMEDIATE' },
        spells: ['spell-1']
      }
    ]
    character.state.classes = [
      {
        classId: 'wizard',
        spells: { learned: ['spell-1'] }
      }
    ]
    const resolution = createResolution()
    resolution.registry.classes = [
      createSpellcastingClass({
        attributes: [SPELLCASTING_ATTRIBUTE.LIMIT_KNOWN_SPELL_AMOUNT],
        id: 'wizard',
        label: 'Wizard',
        resetKind: 'LONG_REST',
        spellLimits: [
          {
            classLevel: 3,
            slots: [
              { spellLevel: 1, slotCount: 2 },
              { spellLevel: 2, slotCount: 1 },
              { spellLevel: 3, slotCount: 1 }
            ]
          }
        ]
      })
    ]
    resolution.catalog.spells = [
      createSpell({ classIds: ['wizard'], id: 'spell-1', label: 'Arcane Burst', level: 1 })
    ]

    const sheet = await buildCharacterSheetResponse({
      character,
      db: createConditionDb([], {
        spells: [
          {
            ownerId: 'spell-1',
            label: 'Arcane Burst',
            description: '',
            level: 1,
            magicSchoolId: 'school-1',
            magicSchoolCode: 'EVOCATION',
            magicSchoolLabel: 'Evocation',
            castingTimeUnit: 'ACTION',
            castingTimeAmount: 1,
            materialDescription: null,
            effectId: 'effect-1',
            ownerEffectOrder: 0,
            effectOrder: 0
          }
        ],
        effect_invocations: [
          {
            effectId: 'effect-1',
            triggerCode: 'SPELL_ATTACK',
            activationType: 'ACTION',
            activationValue: 1,
            rangeCharacteristicId: null,
            shapeCharacteristicId: null,
            savingThrowId: null,
            targetSelectionKind: null,
            targetDispositionKind: null,
            maxTargets: null,
            maxTargetsScaling: null,
            resolutionCount: null,
            resolutionCountScaling: null,
            allowRepeatedTargets: null,
            excludedCreatureTypeIds: null
          }
        ],
        effect_paths: [
          {
            pathId: 'path-1',
            effectId: 'effect-1',
            order: 0,
            pathCode: 'DEFAULT',
            groupType: 'SEQUENCE',
            selectionKind: 'FIXED',
            originKind: null,
            rangeOverrideCharacteristicId: null,
            targetSelectionKind: null,
            targetDispositionKind: null,
            maxTargets: null,
            maxTargetsScaling: null,
            resolutionCount: null,
            resolutionCountScaling: null,
            allowRepeatedTargets: null,
            excludedCreatureTypeIds: null,
            resultBlockId: 'result-1',
            rollTableKind: null,
            die: null
          }
        ],
        effect_result_blocks: [
          {
            resultBlockId: 'result-1',
            resultKind: 'DAMAGE',
            durationCharacteristicId: null,
            lifecycleRecurringKind: null,
            lifecycleConsumeOnFirstEvent: null,
            lifecycleEndOnEvents: null
          }
        ],
        effect_result_block_outcomes: [
          {
            resultBlockId: 'result-1',
            outcomeId: 'damage-1',
            effectKind: 'DAMAGE',
            order: 0
          }
        ],
        damages: [
          {
            damageId: 'damage-1',
            damageTypeId: 'force',
            damageTypeCode: 'FORCE',
            damageTypeLabel: 'Force',
            valueKind: 'DICE',
            scalingKind: 'PER_LEVEL',
            amountKind: null,
            amountMultiplier: null,
            scalingSource: 'SPELL_CAST_LEVEL',
            classId: null,
            order: 0,
            valueId: null,
            amount: null,
            dice: null,
            valueMultiplier: null,
            valueMin: null,
            valueMax: null
          }
        ],
        damage_scaling_levels: [
          {
            scalingId: 'damage-1-1',
            damageId: 'damage-1',
            level: 1,
            order: 0,
            amount: null,
            dice: '1d8'
          },
          {
            scalingId: 'damage-1-3',
            damageId: 'damage-1',
            level: 3,
            order: 1,
            amount: null,
            dice: '3d8'
          }
        ]
      }),
      hasBuilderDraft: false,
      resolution,
      adjustments: [
        {
          id: 'damage-bonus-1',
          characterId: character.id,
          family: 'SPELL',
          source: {
            spellId: 'spell-1',
            sourceKind: 'CLASS',
            sourceInstanceId: 'CLASS:wizard-spell-selection'
          },
          field: 'DAMAGE_BONUS',
          value: 2,
          createdBy: 'user-1',
          updatedBy: 'user-1',
          createdAt: '2026-07-25T00:00:00.000Z',
          updatedAt: '2026-07-25T00:00:00.000Z'
        }
      ],
      streamVersion: 1
    })

    const entries = sheet.spells.activeGroups.flatMap((group) => group.entries)
    expect(entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ castLevel: 1, primaryEffect: '1d8 + 2 Force' }),
        expect.objectContaining({ castLevel: 3, primaryEffect: '3d8 + 2 Force' })
      ])
    )
    expect(entries).not.toEqual(expect.arrayContaining([expect.objectContaining({ castLevel: 2 })]))
  })

  it('exposes only current-level class-list spells for prepared casters', async () => {
    const character = createCharacter()
    character.intent.classes = [{ classId: 'cleric', classLevel: 1 }]
    character.intent.spellSelections = []
    character.state.classes = []
    const resolution = createResolution()
    resolution.registry.classes = [
      createSpellcastingClass({
        id: 'cleric',
        label: 'Cleric',
        resetKind: 'LONG_REST',
        spellLimits: [
          { classLevel: 1, slots: [{ spellLevel: 1, slotCount: 2 }], preparedSpellsLimit: 1 },
          { classLevel: 3, slots: [{ spellLevel: 2, slotCount: 2 }], preparedSpellsLimit: 3 }
        ]
      })
    ]
    resolution.catalog.spells = [
      createSpell({ classIds: ['cleric'], id: 'cleric-cantrip', label: 'Guidance', level: 0 }),
      createSpell({
        classIds: ['cleric'],
        id: 'cleric-first-level',
        label: 'Healing Word',
        level: 1
      }),
      createSpell({
        classIds: ['cleric'],
        id: 'cleric-second-level',
        label: 'Spiritual Weapon',
        level: 2
      }),
      createSpell({ classIds: ['wizard'], id: 'wizard-first-level', label: 'Shield', level: 1 })
    ]

    const sheet = await buildCharacterSheetResponse({
      character,
      db: createConditionDb(),
      hasBuilderDraft: false,
      resolution,
      streamVersion: 1
    })

    expect(sheet.spells.spells).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'cleric-first-level',
          mechanics: undefined,
          sources: expect.arrayContaining([
            expect.objectContaining({
              canPrepare: true,
              classId: 'cleric',
              prepared: false
            })
          ])
        })
      ])
    )
    expect(sheet.spells.preparationSources).toEqual([
      {
        classId: 'cleric',
        label: 'Cleric',
        preparedSpellLimit: 1,
        preparedSpellIds: []
      }
    ])
  })

  it('derives prepared spell limits from prepare-limit method rules', async () => {
    const character = createCharacter()
    character.intent.classes = [{ classId: 'wizard', classLevel: 3 }]
    character.intent.spellSelections = [
      {
        id: 'wizard-spells',
        source: { kind: 'CLASS', classId: 'wizard' },
        timing: { kind: 'IMMEDIATE' },
        spells: ['spell-1']
      }
    ]
    const wizard = createSpellcastingClass({
      ability: 'INTELLIGENCE',
      id: 'wizard',
      label: 'Wizard',
      resetKind: 'LONG_REST',
      spellLimits: [{ classLevel: 1, slots: [{ spellLevel: 1, slotCount: 2 }] }]
    })
    if (!wizard.spellcasting) throw new Error('Test wizard should include spellcasting.')
    wizard.spellcasting.prepareLimit = {
      methodKinds: ['CLASS_LEVEL', 'SPELLCASTING_ABILITY']
    }
    const resolution = createResolution()
    resolution.summary.abilities = { INTELLIGENCE: 16 }
    resolution.registry.classes = [wizard]
    resolution.catalog.spells = [
      createSpell({
        classIds: ['wizard'],
        id: 'spell-1',
        label: 'Shield',
        level: 1
      })
    ]

    const sheet = await buildCharacterSheetResponse({
      character,
      db: createConditionDb(),
      hasBuilderDraft: false,
      resolution,
      streamVersion: 1
    })

    expect(sheet.spells.preparationSources).toEqual([
      {
        classId: 'wizard',
        label: 'Wizard',
        preparedSpellLimit: 6,
        preparedSpellIds: []
      }
    ])
  })

  it('floors formula-based prepared spell limits at one for prepared casters', async () => {
    const character = createCharacter()
    character.intent.classes = [{ classId: 'wizard', classLevel: 1 }]
    character.intent.spellSelections = [
      {
        id: 'wizard-spells',
        source: { kind: 'CLASS', classId: 'wizard' },
        timing: { kind: 'IMMEDIATE' },
        spells: ['spell-1']
      }
    ]
    const wizard = createSpellcastingClass({
      ability: 'INTELLIGENCE',
      id: 'wizard',
      label: 'Wizard',
      resetKind: 'LONG_REST',
      spellLimits: [{ classLevel: 1, slots: [{ spellLevel: 1, slotCount: 2 }] }]
    })
    if (!wizard.spellcasting) throw new Error('Test wizard should include spellcasting.')
    wizard.spellcasting.prepareLimit = {
      methodKinds: ['CLASS_LEVEL', 'SPELLCASTING_ABILITY']
    }
    const resolution = createResolution()
    resolution.summary.abilities = { INTELLIGENCE: 8 }
    resolution.registry.classes = [wizard]
    resolution.catalog.spells = [
      createSpell({
        classIds: ['wizard'],
        id: 'spell-1',
        label: 'Shield',
        level: 1
      })
    ]

    const sheet = await buildCharacterSheetResponse({
      character,
      db: createConditionDb(),
      hasBuilderDraft: false,
      resolution,
      streamVersion: 1
    })

    expect(sheet.spells.preparationSources).toEqual([
      {
        classId: 'wizard',
        label: 'Wizard',
        preparedSpellLimit: 1,
        preparedSpellIds: []
      }
    ])
  })

  it('does not hydrate spell source actions from orphaned class state', async () => {
    const character = createCharacter()
    character.intent.classes = [{ classId: 'wizard', classLevel: 1 }]
    character.intent.spellSelections = [
      {
        id: 'wizard-spells',
        source: { kind: 'CLASS', classId: 'wizard' },
        timing: { kind: 'IMMEDIATE' },
        spells: ['spell-1']
      }
    ]
    character.state.classes = [
      {
        classId: 'wizard',
        spells: {
          learned: ['spell-1']
        }
      },
      {
        classId: 'removed-class',
        spells: {
          learned: ['orphan-spell'],
          prepared: ['orphan-spell']
        }
      }
    ]
    const resolution = createResolution()
    resolution.registry.classes = [
      createSpellcastingClass({
        id: 'wizard',
        label: 'Wizard',
        resetKind: 'LONG_REST',
        spellLimits: createFullCasterSpellLimits()
      }),
      createSpellcastingClass({
        id: 'removed-class',
        label: 'Removed Class',
        resetKind: 'LONG_REST',
        spellLimits: createFullCasterSpellLimits()
      })
    ]
    resolution.catalog.spells = [
      createSpell({
        classIds: ['wizard'],
        id: 'spell-1',
        label: 'Shield',
        level: 1
      }),
      createSpell({
        classIds: ['removed-class'],
        id: 'orphan-spell',
        label: 'Orphan Spell',
        level: 1
      })
    ]

    const sheet = await buildCharacterSheetResponse({
      character,
      db: createConditionDb(),
      hasBuilderDraft: false,
      resolution,
      streamVersion: 1
    })

    expect(sheet.spells.spells).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'spell-1',
          sources: expect.arrayContaining([
            expect.objectContaining({
              classId: 'wizard',
              label: 'Wizard',
              canPrepare: true,
              prepared: false
            })
          ])
        }),
        expect.objectContaining({
          id: 'orphan-spell',
          sources: undefined
        })
      ])
    )
    expect(sheet.spells.preparationSources).toEqual([
      {
        classId: 'wizard',
        label: 'Wizard',
        preparedSpellIds: []
      }
    ])
  })

  it('filters stale learned spells before exposing class preparation actions', async () => {
    const character = createCharacter()
    character.intent.classes = [{ classId: 'wizard', classLevel: 1 }]
    character.intent.spellSelections = []
    character.state.classes = [
      {
        classId: 'wizard',
        spells: {
          learned: ['spell-1', 'stale-spell']
        }
      }
    ]
    const resolution = createResolution()
    resolution.registry.classes = [
      createSpellcastingClass({
        id: 'wizard',
        label: 'Wizard',
        resetKind: 'LONG_REST',
        spellLimits: createFullCasterSpellLimits()
      })
    ]
    resolution.catalog.spells = [
      createSpell({
        classIds: ['wizard'],
        id: 'spell-1',
        label: 'Shield',
        level: 1
      }),
      createSpell({
        classIds: ['cleric'],
        id: 'stale-spell',
        label: 'Retired Spell',
        level: 1
      })
    ]

    const sheet = await buildCharacterSheetResponse({
      character,
      db: createConditionDb(),
      hasBuilderDraft: false,
      resolution,
      streamVersion: 1
    })

    expect(sheet.spells.spells).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'spell-1',
          sources: [
            expect.objectContaining({
              classId: 'wizard',
              label: 'Wizard',
              canPrepare: true,
              prepared: false
            })
          ]
        }),
        expect.objectContaining({
          id: 'stale-spell',
          sources: undefined
        })
      ])
    )
    expect(() =>
      applyCharacterSheetCommand(
        character,
        {
          type: 'SET_PREPARED_SPELLS',
          classId: 'wizard',
          spellIds: ['stale-spell'],
          expectedVersion: 1
        },
        sheet
      )
    ).toThrow(CharacterSheetCommandError)
  })

  it('does not expose preparation commands for known-spell classes', async () => {
    const character = createCharacter()
    character.intent.classes = [{ classId: 'bard', classLevel: 1 }]
    character.intent.spellSelections = [
      {
        id: 'bard-spells',
        source: { kind: 'CLASS', classId: 'bard' },
        timing: { kind: 'IMMEDIATE' },
        spells: ['spell-1']
      }
    ]
    character.state.classes = [
      {
        classId: 'bard',
        spells: {
          learned: ['spell-1']
        }
      }
    ]
    const resolution = createResolution()
    resolution.registry.classes = [
      createSpellcastingClass({
        attributes: [SPELLCASTING_ATTRIBUTE.LIMIT_KNOWN_SPELL_AMOUNT],
        id: 'bard',
        label: 'Bard',
        resetKind: 'LONG_REST',
        spellLimits: createFullCasterSpellLimits()
      })
    ]
    resolution.catalog.spells = [
      createSpell({
        classIds: ['bard'],
        id: 'spell-1',
        label: 'Charm Person',
        level: 1
      })
    ]

    const sheet = await buildCharacterSheetResponse({
      character,
      db: createConditionDb(),
      hasBuilderDraft: false,
      resolution,
      streamVersion: 1
    })

    expect(sheet.spells.spells).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'spell-1',
          sources: expect.arrayContaining([
            expect.objectContaining({
              classId: 'bard',
              label: 'Bard',
              canPrepare: false,
              prepared: false
            })
          ])
        })
      ])
    )
    expect(sheet.spells.preparationSources).toBeUndefined()
    expect(sheet.spells.activeGroups).toEqual([
      expect.objectContaining({
        level: 1,
        entries: expect.arrayContaining([
          expect.objectContaining({ spellId: 'spell-1', available: true })
        ])
      })
    ])
    expect(() =>
      applyCharacterSheetCommand(
        character,
        {
          type: 'SET_PREPARED_SPELLS',
          classId: 'bard',
          spellIds: ['spell-1'],
          expectedVersion: 1
        },
        sheet
      )
    ).toThrow(CharacterSheetCommandError)
  })

  it('allows known-spell classes to clear stale prepared spell state', async () => {
    const character = createCharacter()
    character.intent.classes = [{ classId: 'bard', classLevel: 1 }]
    character.state.classes = [
      {
        classId: 'bard',
        spells: {
          learned: ['spell-1'],
          prepared: ['spell-1']
        }
      }
    ]
    const resolution = createResolution()
    resolution.registry.classes = [
      createSpellcastingClass({
        attributes: [SPELLCASTING_ATTRIBUTE.LIMIT_KNOWN_SPELL_AMOUNT],
        id: 'bard',
        label: 'Bard',
        resetKind: 'LONG_REST',
        spellLimits: createFullCasterSpellLimits()
      })
    ]
    resolution.catalog.spells = [
      createSpell({
        classIds: ['bard'],
        id: 'spell-1',
        label: 'Charm Person',
        level: 1
      })
    ]

    const sheet = await buildCharacterSheetResponse({
      character,
      db: createConditionDb(),
      hasBuilderDraft: false,
      resolution,
      streamVersion: 1
    })

    expect(sheet.spells.preparationSources).toBeUndefined()
    const next = applyCharacterSheetCommand(
      character,
      {
        type: 'SET_PREPARED_SPELLS',
        classId: 'bard',
        spellIds: [],
        expectedVersion: 1
      },
      sheet
    )

    expect(next.state.classes).toEqual([
      {
        classId: 'bard',
        spells: {
          learned: ['spell-1']
        }
      }
    ])
  })

  it('matches subclass spells against canonical subclass class records', async () => {
    const character = createCharacter()
    character.intent.classes = [
      { classId: 'wizard', subclassId: 'subclass-choice-1', classLevel: 3 }
    ]
    character.intent.spellSelections = [
      {
        id: 'subclass-spells',
        source: { kind: 'SUBCLASS', subclassId: 'subclass-choice-1', classLevel: 3 },
        timing: { kind: 'IMMEDIATE' },
        spells: ['spell-1']
      }
    ]
    character.state.classes = [
      {
        classId: 'wizard',
        spells: {
          learned: ['spell-1']
        }
      }
    ]
    const resolution = createResolution()
    resolution.registry.classes = [
      createSpellcastingClass({
        id: 'wizard',
        label: 'Wizard',
        resetKind: 'LONG_REST',
        spellLimits: createFullCasterSpellLimits()
      }),
      createSpellcastingSubclass({
        id: 'subclass-canonical',
        label: 'Order of Scribes',
        parentClassId: 'wizard',
        resetKind: 'LONG_REST',
        spellLimits: createFullCasterSpellLimits()
      })
    ]
    resolution.grants.spellcasting = [
      {
        id: 'subclass-canonical:spellcasting',
        label: 'Order of Scribes Spellcasting',
        sourceLabel: 'Order of Scribes',
        source: { kind: 'SUBCLASS', subclassId: 'subclass-choice-1', classLevel: 3 }
      }
    ]
    resolution.catalog.spells = [
      createSpell({
        classIds: ['subclass-canonical'],
        id: 'spell-1',
        label: 'Manifest Mind',
        level: 1
      })
    ]

    const sheet = await buildCharacterSheetResponse({
      character,
      db: createConditionDb(),
      hasBuilderDraft: false,
      resolution,
      streamVersion: 1
    })

    expect(sheet.spells.spells).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'spell-1',
          sources: expect.arrayContaining([
            expect.objectContaining({
              classId: 'wizard',
              label: 'Wizard',
              canPrepare: true,
              prepared: false
            })
          ])
        })
      ])
    )
    expect(() =>
      applyCharacterSheetCommand(
        character,
        {
          type: 'SET_PREPARED_SPELLS',
          classId: 'wizard',
          spellIds: ['spell-1'],
          expectedVersion: 1
        },
        sheet
      )
    ).not.toThrow()
  })

  it('filters active-class prepared spells that are no longer known by that class', async () => {
    const character = createCharacter()
    character.intent.classes = [{ classId: 'wizard', classLevel: 1 }]
    character.intent.spellSelections = [
      {
        id: 'wizard-spells',
        source: { kind: 'CLASS', classId: 'wizard' },
        timing: { kind: 'IMMEDIATE' },
        spells: ['spell-1']
      }
    ]
    character.state.classes = [
      {
        classId: 'wizard',
        spells: {
          learned: ['spell-1'],
          prepared: ['spell-1', 'stale-spell']
        }
      }
    ]
    const resolution = createResolution()
    resolution.registry.classes = [
      createSpellcastingClass({
        id: 'wizard',
        label: 'Wizard',
        resetKind: 'LONG_REST',
        spellLimits: createFullCasterSpellLimits()
      })
    ]
    resolution.catalog.spells = [
      createSpell({
        classIds: ['wizard'],
        id: 'spell-1',
        label: 'Shield',
        level: 1
      }),
      createSpell({
        classIds: ['cleric'],
        id: 'stale-spell',
        label: 'Retired Spell',
        level: 1
      })
    ]

    const sheet = await buildCharacterSheetResponse({
      character,
      db: createConditionDb(),
      hasBuilderDraft: false,
      resolution,
      streamVersion: 1
    })

    expect(sheet.spells.preparationSources).toEqual([
      {
        classId: 'wizard',
        label: 'Wizard',
        preparedSpellIds: ['spell-1']
      }
    ])
    expect(sheet.spells.spells).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'stale-spell',
          sources: undefined
        })
      ])
    )
  })

  it('preserves sheet controls for active class prepared spells stored only in state', async () => {
    const character = createCharacter()
    character.intent.classes = [{ classId: 'wizard', classLevel: 1 }]
    character.intent.spellSelections = []
    character.state.classes = [
      {
        classId: 'wizard',
        spells: {
          prepared: ['spell-1']
        }
      }
    ]
    const resolution = createResolution()
    resolution.registry.classes = [
      createSpellcastingClass({
        id: 'wizard',
        label: 'Wizard',
        resetKind: 'LONG_REST',
        spellLimits: createFullCasterSpellLimits()
      })
    ]
    resolution.catalog.spells = [
      createSpell({
        classIds: ['wizard'],
        id: 'spell-1',
        label: 'Shield',
        level: 1
      })
    ]

    const sheet = await buildCharacterSheetResponse({
      character,
      db: createConditionDb(),
      hasBuilderDraft: false,
      resolution,
      streamVersion: 1
    })

    expect(sheet.spells.spells).toEqual([
      expect.objectContaining({
        id: 'spell-1',
        sources: [
          expect.objectContaining({
            classId: 'wizard',
            label: 'Wizard',
            canPrepare: true,
            prepared: true
          })
        ]
      })
    ])
    expect(sheet.spells.preparationSources).toEqual([
      {
        classId: 'wizard',
        label: 'Wizard',
        preparedSpellIds: ['spell-1']
      }
    ])
  })

  it('derives resource maximums and recovery from class resource charges', async () => {
    const character = createCharacter()
    character.intent.classes = [{ classId: 'class-1', subclassId: 'subclass-1', classLevel: 3 }]

    const sheet = await buildCharacterSheetResponse({
      character,
      db: createConditionDb(),
      hasBuilderDraft: false,
      resolution: createResolution(),
      streamVersion: 1
    })

    expect(sheet.resources.items).toEqual([
      expect.objectContaining({
        owner: expect.objectContaining({
          kind: 'AUTHORED_GRANT',
          resourceGrantId: 'resource-1'
        }),
        description: 'Spend a die to fuel combat maneuvers.',
        max: 4,
        recoveries: [{ trigger: 'SHORT_REST', amount: { kind: 'ALL' } }],
        remaining: 3,
        used: 1
      })
    ])
  })

  it('uses the current source class level for per-level resource charges', async () => {
    const character = createCharacter()
    character.intent.classes = [{ classId: 'class-1', subclassId: 'subclass-1', classLevel: 3 }]
    const resolution = createResolution()
    const resource = resolution.registry.classes[0]?.resources
    if (!resource) throw new Error('resource fixture missing')
    resource.charges = {
      id: 'charge-1',
      resetKind: 'LONG_REST',
      limitKind: 'FIXED_AMOUNT',
      scalingKind: 'PER_LEVEL',
      levels: [
        { id: 'charge-level-1', level: 1, amount: 2 },
        { id: 'charge-level-3', level: 3, amount: 3 }
      ]
    }

    const sheet = await buildCharacterSheetResponse({
      character,
      db: createConditionDb(),
      hasBuilderDraft: false,
      resolution,
      streamVersion: 1
    })

    expect(sheet.resources.items[0]?.max).toBe(3)
  })

  it('uses engine-resolved resource recovery when charge reset modifiers apply', async () => {
    const character = createCharacter()
    character.intent.classes = [{ classId: 'class-1', subclassId: 'subclass-1', classLevel: 5 }]
    character.intent.featureAcquisitions = [
      {
        id: 'font-of-inspiration',
        featureId: 'font-of-inspiration',
        source: { kind: 'SUBCLASS', subclassId: 'subclass-1', classLevel: 5 },
        timing: { kind: 'CLASS_LEVEL', classId: 'class-1', classLevel: 5 }
      }
    ]

    const resolution = createResolution()
    resolution.registry.classes = resolution.registry.classes.map((classRecord) => ({
      ...classRecord,
      resources: classRecord.resources
        ? {
            ...classRecord.resources,
            charges: {
              ...classRecord.resources.charges,
              resetKind: 'LONG_REST'
            }
          }
        : classRecord.resources
    }))
    resolution.registry.features = [
      {
        id: 'font-of-inspiration',
        label: 'Font of Inspiration',
        description: '',
        order: 1,
        grants: {
          modifiers: [
            {
              id: 'font-of-inspiration-reset',
              grantKind: GRANT_KIND.MODIFIER_GRANT,
              order: 1,
              valueDomainCode: VALUE_DOMAIN_CODE.CHARGE_RESET,
              domain: {},
              modifierKind: MODIFIER_KIND.REPLACE_CHARGE_RESET_KIND,
              scope: MODIFIER_SCOPE_KIND.SOURCE,
              selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
              payload: { resetKind: 'SHORT_REST' },
              restrictions: {
                id: 'font-of-inspiration-reset-restriction',
                groups: [
                  {
                    id: 'font-of-inspiration-reset-restriction-group',
                    order: 1,
                    contexts: [
                      {
                        id: 'font-of-inspiration-reset-resource',
                        order: 1,
                        subject: 'RESOURCE',
                        authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
                        resourceIds: ['resource-1']
                      }
                    ]
                  }
                ]
              }
            }
          ]
        }
      }
    ]

    const sheet = await buildCharacterSheetResponse({
      character,
      db: createConditionDb(),
      hasBuilderDraft: false,
      resolution,
      streamVersion: 1
    })

    expect(sheet.resources.items).toEqual([
      expect.objectContaining({
        owner: expect.objectContaining({
          kind: 'AUTHORED_GRANT',
          resourceGrantId: 'resource-1'
        }),
        recoveries: [{ trigger: 'SHORT_REST', amount: { kind: 'ALL' } }]
      })
    ])
  })

  it('uses resource grant ids for sheet usage when grant and definition ids differ', async () => {
    const character = createCharacter()
    character.intent.classes = [{ classId: 'class-1', subclassId: 'subclass-1', classLevel: 3 }]
    character.intent.resourceGrants = [
      {
        id: 'resource:subclass-1:resource-1',
        resourceId: 'resource-1',
        source: { kind: 'SUBCLASS', subclassId: 'subclass-1', classLevel: 1 },
        timing: { kind: 'CLASS_LEVEL', classId: 'class-1', classLevel: 1 }
      }
    ]
    character.state.resources = [{ resourceGrantId: 'resource:subclass-1:resource-1', used: 2 }]

    const sheet = await buildCharacterSheetResponse({
      character,
      db: createConditionDb(),
      hasBuilderDraft: false,
      resolution: createResolution(),
      streamVersion: 1
    })

    expect(sheet.resources.items).toEqual([
      expect.objectContaining({
        owner: expect.objectContaining({
          kind: 'AUTHORED_GRANT',
          resourceGrantId: 'resource:subclass-1:resource-1'
        }),
        max: 4,
        remaining: 2,
        used: 2
      })
    ])
  })

  it('resolves subclass resource definitions without requiring the subclass source id to be a class row id', async () => {
    const character = createCharacter()
    character.intent.classes = [
      { classId: 'class-1', subclassId: 'subclass-choice-1', classLevel: 3 }
    ]
    const resolution = createResolution()
    resolution.grants.resources = resolution.grants.resources.map((resource) => ({
      ...resource,
      source: { kind: 'SUBCLASS', subclassId: 'subclass-choice-1', classLevel: 3 }
    }))

    const sheet = await buildCharacterSheetResponse({
      character,
      db: createConditionDb(),
      hasBuilderDraft: false,
      resolution,
      streamVersion: 1
    })

    expect(sheet.resources.items).toEqual([
      expect.objectContaining({
        owner: expect.objectContaining({
          kind: 'AUTHORED_GRANT',
          resourceGrantId: 'resource-1'
        }),
        max: 4,
        recoveries: [{ trigger: 'SHORT_REST', amount: { kind: 'ALL' } }]
      })
    ])
  })

  it('leaves spell DC and attack bonus empty for non-casters', async () => {
    const sheet = await buildCharacterSheetResponse({
      character: createCharacter(),
      db: createConditionDb(),
      hasBuilderDraft: false,
      resolution: createResolution(),
      streamVersion: 1
    })

    expect(sheet.spells.saveDc).toBeNull()
    expect(sheet.spells.attackBonus).toBeNull()
  })

  it('derives spell DC and attack bonus from the engine spellcasting ability', async () => {
    const character = createCharacter()
    character.intent.classes = [{ classId: 'wizard', classLevel: 1 }]
    const resolution = createResolution()
    resolution.summary.abilities = {
      INTELLIGENCE: 16
    }
    resolution.registry.classes = [
      createSpellcastingClass({
        ability: 'INTELLIGENCE',
        id: 'wizard',
        label: 'Wizard',
        resetKind: 'LONG_REST',
        spellLimits: createFullCasterSpellLimits()
      })
    ]

    const sheet = await buildCharacterSheetResponse({
      character,
      db: createConditionDb(),
      hasBuilderDraft: false,
      resolution,
      streamVersion: 1
    })

    expect(sheet.spells.saveDc).toBe(13)
    expect(sheet.spells.attackBonus).toBe(5)
  })

  it('derives sheet spell slots from fused multiclass spellcasting rules', async () => {
    const character = createCharacter()
    character.intent.classes = [
      { classId: 'wizard', classLevel: 1 },
      { classId: 'cleric', classLevel: 1 }
    ]
    const resolution = createResolution()
    resolution.summary.totalLevel = 2
    resolution.registry.classes = [
      createSpellcastingClass({
        id: 'wizard',
        label: 'Wizard',
        resetKind: 'LONG_REST',
        spellLimits: createFullCasterSpellLimits()
      }),
      createSpellcastingClass({
        id: 'cleric',
        label: 'Cleric',
        resetKind: 'LONG_REST',
        spellLimits: createFullCasterSpellLimits()
      })
    ]

    const sheet = await buildCharacterSheetResponse({
      character,
      db: createConditionDb(),
      hasBuilderDraft: false,
      resolution,
      streamVersion: 1
    })

    expect(sheet.spells.slots).toEqual([
      expect.objectContaining({
        slotKey: 'STANDARD:1',
        max: 3,
        used: 1,
        remaining: 2
      })
    ])
  })

  it('derives pact magic as a separate short-rest spell slot pool', async () => {
    const character = createCharacter()
    character.intent.classes = [{ classId: 'warlock', classLevel: 1 }]
    character.state.spellSlots = [{ slotKey: 'PACT', used: 1 }]
    const resolution = createResolution()
    resolution.registry.classes = [
      createSpellcastingClass({
        id: 'warlock',
        label: 'Warlock',
        resetKind: 'SHORT_REST',
        spellLimits: [{ classLevel: 1, slots: [{ spellLevel: 1, slotCount: 1 }] }],
        maxSpellLevel: 5
      })
    ]

    const sheet = await buildCharacterSheetResponse({
      character,
      db: createConditionDb(),
      hasBuilderDraft: false,
      resolution,
      streamVersion: 1
    })

    expect(sheet.spells.slots).toEqual([
      expect.objectContaining({
        slotKey: 'PACT',
        label: 'Pact Magic',
        level: 1,
        max: 1,
        used: 1,
        remaining: 0
      })
    ])
  })

  it('adds, updates, and removes creature extras with their equipment assignments', () => {
    const character = createCharacter()
    const sheet = createSheet({
      extras: {
        kindOptions: [],
        originOptions: [],
        creatureOptions: [
          {
            id: 'creature-1',
            label: 'Owl',
            armorClass: 11,
            maximumHitPoints: 3
          }
        ],
        vehicleOptions: [],
        items: []
      }
    })

    const added = applyCharacterSheetCommand(
      character,
      {
        type: 'ADD_SHEET_EXTRA',
        expectedVersion: 1,
        extra: { kind: 'COMPANION', creatureId: 'creature-1', originKind: 'WORLD' }
      },
      sheet,
      {
        createId: () => 'companion-1',
        extraDefaults: {
          creatures: new Map([['creature-1', { hitPoints: 3 }]]),
          vehicles: new Map()
        }
      }
    )
    const updatedSheet = createSheet({
      extras: {
        ...sheet.extras,
        items: [
          {
            kind: 'COMPANION',
            kindLabel: 'Companion',
            id: 'companion-1',
            creatureId: 'creature-1',
            relationshipKind: 'COMPANION',
            relationshipLabel: 'Companion',
            originKind: 'WORLD',
            originLabel: 'World',
            authoredName: 'Owl',
            displayName: 'Owl',
            isActive: true,
            armorClass: 11,
            hitPoints: { current: 3, maximum: 3, temp: 0 },
            hitDice: [],
            actions: [],
            features: [],
            equipmentItemIds: []
          }
        ]
      }
    })
    const updated = applyCharacterSheetCommand(
      added,
      {
        type: 'UPDATE_SHEET_EXTRA',
        expectedVersion: 1,
        extra: {
          kind: 'COMPANION',
          extraId: 'companion-1',
          customName: 'Scout',
          tempHitPoints: 0,
          equipmentItemIds: ['item-1']
        }
      },
      updatedSheet
    )
    const removed = applyCharacterSheetCommand(
      updated,
      {
        type: 'REMOVE_SHEET_EXTRA',
        expectedVersion: 1,
        extra: { kind: 'COMPANION', extraId: 'companion-1' }
      },
      updatedSheet
    )

    expect(updated.state.creatures).toEqual([
      expect.objectContaining({ id: 'companion-1', customName: 'Scout' })
    ])
    expect(updated.state.creatureEquipment).toEqual({
      'companion-1': [{ equipmentItemId: 'item-1' }]
    })
    expect(removed.state.creatures).toEqual([])
    expect(removed.state.creatureEquipment).toEqual({})
  })
})
