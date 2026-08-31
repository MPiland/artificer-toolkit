import { describe, expect, it, vi } from 'vitest'
import type { DBLike } from '#types'
import type { CharacterAuthored } from '@artificer-toolkit/shared'
import { replaceCharacterInventoryItems } from '../domains/subjects/upserts/character.helpers.js'
import { upsertCharacter } from '../domains/subjects/upserts/character.js'
import { createCharacterRepository } from '../domains/subjects/repositories/character.js'
import { createInventoryRepository } from '../repositories/inventory.js'
import { InMemoryDb } from './helpers/in-memory-db.js'

vi.mock('kysely', () => ({
  sql: (sql: TemplateStringsArray, ...values: unknown[]) => ({
    execute: async (db: InMemoryDb) => {
      const statement = sql
        .map((piece, index) => `${piece}${index < values.length ? String(values[index]) : ''}`)
        .join('')
      const lowered = statement.toLowerCase()
      const queryTable = lowered.includes('character_spell_slot_state')
        ? 'character_spell_slot_state'
        : lowered.includes('character_conditions')
          ? 'character_conditions'
          : lowered.includes('character_exhaustion')
            ? 'character_exhaustion'
            : null

      if (lowered.includes('from inventory_items')) {
        const ownerId = values[0]
        const rows = await db
          .selectFrom('inventory_items')
          .selectAll()
          .where('owner_id', '=', ownerId)
          .execute()
        return { rows }
      }
      if (lowered.includes('from inventory_currency_balances')) {
        return { rows: [] }
      }
      if (lowered.includes('insert into public.characters')) {
        await db
          .insertInto('characters')
          .values({
            id: values[0],
            system_id: values[1],
            primary_rules_catalogue_id: values[2],
            user_id: values[3],
            label: values[4],
            description: values[5],
            status: values[6],
            inspiration: values[7],
            rule_pack_revision_id: values[8],
            stream_version: values[9]
          })
          .onConflict((builder) => builder.column('id').doUpdateSet({}))
          .execute()
        return { rows: [] }
      }
      if (!queryTable) {
        throw new Error(`Unhandled SQL in test mock: ${statement}`)
      }

      const characterId = values[0]
      if (typeof characterId !== 'string') {
        throw new TypeError('Expected the character query to bind a string character ID.')
      }

      const rows = await db
        .selectFrom(queryTable)
        .selectAll()
        .where('character_id', '=', characterId)
        .execute()

      return { rows }
    }
  })
}))

import { buildCharacter } from './character-upsert.test-helpers.js'

