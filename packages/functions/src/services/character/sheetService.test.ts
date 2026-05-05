import { describe, expect, it } from 'vitest'
import type { DBLike } from '@artificer-toolkit/db'
import type { CharacterSheetResponseDto } from '@artificer-toolkit/schema/api/characters'
import { SPELLCASTING_ATTRIBUTE } from '@artificer-toolkit/shared/core'
import type { CharacterAuthored } from '@artificer-toolkit/shared/subjects/authored'
import type { CharacterBuilderResolution } from './builderService.js'
import {
  CharacterSheetCommandError,
  applyCharacterSheetCommand,
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
        levels: [{ level: 1, value: 12 }]
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

function createSheet(overrides: Partial<CharacterSheetResponseDto> = {}): CharacterSheetResponseDto {
  return {
    meta: {
      characterId: 'character-1',
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
      abilities: [{ ability: 'DEXTERITY', score: 14, modifier: 2 }],
      facts: [],
      armorClass: 12,
      initiative: 2,
      proficiencyBonus: 2,
      currentHitPoints: 10,
      maxHitPoints: 12,
      tempHitPoints: 3,
      maxHitPointsOverride: null,
      exhaustionLevel: 0,
      conditions: [],
      hitDice: [{ die: 8, total: 1, used: 0, remaining: 1 }]
    },
    actions: { items: [] },
    resources: {
      items: [
        {
          id: 'resource-1',
          label: 'Second Wind',
          sourceLabel: 'Fighter',
          used: 1,
          max: 2,
          remaining: 1,
          recovery: 'LONG_REST'
        }
      ],
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
          sources: [{ classId: 'class-1', label: 'Fighter', canPrepare: true, prepared: false }]
        }
      ],
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
      conditionOptions: [{ id: 'condition-1', label: 'Poisoned' }],
      equipmentOptions: [{ id: 'equipment-1', label: 'Sword' }],
      currencyOptions: [{ id: 'currency-1', label: 'Gold' }]
    },
    notes: {},
    ...overrides
  }
}

function createConditionDb(rows: Array<{ id: string, label: string, description?: string | null }> = []): DBLike {
  return {
    selectFrom: () => ({
      select: () => ({
        where: () => ({
          orderBy: () => ({
            execute: async () => rows
          })
        })
      })
    })
  } as unknown as DBLike
}

