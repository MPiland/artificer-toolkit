import { describe, expect, it } from 'vitest'
import {
  CharacterSheetCommandError,
  applyCharacterSheetCommand,
  summarizeCharacterSheetCommand
} from './sheetCommandReducer.js'
import {
  createCharacter,
  createSheet,
  createSheetResource,
  createSheetSpellSource
} from './sheetTestFixtures.js'

describe('character sheet command reducer', () => {
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

    expect(resourceNext.state.resources).toEqual([{ resourceGrantId: 'resource-1', used: 2 }])
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

    expect(() => applyCharacterSheetCommand(character, command, sheet)).toThrow('more than 3 items')
    expect(
      applyCharacterSheetCommand(character, command, sheet, { attunementSlotLimit: 4 }).state
        .equipment.attuned
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
      { resourceGrantId: 'SPELL_SOURCE:feature:spell-1:spell-1:resource-1', used: 1 }
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