describe('upsertCharacter guards', () => {
  it('rejects duplicate chosen grant selection identities before persistence', async () => {
    const db = new InMemoryDb()
    const character = buildCharacter()
    const existingSelection = character.intent.chosenGrantSelections?.[0]
    if (!existingSelection || existingSelection.source.kind !== 'CLASS') {
      throw new Error('class-owned chosen grant selection missing from test setup')
    }

    character.intent.chosenGrantSelections = [
      existingSelection,
      {
        ...existingSelection,
        id: 'chosen-grant-selection-duplicate',
        source: {
          ...existingSelection.source,
          classLevel: (existingSelection.source.classLevel ?? 1) + 1
        },
        timing: {
          kind: 'CLASS_LEVEL',
          classId: existingSelection.source.classId,
          classLevel: 5
        }
      }
    ]

    await expect(upsertCharacter(db as unknown as DBLike, character)).rejects.toThrow(
      /duplicate chosen grant selection identity/i
    )
    expect(db.snapshot('characters')).toEqual([])
  })

  it('rejects currency groups without stable identities', async () => {
    const db = new InMemoryDb()
    const character = buildCharacter()
    const currencyGroup = character.state.currency[0]
    if (!currencyGroup) throw new Error('currency group missing from test setup')

    await expect(
      upsertCharacter(
        db as unknown as DBLike,
        {
          ...character,
          state: {
            ...character.state,
            currency: [
              {
                ...currencyGroup,
                id: undefined
              }
            ]
          }
        } as unknown as CharacterAuthored
      )
    ).rejects.toThrow('Character character-1 has a currency group without an id.')
  })

  it('rejects duplicate inventory identities before persistence', async () => {
    const db = new InMemoryDb()
    const character = buildCharacter()
    const item = character.state.equipment.inventory[0]
    if (!item) throw new Error('inventory item missing from test setup')

    character.state.equipment.inventory = [...character.state.equipment.inventory, { ...item }]

    await expect(upsertCharacter(db as never, character)).rejects.toThrow(
      'Character equipment for character-1 contains duplicate id "inventory-1".'
    )
    expect(db.snapshot('characters')).toEqual([])
  })

  it('rejects duplicate feature acquisition identities before persistence', async () => {
    const db = new InMemoryDb()
    const character = buildCharacter()
    const acquisition = character.intent.featureAcquisitions[0]
    if (!acquisition) throw new Error('feature acquisition missing from test setup')

    character.intent.featureAcquisitions = [
      ...character.intent.featureAcquisitions,
      { ...acquisition }
    ]

    await expect(upsertCharacter(db as never, character)).rejects.toThrow(
      'Character feature acquisitions for character-1 contains duplicate id "feature-acq-1".'
    )
    expect(db.snapshot('characters')).toEqual([])
  })

  it('rejects notes that reference a missing note group', async () => {
    const db = new InMemoryDb()
    const character = buildCharacter()
    const note = character.state.notes?.[0]
    if (!note) throw new Error('note missing from test setup')

    await expect(
      upsertCharacter(db as unknown as DBLike, {
        ...character,
        state: {
          ...character.state,
          notes: [{ ...note, groupId: 'missing-note-group' }]
        }
      })
    ).rejects.toThrow(
      'Character character-1 note note-1 references missing note group missing-note-group.'
    )
  })

  it('increments stream version when requested for finalized authored writes', async () => {
    const db = new InMemoryDb()
    const initial = buildCharacter()

    await upsertCharacter(db as never, initial)
    await upsertCharacter(
      db as never,
      {
        ...initial,
        label: 'Aria Finalized'
      },
      {
        incrementStreamVersion: true
      }
    )

    expect(db.snapshot('characters')).toEqual([
      expect.objectContaining({
        id: 'character-1',
        label: 'Aria Finalized',
        inspiration: true,
        stream_version: 1
      })
    ])
  })

  it('patches Sheet-owned state without replacing Builder-owned authored data', async () => {
    const db = new InMemoryDb()
    const character = buildCharacter()
    await upsertCharacter(db as never, character)
    const profileBefore = db.snapshot('character_profile')
    const classesBefore = db.snapshot('character_classes')
    const repository = createCharacterRepository(db as unknown as DBLike)
    let callbackVersion: number | undefined

    const streamVersion = await repository.patchSheetState(
      character.id,
      [
        { kind: 'INSPIRATION', value: false },
        {
          kind: 'EQUIPMENT',
          value: {
            inventory: [
              { id: 'inventory-1', equipmentId: 'equipment-a', quantity: 4 },
              {
                id: 'inventory-2',
                equipmentId: 'equipment-b',
                quantity: 1,
                containerId: 'inventory-1'
              }
            ],
            equipped: ['inventory-2'],
            attuned: []
          },
          creatureEquipment: {},
          vehicleEquipment: {}
        },
        {
          kind: 'CURRENCY',
          value: [
            {
              id: 'currency-group-1',
              containerId: 'inventory-1',
              currencies: [{ currencyId: 'currency-1', amount: 75 }]
            }
          ]
        },
        {
          kind: 'HITPOINTS',
          value: {
            current: 4,
            temp: 2,
            hitDice: [{ die: 8, total: 2, used: 1 }]
          }
        },
        {
          kind: 'CONDITIONS',
          value: [{ conditionTypeId: 'condition-2', notes: 'From a Sheet command' }]
        }
      ],
      {
        expectedStreamVersion: 0,
        afterPersist: async (_trx, nextStreamVersion) => {
          callbackVersion = nextStreamVersion
        }
      }
    )

    expect(streamVersion).toBe(1)
    expect(callbackVersion).toBe(1)
    expect(db.snapshot('character_profile')).toEqual(profileBefore)
    expect(db.snapshot('character_classes')).toEqual(classesBefore)
    expect(db.snapshot('characters')).toEqual([
      expect.objectContaining({ id: character.id, inspiration: false, stream_version: 1 })
    ])
    await expect(repository.findAuthoredById(character.id)).resolves.toEqual(
      expect.objectContaining({
        profile: character.profile,
        intent: character.intent,
        state: expect.objectContaining({
          inspiration: false,
          hitpoints: {
            current: 4,
            temp: 2,
            hitDice: [{ die: 8, total: 2, used: 1 }]
          },
          conditions: [{ conditionTypeId: 'condition-2', notes: 'From a Sheet command' }],
          equipment: {
            inventory: [
              { id: 'inventory-1', equipmentId: 'equipment-a', quantity: 4 },
              {
                id: 'inventory-2',
                equipmentId: 'equipment-b',
                quantity: 1,
                containerId: 'inventory-1'
              }
            ],
            equipped: ['inventory-2'],
            attuned: []
          },
          currency: [
            {
              id: 'currency-group-1',
              containerId: 'inventory-1',
              currencies: [{ currencyId: 'currency-1', amount: 75 }]
            }
          ]
        })
      })
    )
    await expect(
      createInventoryRepository(db as unknown as DBLike).getInventory({
        kind: 'CHARACTER',
        characterId: character.id
      })
    ).resolves.toMatchObject({
      items: expect.arrayContaining([expect.objectContaining({ id: 'inventory-1', quantity: 4 })])
    })
  })

  it('rejects inventory item ids owned by another aggregate', async () => {
    const db = new InMemoryDb()
    const character = buildCharacter()
    await upsertCharacter(db as never, character)
    await db
      .insertInto('inventory_owners')
      .values({ id: 'party-owner', kind: 'CAMPAIGN', campaign_id: 'campaign-1' })
      .execute()
    await db
      .insertInto('inventory_items')
      .values({
        id: 'party-item',
        owner_id: 'party-owner',
        equipment_id: 'equipment-party',
        quantity: 2
      })
      .execute()

    await expect(
      replaceCharacterInventoryItems(
        db as unknown as DBLike,
        character.id,
        [{ id: 'party-item', equipmentId: 'equipment-party', quantity: 1 }],
        [],
        []
      )
    ).rejects.toThrow('owned by another inventory aggregate')

    expect(db.snapshot('inventory_items')).toContainEqual(
      expect.objectContaining({ id: 'party-item', owner_id: 'party-owner', quantity: 2 })
    )
  })

  it('preserves explicit empty known-spell overrides and clears only the override marker', async () => {
    const db = new InMemoryDb()
    const character = buildCharacter()
    character.state.classes = [
      { classId: 'class-1', spells: { learned: [], prepared: ['spell-11'] } }
    ]
    await upsertCharacter(db as never, character)
    const repository = createCharacterRepository(db as unknown as DBLike)

    expect(db.snapshot('character_classes')).toEqual([
      expect.objectContaining({ class_id: 'class-1', known_spells_overridden: true })
    ])
    await expect(repository.findAuthoredById(character.id)).resolves.toMatchObject({
      state: { classes: [{ classId: 'class-1', spells: { learned: [], prepared: ['spell-11'] } }] }
    })

    await repository.patchSheetState(
      character.id,
      [
        {
          kind: 'CLASS_SPELLS',
          value: [{ classId: 'class-1', spells: { prepared: ['spell-11'] } }]
        }
      ],
      { expectedStreamVersion: 0 }
    )

    expect(db.snapshot('character_classes')).toEqual([
      expect.objectContaining({ class_id: 'class-1', known_spells_overridden: false })
    ])
    await expect(repository.findAuthoredById(character.id)).resolves.toMatchObject({
      state: { classes: [{ classId: 'class-1', spells: { prepared: ['spell-11'] } }] }
    })
  })

  it('rejects stale Sheet state patches before mutating state or appending history', async () => {
    const db = new InMemoryDb()
    const character = buildCharacter()
    await upsertCharacter(db as never, character)
    const repository = createCharacterRepository(db as unknown as DBLike)
    const hitpointsBefore = db.snapshot('character_hitpoint_state')
    const afterPersist = vi.fn()

    await expect(
      repository.patchSheetState(
        character.id,
        [
          {
            kind: 'HITPOINTS',
            value: { current: 1, hitDice: [] }
          }
        ],
        {
          expectedStreamVersion: 1,
          afterPersist
        }
      )
    ).rejects.toMatchObject({ name: 'ConcurrencyError' })

    expect(db.snapshot('character_hitpoint_state')).toEqual(hitpointsBefore)
    expect(afterPersist).not.toHaveBeenCalled()
  })

  it('validates newly admitted sources after the Character lock and before state writes', async () => {
    const db = new InMemoryDb()
    const character = buildCharacter()
    await upsertCharacter(db as never, character)
    const repository = createCharacterRepository(db as unknown as DBLike)
    const calls: string[] = []

    await repository.patchSheetState(character.id, [], {
      expectedStreamVersion: 0,
      beforeCharacterLock: async () => {
        calls.push('campaign-access')
      },
      afterCharacterLock: async () => {
        calls.push('current-source')
      },
      afterPersist: async () => {
        calls.push('projection')
      }
    })

    expect(calls).toEqual(['campaign-access', 'current-source', 'projection'])
  })

  it('throws for unsupported ancestry source discriminator from persisted character rows', async () => {
    const db = new InMemoryDb()
    const character = buildCharacter()

    await upsertCharacter(db as never, character)

    const ancestryRows = db.snapshot('character_ancestry_acquisitions')
    const existingAncestry = ancestryRows.find((row) => row.character_id === character.id)
    if (!existingAncestry) {
      throw new Error('character ancestry acquisition row missing in test setup')
    }

    await db
      .deleteFrom('character_ancestry_acquisitions')
      .where('id', '=', existingAncestry.id as string)
      .execute()

    await db
      .insertInto('character_ancestry_acquisitions')
      .values({ ...existingAncestry, source_kind: 'CUSTOM_ORIGIN' as string })
      .execute()

    const repository = createCharacterRepository(db as never)

    await expect(repository.findAuthoredById(character.id)).rejects.toThrow(
      'Unsupported ancestry source kind: CUSTOM_ORIGIN'
    )
  })

  it('throws for unsupported ancestry timing discriminator from persisted character rows', async () => {
    const db = new InMemoryDb()
    const character = buildCharacter()

    await upsertCharacter(db as never, character)

    const ancestryRows = db.snapshot('character_ancestry_acquisitions')
    const existingAncestry = ancestryRows.find((row) => row.character_id === character.id)
    if (!existingAncestry) {
      throw new Error('character ancestry acquisition row missing in test setup')
    }

    await db
      .deleteFrom('character_ancestry_acquisitions')
      .where('id', '=', existingAncestry.id as string)
      .execute()

    await db
      .insertInto('character_ancestry_acquisitions')
      .values({ ...existingAncestry, timing_kind: 'MILESTONE' as string })
      .execute()

    const repository = createCharacterRepository(db as never)

    await expect(repository.findAuthoredById(character.id)).rejects.toThrow(
      'Unsupported ancestry timing kind: MILESTONE'
    )
  })
})
