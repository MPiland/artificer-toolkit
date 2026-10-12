import { describe, expect, it } from 'vitest'
import {
  readCharacterInventoryBase,
  readCharacterSheetState
} from '@artificer-toolkit/schema/projections/characterStoredState'
import { api } from '../_generated/api'
import { editCharacterRecord } from '../../tests/fixtures/characterRecords'
import { input } from '../../tests/fixtures/characters'
import { readyCharacterFixture, readySheetFixture } from '../../tests/fixtures/readyCharacter'
import { readCharacterRecord, readCharacterRow } from './stateDocuments'

/** The stored inventory, its usage overlay and the effective inventory a Character row reads as. */
async function readInventory(
  fixture: Awaited<ReturnType<typeof readySheetFixture>>,
  characterId: string
) {
  return fixture.t.run(async (ctx) => {
    const row = await readCharacterRow(ctx, characterId)
    if (!row) throw new Error('Missing Character.')
    const base = readCharacterInventoryBase(row)
    return {
      stored: base.inventory,
      usage: base.itemUsage,
      effective: readCharacterRecord(row).state.equipment.inventory
    }
  })
}

describe('single-use item usage on a stored Character (SPELLS-11)', () => {
  it('shows the lower count, edits against the effective quantity, and prunes a deleted item', async () => {
    const fixture = await readySheetFixture()
    const { t, character } = fixture
    await t.run((ctx) =>
      editCharacterRecord(ctx, character.id, (document) => ({
        ...document,
        state: {
          ...document.state,
          equipment: {
            ...document.state.equipment,
            inventory: document.state.equipment.inventory.map((item, index) =>
              index === 0 ? { ...item, quantity: 3 } : item
            )
          }
        }
      }))
    )
    const [item] = (await readInventory(fixture, character.id)).stored
    if (!item) throw new Error('The Character carries nothing.')
    expect(item.quantity).toBe(3)

    // Play uses one: the Sheet's reader sees two, and the stored structure still holds three.
    await t.run(async (ctx) => {
      const row = await readCharacterRow(ctx, character.id)
      if (!row) throw new Error('Missing Character.')
      await editCharacterRecord(ctx, character.id, (document) => document, {
        sheetState: {
          ...readCharacterSheetState(row),
          itemUsage: [{ itemInstanceId: item.id, used: 1 }]
        }
      })
    })
    expect((await readInventory(fixture, character.id)).effective[0]?.quantity).toBe(2)
    expect((await readInventory(fixture, character.id)).stored[0]?.quantity).toBe(3)

    // A structural edit of the effective quantity is stored as the edit plus what was used.
    await t.run((ctx) =>
      editCharacterRecord(ctx, character.id, (document) => ({
        ...document,
        state: {
          ...document.state,
          equipment: {
            ...document.state.equipment,
            inventory: document.state.equipment.inventory.map((entry) =>
              entry.id === item.id ? { ...entry, quantity: 5 } : entry
            )
          }
        }
      }))
    )
    const edited = await readInventory(fixture, character.id)
    expect(edited.stored.find((entry) => entry.id === item.id)?.quantity).toBe(6)
    expect(edited.usage).toEqual([{ itemInstanceId: item.id, used: 1 }])

    // Deleting the item removes its usage with it.
    await t.run((ctx) =>
      editCharacterRecord(ctx, character.id, (document) => ({
        ...document,
        state: {
          ...document.state,
          equipment: {
            ...document.state.equipment,
            inventory: document.state.equipment.inventory.filter((entry) => entry.id !== item.id)
          }
        }
      }))
    )
    const deleted = await readInventory(fixture, character.id)
    expect(deleted.stored.some((entry) => entry.id === item.id)).toBe(false)
    expect(deleted.usage).toEqual([])
  }, 120000)
})

