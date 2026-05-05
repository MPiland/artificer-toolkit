import { describe, expect, it } from 'vitest'
import type { DBLike } from '@artificer-toolkit/db'
import type { CharacterSheetResponseDto } from '@artificer-toolkit/schema/api/characters'
import type { CharacterAuthored } from '@artificer-toolkit/shared/subjects/authored'
import type { CharacterBuilderResolution } from './builderService.js'
import {
  CharacterSheetCommandError,
  applyCharacterSheetCommand,
  buildCharacterSheetResponse
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
          resourceId: 'resource-def-1',
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
          known: true
        }
      ]
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

function createConditionDb(): DBLike {
  return {
    selectFrom: () => ({
      select: () => ({
        where: () => ({
          orderBy: () => ({
            execute: async () => []
          })
        })
      })
    })
  } as unknown as DBLike
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

  it('recovers floor half hit dice on long rest with a minimum of one die', () => {
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
      { die: 8, total: 3, used: 2 },
      { die: 10, total: 1, used: 0 }
    ])
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

  it('moves prepared spells out of learned state to avoid duplicate persisted rows', () => {
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

    const next = applyCharacterSheetCommand(character, {
      type: 'SET_PREPARED_SPELLS',
      classId: 'class-1',
      spellIds: ['spell-1', 'spell-1'],
      expectedVersion: 1
    }, createSheet())

    expect(next.state.classes).toEqual([
      {
        classId: 'class-1',
        spells: {
          learned: ['spell-2'],
          prepared: ['spell-1']
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
        max: 4,
        recovery: 'SHORT_REST',
        remaining: 3,
        used: 1
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
