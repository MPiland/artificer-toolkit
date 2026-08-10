import type { DBLike } from '@artificer-toolkit/db'
import type { CharacterSheetResponseDto } from '@artificer-toolkit/schema/api/characters'
import { SPELLCASTING_ATTRIBUTE } from '@artificer-toolkit/shared/core'
import type { CharacterAuthored } from '@artificer-toolkit/shared/subjects/authored'
import type { CharacterBuilderResolution } from './builderService.js'
import type { CreatureAuthored } from '@artificer-toolkit/shared/subjects/authored'

export function createCharacter(overrides: Partial<CharacterAuthored> = {}): CharacterAuthored {
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
    },
    ...overrides
  }
}

export type SheetResource = CharacterSheetResponseDto['resources']['items'][number]

export type SheetSpellSource = NonNullable<
  CharacterSheetResponseDto['spells']['spells'][number]['sources']
>[number]

export function createSheetResource(overrides: Partial<SheetResource> = {}): SheetResource {
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

export function createSheetSpellSource(
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

export function createSheet(
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

export function createConditionDb(
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

export function createSystem(
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

export function createResolution(): CharacterBuilderResolution {
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

export function createSpellcastingClass(params: {
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

export function createSpellcastingSubclass(params: {
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

export function createSpell(params: {
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

export function createEquipment(params: {
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

export function createFullCasterSpellLimits() {
  return [
    { classLevel: 1, slots: [{ spellLevel: 1, slotCount: 2 }] },
    { classLevel: 17, slots: [{ spellLevel: 9, slotCount: 1 }] }
  ]
}

export function createExecuteCharacter(
  overrides: Partial<CharacterAuthored> = {}
): CharacterAuthored {
  return {
    id: 'character-1',
    label: 'Aria',
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
        levels: [{ level: 1, classId: 'class-1', classLevel: 1, value: 10 }]
      },
      featureAcquisitions: []
    },
    state: {
      equipment: {
        inventory: [],
        equipped: [],
        attuned: []
      },
      currency: [],
      hitpoints: {
        current: 10,
        hitDice: []
      }
    },
    ...overrides
  }
}

export function createExecuteResolution(): CharacterBuilderResolution {
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
      system: {
        rulesetCode: 'dnd5e',
        rulesetVersion: '2014',
        currencies: [{ id: 'currency-1', label: 'Gold' }],
        speeds: [
          { id: 'speed-walk', code: 'WALK', label: 'Walking Speed' },
          { id: 'speed-fly', code: 'FLY', label: 'Flying Speed' },
          { id: 'speed-climb', code: 'CLIMB', label: 'Climbing Speed' }
        ]
      } as CharacterBuilderResolution['registry']['system'],
      races: [],
      classes: [],
      backgrounds: [],
      equipment: [],
      features: []
    },
    summary: {
      totalLevel: 1,
      abilities: { DEXTERITY: 14 },
      classes: []
    },
    grants: {
      features: [],
      resources: [],
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

export function createCreature(overrides: Partial<CreatureAuthored> = {}): CreatureAuthored {
  return {
    id: 'creature-1',
    label: 'Owl',
    userId: 'user-1',
    systemId: 'system-1',
    category: 'COMPANION',
    creatureTypeId: '00000000-0000-4000-8000-000000000021',
    size: 'SMALL',
    alignmentId: '00000000-0000-4000-8000-000000000022',
    abilityScores: {
      STRENGTH: 3,
      DEXTERITY: 13,
      CONSTITUTION: 10,
      INTELLIGENCE: 2,
      WISDOM: 12,
      CHARISMA: 7
    },
    armorClass: 11,
    hitPoints: 3,
    speeds: [],
    ...overrides
  }
}