describe('a Builder commit after single-use items were used (SPELLS-11)', () => {
  it('never gives back an item used after the draft was read', async () => {
    const { t, owner, createCharacter } = await readyCharacterFixture()
    const first = await createCharacter()
    await owner.caller.mutation(api.characters.commit.commit, {
      expectedDraftId: first.draft.id,
      mode: 'create',
      character: first.character
    })
    const characterId = first.character.id
    const setUsed = (used: number) =>
      t.run(async (ctx) => {
        const row = await readCharacterRow(ctx, characterId)
        if (!row) throw new Error('Missing Character.')
        const [item] = readCharacterInventoryBase(row).inventory
        if (!item) throw new Error('The Character carries nothing.')
        // Play uses items the way the room does: the overlay changes and the stream advances.
        await editCharacterRecord(ctx, characterId, (document) => document, {
          sheetState: {
            ...readCharacterSheetState(row),
            itemUsage: [{ itemInstanceId: item.id, used }]
          },
          streamVersion: row.play.streamVersion + 1
        })
      })
    await t.run((ctx) =>
      editCharacterRecord(ctx, characterId, (document) => ({
        ...document,
        state: {
          ...document.state,
          equipment: {
            ...document.state.equipment,
            inventory: document.state.equipment.inventory.map((item, index) =>
              index === 0 ? { ...item, quantity: 4 } : item
            )
          }
        }
      }))
    )
    await setUsed(1)
    const edit = await owner.caller.mutation(api.characters.drafts.create, {
      ...input(),
      id: characterId
    })
    // Two more are used after the draft was read.
    await setUsed(3)
    await owner.caller.mutation(api.characters.commit.commit, {
      expectedDraftId: edit.id,
      mode: 'edit',
      character: { ...edit.payload.character, label: 'Edited after use' }
    })
    const committed = await t.run((ctx) => readCharacterRow(ctx, characterId))
    if (!committed) throw new Error('Missing Character.')
    expect(readCharacterRecord(committed).state.equipment.inventory[0]?.quantity).toBe(1)
  }, 120000)
})

describe('an equipped single-use item that is used up (SPELLS-11)', () => {
  it('is not reported as equipped, yet is equipped again when the use is undone', async () => {
    const fixture = await readySheetFixture()
    const { t, character } = fixture
    const [item] = (await readInventory(fixture, character.id)).stored
    if (!item) throw new Error('The Character carries nothing.')
    const equippedEntry = { itemId: item.id, slot: 'WORN' as const }
    const readEquipped = () =>
      t.run(async (ctx) => {
        const row = await readCharacterRow(ctx, character.id)
        if (!row) throw new Error('Missing Character.')
        return {
          effective: readCharacterRecord(row).state.equipment.equipped,
          stored: readCharacterInventoryBase(row).equipped
        }
      })
    const setUsed = (used: number) =>
      t.run(async (ctx) => {
        const row = await readCharacterRow(ctx, character.id)
        if (!row) throw new Error('Missing Character.')
        await editCharacterRecord(ctx, character.id, (document) => document, {
          sheetState: {
            ...readCharacterSheetState(row),
            itemUsage: used ? [{ itemInstanceId: item.id, used }] : []
          }
        })
      })
    await t.run((ctx) =>
      editCharacterRecord(ctx, character.id, (document) => ({
        ...document,
        state: {
          ...document.state,
          equipment: { ...document.state.equipment, equipped: [equippedEntry] }
        }
      }))
    )
    expect((await readEquipped()).effective).toEqual([equippedEntry])

    await setUsed(item.quantity)
    expect(await readEquipped()).toEqual({ effective: [], stored: [equippedEntry] })

    await setUsed(0)
    expect((await readEquipped()).effective).toEqual([equippedEntry])
  })
})

describe('a Sheet inventory command after single-use items were used (SPELLS-11)', () => {
  it('refuses a stale request and edits the effective quantity of a current one', async () => {
    const fixture = await readySheetFixture()
    const { t, character, owner, readState } = fixture
    const [item] = (await readInventory(fixture, character.id)).stored
    if (!item) throw new Error('The Character carries nothing.')
    const before = (await readState()).character
    if (!before) throw new Error('Missing Character.')
    const staleVersion = before.play.streamVersion
    // Play uses one the way the room does: the overlay changes and the stream advances.
    await t.run(async (ctx) => {
      const row = await readCharacterRow(ctx, character.id)
      if (!row) throw new Error('Missing Character.')
      await editCharacterRecord(ctx, character.id, (document) => document, {
        sheetState: {
          ...readCharacterSheetState(row),
          itemUsage: [{ itemInstanceId: item.id, used: 1 }]
        },
        streamVersion: row.play.streamVersion + 1
      })
    })
    const setQuantity = (expectedVersion: number, quantity: number) =>
      owner.caller.mutation(api.characters.sheetCommands.execute, {
        id: character.id,
        command: {
          type: 'UPDATE_INVENTORY_ITEM',
          commandId: crypto.randomUUID(),
          expectedVersion,
          itemId: item.id,
          quantity
        }
      })

    await expect(setQuantity(staleVersion, 9)).rejects.toThrow()
    expect((await readInventory(fixture, character.id)).stored[0]?.quantity).toBe(item.quantity)

    await setQuantity(staleVersion + 1, 5)
    const after = await readInventory(fixture, character.id)
    expect(after.effective[0]?.quantity).toBe(5)
    expect(after.stored[0]?.quantity).toBe(6)
    expect(after.usage).toEqual([{ itemInstanceId: item.id, used: 1 }])
  }, 120000)
})