function createSystem(
  overrides: Partial<NonNullable<CharacterBuilderResolution['registry']['system']>> = {}
): NonNullable<CharacterBuilderResolution['registry']['system']> {
  return {
    id: 'system-1',
    label: 'D&D 5e',
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
    registry: {
      system: null,
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
      spells: [],
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
  ability?: NonNullable<CharacterBuilderResolution['registry']['classes'][number]['spellcasting']>['ability']
  attributes?: NonNullable<CharacterBuilderResolution['registry']['classes'][number]['spellcasting']>['attributes']
  id: string
  label: string
  resetKind: 'LONG_REST' | 'SHORT_REST'
  spellLimits: NonNullable<CharacterBuilderResolution['registry']['classes'][number]['spellcasting']>['spellLimits']
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
  attributes?: NonNullable<CharacterBuilderResolution['registry']['classes'][number]['spellcasting']>['attributes']
  id: string
  label: string
  parentClassId: string
  resetKind: 'LONG_REST' | 'SHORT_REST'
  spellLimits: NonNullable<CharacterBuilderResolution['registry']['classes'][number]['spellcasting']>['spellLimits']
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
}): CharacterBuilderResolution['registry']['spells'][number] {
  return {
    kind: 'SPELL',
    id: params.id,
    label: params.label,
    status: 'ACTIVE',
    description: '',
    castingTime: {
      unit: 'ROUND',
      amount: 1
    },
    level: params.level,
    classIds: params.classIds,
    magicSchoolId: 'ABJURATION',
    systemId: 'system-1',
    userId: 'user-1'
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
    const next = applyCharacterSheetCommand(createCharacter(), {
      type: 'ADJUST_HIT_POINTS',
      mode: 'DAMAGE',
      amount: 5,
      expectedVersion: 1
    }, createSheet())

    expect(next.state.hitpoints.temp).toBe(0)
    expect(next.state.hitpoints.current).toBe(8)
  })

  it('clamps current hit points when max override is lowered', () => {
    const next = applyCharacterSheetCommand(createCharacter(), {
      type: 'SET_HIT_POINTS',
      maxOverride: 6,
      expectedVersion: 1
    }, createSheet())

    expect(next.state.hitpoints.maxOverride).toBe(6)
    expect(next.state.hitpoints.current).toBe(6)
  })

  it('preserves exhaustion notes when only the exhaustion level changes', () => {
    const character = createCharacter()
    character.state.exhaustion = {
      level: 1,
      notes: 'Forced march through the swamp.'
    }

    const next = applyCharacterSheetCommand(character, {
      type: 'SET_EXHAUSTION',
      level: 2,
      expectedVersion: 1
    }, createSheet())

    expect(next.state.exhaustion).toEqual({
      level: 2,
      notes: 'Forced march through the swamp.'
    })
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

    expect(sheet.overview.exhaustionLevel).toBe(1)
    expect(sheet.overview.exhaustionNotes).toBe('Forced march through the swamp.')
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
        label: 'Poisoned',
        description: 'A poisoned creature suffers from toxins affecting its body.'
      }
    ])
  })

  it('hydrates engine proficiencies into reference facts', async () => {
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
      { label: 'Athletics', value: 'Skill · Proficient' },
      { label: 'Dexterity saves', value: 'Saving throw · Expertise' }
    ])
  })

  it('hydrates action descriptions from granted feature summaries', async () => {
    const resolution = createResolution()
    resolution.grants.features = [
      {
        id: 'feature-1',
        label: 'Second Wind',
        description: '<p>Regain hit points as a bonus action.</p>',
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

    expect(sheet.actions.items).toContainEqual(expect.objectContaining({
      id: 'feature-1',
      description: '<p>Regain hit points as a bonus action.</p>'
    }))
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
    resolution.registry.spells = [spell]

    const sheet = await buildCharacterSheetResponse({
      character: createCharacter(),
      db: createConditionDb(),
      hasBuilderDraft: false,
      resolution,
      streamVersion: 1
    })

    expect(sheet.spells.spells).toContainEqual(expect.objectContaining({
      id: 'spell-1',
      description: '<p>A shimmering barrier protects you.</p>',
      castingTime: { unit: 'ROUND', amount: 1 },
      components: ['VERBAL', 'SOMATIC', 'MATERIAL'],
      attributes: ['CONCENTRATION'],
      materialDescription: '<p>A pinch of powdered silver.</p>'
    }))
  })

  it('hydrates inventory item reference details from equipment records', async () => {
    const resolution = createResolution()
    resolution.registry.system = {
      currencies: [{ id: 'gp', label: 'Gold' }]
    } as CharacterBuilderResolution['registry']['system']
    const equipment = createEquipment({
      category: 'WEAPON',
      id: 'equipment-1',
      label: 'Longsword'
    })
    equipment.description = '<p>A balanced knightly blade.</p>'
    equipment.cost = { amount: 15, currencyId: 'gp' }
    equipment.properties = ['MARTIAL', 'MELEE']
    equipment.armorClass = 1
    resolution.registry.equipment = [equipment]

    const sheet = await buildCharacterSheetResponse({
      character: createCharacter(),
      db: createConditionDb(),
      hasBuilderDraft: false,
      resolution,
      streamVersion: 1
    })

    expect(sheet.inventory.items).toContainEqual(expect.objectContaining({
      id: 'item-1',
      equipmentLabel: 'Longsword',
      description: '<p>A balanced knightly blade.</p>',
      category: 'WEAPON',
      cost: { amount: 15, currencyId: 'gp' },
      costLabel: 'Gold',
      weight: { amount: 0, unit: 'POUNDS' },
      properties: ['MARTIAL', 'MELEE'],
      armorClass: 1
    }))
  })

  it('caps resource and spell slot usage at the sheet maximum', () => {
    const resourceNext = applyCharacterSheetCommand(createCharacter(), {
      type: 'USE_RESOURCE',
      resourceGrantId: 'resource-1',
      amount: 10,
      expectedVersion: 1
    }, createSheet())
    const slotNext = applyCharacterSheetCommand(createCharacter(), {
      type: 'USE_SPELL_SLOT',
      slotKey: 'STANDARD:1',
      expectedVersion: 1
    }, createSheet())

    expect(resourceNext.state.resources).toEqual([{ resourceGrantId: 'resource-1', used: 2 }])
    expect(slotNext.state.spellSlots).toEqual([{ slotKey: 'STANDARD:1', used: 2 }])
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
      { ...sheet.resources.items[0], recovery: 'SHORT_REST' },
      {
        id: 'long-resource',
        label: 'Daily Resolve',
        sourceLabel: 'Fighter',
        used: 1,
        max: 1,
        remaining: 0,
        recovery: 'LONG_REST'
      }
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

    const next = applyCharacterSheetCommand(character, {
      type: 'APPLY_REST',
      restKind: 'SHORT',
      expectedVersion: 1
    }, sheet)

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
      {
        id: 'short-resource',
        label: 'Action Surge',
        sourceLabel: 'Fighter',
        used: 1,
        max: 1,
        remaining: 0,
        recovery: 'SHORT_REST'
      },
      {
        id: 'long-resource',
        label: 'Daily Resolve',
        sourceLabel: 'Fighter',
        used: 1,
        max: 1,
        remaining: 0,
        recovery: 'LONG_REST'
      },
      {
        id: 'manual-resource',
        label: 'Manual Charge',
        sourceLabel: 'Item',
        used: 2,
        max: 3,
        remaining: 1,
        recovery: 'OTHER'
      }
    ]

    const next = applyCharacterSheetCommand(character, {
      type: 'APPLY_REST',
      restKind: 'LONG',
      expectedVersion: 1
    }, sheet)

    expect(next.state.resources).toEqual([{ resourceGrantId: 'manual-resource', used: 2 }])
  })

  it('recovers long-rest hit dice from one shared floor-half pool', () => {
    const character = createCharacter()
    character.state.hitpoints.hitDice = [
      { die: 8, total: 3, used: 3 },
      { die: 10, total: 1, used: 1 }
    ]

    const next = applyCharacterSheetCommand(character, {
      type: 'APPLY_REST',
      restKind: 'LONG',
      expectedVersion: 1
    }, createSheet())

    expect(next.state.hitpoints.hitDice).toEqual([
      { die: 8, total: 3, used: 1 },
      { die: 10, total: 1, used: 1 }
    ])
  })

  it('recovers a minimum of one hit die on long rest', () => {
    const character = createCharacter()
    character.state.hitpoints.hitDice = [{ die: 8, total: 1, used: 1 }]

    const next = applyCharacterSheetCommand(character, {
      type: 'APPLY_REST',
      restKind: 'LONG',
      expectedVersion: 1
    }, createSheet())

    expect(next.state.hitpoints.hitDice).toEqual([{ die: 8, total: 1, used: 0 }])
  })

  it('rejects commands for unavailable resources and spell slots', () => {
    expect(() => applyCharacterSheetCommand(createCharacter(), {
      type: 'USE_RESOURCE',
      resourceGrantId: 'missing-resource',
      expectedVersion: 1
    }, createSheet())).toThrow(CharacterSheetCommandError)

    expect(() => applyCharacterSheetCommand(createCharacter(), {
      type: 'USE_SPELL_SLOT',
      slotKey: 'STANDARD:9',
      expectedVersion: 1
    }, createSheet())).toThrow(CharacterSheetCommandError)
  })

  it('rejects impossible inventory and attunement commands', () => {
    expect(() => applyCharacterSheetCommand(createCharacter(), {
      type: 'EQUIP_ITEM',
      itemId: 'missing-item',
      expectedVersion: 1
    }, createSheet())).toThrow(CharacterSheetCommandError)

    const character = createCharacter()
    character.state.equipment.inventory.push({ id: 'item-4', equipmentId: 'equipment-1', quantity: 1 })

    expect(() => applyCharacterSheetCommand(character, {
      type: 'ATTUNE_ITEM',
      itemId: 'item-4',
      expectedVersion: 1
    }, createSheet())).toThrow(CharacterSheetCommandError)
  })

  it('keeps equipped and attuned flags when partially removing an inventory stack', () => {
    const character = createCharacter()
    character.state.equipment.inventory = [{ id: 'item-1', equipmentId: 'equipment-1', quantity: 3 }]
    character.state.equipment.equipped = ['item-1']
    character.state.equipment.attuned = ['item-1']

    const next = applyCharacterSheetCommand(character, {
      type: 'REMOVE_INVENTORY_ITEM',
      itemId: 'item-1',
      quantity: 1,
      expectedVersion: 1
    }, createSheet())

    expect(next.state.equipment.inventory).toEqual([{ id: 'item-1', equipmentId: 'equipment-1', quantity: 2 }])
    expect(next.state.equipment.equipped).toEqual(['item-1'])
    expect(next.state.equipment.attuned).toEqual(['item-1'])
  })

  it('removes inventory rows and flags when updating quantity to zero', () => {
    const character = createCharacter()
    character.state.equipment.inventory = [
      { id: 'item-1', equipmentId: 'equipment-1', quantity: 2 },
      { id: 'item-2', equipmentId: 'equipment-2', quantity: 1 }
    ]
    character.state.equipment.equipped = ['item-1']
    character.state.equipment.attuned = ['item-1']

    const next = applyCharacterSheetCommand(character, {
      type: 'UPDATE_INVENTORY_ITEM',
      itemId: 'item-1',
      quantity: 0,
      expectedVersion: 1
    }, createSheet())

    expect(next.state.equipment.inventory).toEqual([{ id: 'item-2', equipmentId: 'equipment-2', quantity: 1 }])
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
    expect(() => applyCharacterSheetCommand(createCharacter(), {
      type: 'ADD_CONDITION',
      conditionTypeId: 'missing-condition',
      expectedVersion: 1
    }, createSheet())).toThrow(CharacterSheetCommandError)

    expect(() => applyCharacterSheetCommand(createCharacter(), {
      type: 'ADD_INVENTORY_ITEM',
      equipmentId: 'missing-equipment',
      quantity: 1,
      expectedVersion: 1
    }, createSheet())).toThrow(CharacterSheetCommandError)

    expect(() => applyCharacterSheetCommand(createCharacter(), {
      type: 'ADJUST_CURRENCY',
      currencyId: 'missing-currency',
      amount: 1,
      expectedVersion: 1
    }, createSheet())).toThrow(CharacterSheetCommandError)
  })

  it('removes zero currency rows after sheet currency adjustments', () => {
    const character = createCharacter()
    character.state.currency = [
      {
        currencies: [
          { currencyId: 'currency-1', amount: 1 },
          { currencyId: 'currency-2', amount: 4 }
        ]
      }
    ]

    const next = applyCharacterSheetCommand(character, {
      type: 'ADJUST_CURRENCY',
      currencyId: 'currency-1',
      amount: -1,
      expectedVersion: 1
    }, createSheet())

    expect(next.state.currency).toEqual([
      {
        currencies: [{ currencyId: 'currency-2', amount: 4 }]
      }
    ])
  })

  it('does not create zero currency rows when subtracting missing currency', () => {
    const next = applyCharacterSheetCommand(createCharacter(), {
      type: 'ADJUST_CURRENCY',
      currencyId: 'currency-1',
      amount: -1,
      expectedVersion: 1
    }, createSheet())

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
        quantity: 1,
        equipped: false,
        attuned: false
      }
    ]

    expect(summarizeCharacterSheetCommand({
      type: 'ADD_CONDITION',
      conditionTypeId: 'condition-1',
      expectedVersion: 1
    }, sheet)).toBe('Poisoned added')
    expect(summarizeCharacterSheetCommand({
      type: 'USE_RESOURCE',
      resourceGrantId: 'resource-1',
      expectedVersion: 1
    }, sheet)).toBe('Second Wind used')
    expect(summarizeCharacterSheetCommand({
      type: 'USE_SPELL_SLOT',
      slotKey: 'STANDARD:1',
      expectedVersion: 1
    }, sheet)).toBe('Level 1 spell slot used')
    expect(summarizeCharacterSheetCommand({
      type: 'EQUIP_ITEM',
      itemId: 'item-1',
      expectedVersion: 1
    }, sheet)).toBe('Moonlit Blade equipped')
    expect(summarizeCharacterSheetCommand({
      type: 'ADJUST_CURRENCY',
      currencyId: 'currency-1',
      amount: 5,
      expectedVersion: 1
    }, sheet)).toBe('Gold updated')
  })

  it('replaces existing condition notes when adding the same condition again', () => {
    const character = createCharacter()
    character.state.conditions = [
      {
        conditionTypeId: 'condition-1',
        notes: 'Spider venom'
      }
    ]

    const next = applyCharacterSheetCommand(character, {
      type: 'ADD_CONDITION',
      conditionTypeId: 'condition-1',
      notes: 'Wyvern sting',
      expectedVersion: 1
    }, createSheet())

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

    expect(() => applyCharacterSheetCommand(character, {
      type: 'SET_PREPARED_SPELLS',
      classId: 'class-1',
      spellIds: ['spell-2'],
      expectedVersion: 1
    }, sheet)).toThrow(CharacterSheetCommandError)
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

    const prepared = applyCharacterSheetCommand(character, {
      type: 'SET_PREPARED_SPELLS',
      classId: 'class-1',
      spellIds: ['spell-1', 'spell-1'],
      expectedVersion: 1
    }, createSheet())

    expect(prepared.state.classes).toEqual([
      {
        classId: 'class-1',
        spells: {
          learned: ['spell-1', 'spell-2'],
          prepared: ['spell-1']
        }
      }
    ])

    const unprepared = applyCharacterSheetCommand(prepared, {
      type: 'SET_PREPARED_SPELLS',
      classId: 'class-1',
      spellIds: [],
      expectedVersion: 1
    }, createSheet())

    expect(unprepared.state.classes).toEqual([
      {
        classId: 'class-1',
        spells: {
          learned: ['spell-1', 'spell-2']
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

    const next = applyCharacterSheetCommand(character, {
      type: 'SET_PREPARED_SPELLS',
      classId: 'class-1',
      spellIds: ['spell-1'],
      expectedVersion: 1
    }, createSheet())

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
    expect(sheet.overview.facts).toEqual(expect.arrayContaining([
      { label: 'Initiative', value: '+3' },
      { label: 'Proficiency', value: '+2' }
    ]))
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
        spellLimits: createFullCasterSpellLimits()
      })
    ]
    resolution.registry.spells = [
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

    expect(sheet.spells.spells).toEqual([
      expect.objectContaining({
        id: 'spell-1',
        sourceLabel: 'Wizard',
        sources: [{ classId: 'wizard', label: 'Wizard', canPrepare: true, prepared: false }]
      }),
      expect.objectContaining({
        id: 'spell-2',
        sourceLabel: 'Wizard',
        sources: [{ classId: 'wizard', label: 'Wizard', canPrepare: true, prepared: true }]
      })
    ])
    expect(sheet.spells.preparationSources).toEqual([
      {
        classId: 'wizard',
        label: 'Wizard',
        preparedSpellIds: ['spell-2']
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
    resolution.registry.spells = [
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

    expect(sheet.spells.spells).toEqual([
      expect.objectContaining({
        id: 'spell-1',
        sources: [{ classId: 'wizard', label: 'Wizard', canPrepare: true, prepared: false }]
      }),
      expect.objectContaining({
        id: 'orphan-spell',
        sources: undefined
      })
    ])
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
    resolution.registry.spells = [
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

    expect(sheet.spells.spells).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'spell-1',
        sources: [{ classId: 'wizard', label: 'Wizard', canPrepare: true, prepared: false }]
      }),
      expect.objectContaining({
        id: 'stale-spell',
        sources: undefined
      })
    ]))
    expect(() => applyCharacterSheetCommand(character, {
      type: 'SET_PREPARED_SPELLS',
      classId: 'wizard',
      spellIds: ['stale-spell'],
      expectedVersion: 1
    }, sheet)).toThrow(CharacterSheetCommandError)
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
    resolution.registry.spells = [
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

    expect(sheet.spells.spells).toEqual([
      expect.objectContaining({
        id: 'spell-1',
        sources: [{ classId: 'bard', label: 'Bard', canPrepare: false, prepared: false }]
      })
    ])
    expect(sheet.spells.preparationSources).toBeUndefined()
    expect(() => applyCharacterSheetCommand(character, {
      type: 'SET_PREPARED_SPELLS',
      classId: 'bard',
      spellIds: ['spell-1'],
      expectedVersion: 1
    }, sheet)).toThrow(CharacterSheetCommandError)
  })

  it('matches subclass spells against canonical subclass class records', async () => {
    const character = createCharacter()
    character.intent.classes = [{ classId: 'wizard', subclassId: 'subclass-choice-1', classLevel: 3 }]
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
    resolution.registry.spells = [
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

    expect(sheet.spells.spells).toEqual([
      expect.objectContaining({
        id: 'spell-1',
        sources: [{ classId: 'wizard', label: 'Wizard', canPrepare: true, prepared: false }]
      })
    ])
    expect(() => applyCharacterSheetCommand(character, {
      type: 'SET_PREPARED_SPELLS',
      classId: 'wizard',
      spellIds: ['spell-1'],
      expectedVersion: 1
    }, sheet)).not.toThrow()
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
    resolution.registry.spells = [
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
    expect(sheet.spells.spells).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'stale-spell',
        sources: undefined
      })
    ]))
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
    resolution.registry.spells = [
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
        sources: [{ classId: 'wizard', label: 'Wizard', canPrepare: true, prepared: true }]
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
        id: 'resource-1',
        description: 'Spend a die to fuel combat maneuvers.',
        max: 4,
        recovery: 'SHORT_REST',
        remaining: 3,
        used: 1
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
        id: 'resource:subclass-1:resource-1',
        max: 4,
        remaining: 2,
        used: 2
      })
    ])
  })

  it('resolves subclass resource definitions without requiring the subclass source id to be a class row id', async () => {
    const character = createCharacter()
    character.intent.classes = [{ classId: 'class-1', subclassId: 'subclass-choice-1', classLevel: 3 }]
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
        id: 'resource-1',
        max: 4,
        recovery: 'SHORT_REST'
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
})
