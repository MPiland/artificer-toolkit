import { readReceiptHeaders } from '../lib/receiptLedgers'
import { makeFunctionReference } from 'convex/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type {
  CharacterSheetCommandResponseDto,
  CharacterSheetExecuteInput
} from '@artificer-toolkit/schema/api/characterSheetCommands'
import type {
  CharacterSheetReadInput,
  CharacterSheetResponseDto
} from '@artificer-toolkit/schema/api/characterSheetData'
import { readCharacterSheetState } from '@artificer-toolkit/schema/projections/characterStoredState'
import { HAND_CONFLICT_MESSAGE } from '@artificer-toolkit/shared/core'
import { club } from '@artificer-toolkit/source-data/srd/equipment/club.js'
import { shieldWood } from '@artificer-toolkit/source-data/srd/equipment/shield-wood.js'
import { SRD_CONTENT_SOURCE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import * as projection from '@artificer-toolkit/rules-runtime/character/sheetProjection'
import { api } from '../_generated/api'
import { importedSubject, importSeededSubjects } from '../../tests/fixtures/publication'
import { countDatabaseIo, createDatabaseIoTotals } from '../../tests/fixtures/databaseIo'
import { readyCharacterFixture } from '../../tests/fixtures/readyCharacter'
import { executeCharacterSheetCommand } from './sheetCommands'
import { readCharacterRecord, readCharacterRow } from './stateDocuments'

const execute = makeFunctionReference<
  'mutation',
  CharacterSheetExecuteInput,
  CharacterSheetCommandResponseDto
>('characters/sheetCommands:execute')
const getSheet = makeFunctionReference<
  'query',
  CharacterSheetReadInput,
  CharacterSheetResponseDto | null
>('characters/sheet:get')

async function fixture() {
  const base = await readyCharacterFixture()
  const equipment = {
    ...club,
    id: crypto.randomUUID(),
    label: 'Charged Club',
    requiresAttunement: true,
    charges: {
      id: crypto.randomUUID(),
      resetKind: 'SHORT_REST' as const,
      limitKind: 'FIXED_AMOUNT' as const,
      scalingKind: 'NONE' as const,
      amount: 3
    }
  }
  await importSeededSubjects(base.t, {
    contentSourceId: SRD_CONTENT_SOURCE.id,
    subjects: [importedSubject({ subjectKind: 'EQUIPMENT', ...equipment, document: equipment })]
  })
  const { draft, character } = await base.createCharacter()
  await base.owner.caller.mutation(api.characters.commit.commit, {
    expectedDraftId: draft.id,
    mode: 'create',
    character
  })
  const readState = () =>
    base.t.run(async (ctx) => ({
      character: await readCharacterRow(ctx, character.id),
      receipts: await readReceiptHeaders(
        ctx,
        'characterCommandReceipts',
        await ctx.db
          .query('characterCommandReceipts')
          .withIndex('by_characterId_commandId', (q) => q.eq('characterId', character.id))
          .collect()
      )
    }))
  return { ...base, character, equipment, readState }
}

function stateOf(snapshot: Awaited<ReturnType<Awaited<ReturnType<typeof fixture>>['readState']>>) {
  if (!snapshot.character?.sheetState) throw new Error('Missing Sheet state')
  return readCharacterSheetState(snapshot.character)
}

function authoredOf(
  snapshot: Awaited<ReturnType<Awaited<ReturnType<typeof fixture>>['readState']>>
) {
  if (!snapshot.character) throw new Error('Missing Character')
  return readCharacterRecord(snapshot.character)
}

function inventoryItems(sheet: CharacterSheetResponseDto, equipmentId: string) {
  return sheet.inventory.items.filter((item) => item.equipmentId === equipmentId)
}

afterEach(() => vi.restoreAllMocks())

describe('native Character Sheet inventory commands', () => {
  it('keeps charged copies distinct, enforces nonstacking and attunement, and replays safely', async () => {
    const { owner, character, equipment, readState } = await fixture()
    const builderIntent = authoredOf(await readState()).intent
    const addRequest = {
      id: character.id,
      command: {
        type: 'ADD_INVENTORY_ITEM' as const,
        commandId: crypto.randomUUID(),
        expectedVersion: 1,
        equipmentId: equipment.id,
        quantity: 4
      }
    }
    const firstAdd = await owner.caller.mutation(execute, addRequest)
    expect(firstAdd).not.toHaveProperty('sheet')
    const firstAddSheet = (await owner.caller.query(api.characters.sheet.get, {
      id: firstAdd.characterId
    }))!
    const added = inventoryItems(firstAddSheet, equipment.id)
    expect(added).toHaveLength(4)
    expect(new Set(added.map((item) => item.id)).size).toBe(4)
    expect(added.every((item) => item.quantity === 1)).toBe(true)
    const beforeInvalid = await readState()
    await expect(
      owner.caller.mutation(execute, {
        id: character.id,
        command: {
          type: 'ADD_INVENTORY_ITEM',
          commandId: crypto.randomUUID(),
          expectedVersion: 2,
          equipmentId: equipment.id,
          quantity: 101
        }
      })
    ).rejects.toThrow()
    await expect(
      owner.caller.mutation(execute, {
        id: character.id,
        command: {
          type: 'UPDATE_INVENTORY_ITEM',
          commandId: crypto.randomUUID(),
          expectedVersion: 2,
          itemId: added[0]!.id,
          quantity: 2
        }
      })
    ).rejects.toThrow()
    expect(await readState()).toEqual(beforeInvalid)

    const renamed = await owner.caller.mutation(execute, {
      id: character.id,
      command: {
        type: 'UPDATE_INVENTORY_ITEM',
        commandId: crypto.randomUUID(),
        expectedVersion: 2,
        itemId: added[0]!.id,
        customName: 'Charged Club One',
        notes: 'Keep ready'
      }
    })
    expect(renamed).not.toHaveProperty('sheet')
    const renamedSheet = (await owner.caller.query(api.characters.sheet.get, {
      id: renamed.characterId
    }))!
    expect(renamedSheet.inventory.items.find((item) => item.id === added[0]!.id)).toMatchObject({
      customName: 'Charged Club One',
      notes: 'Keep ready'
    })
    const cleared = await owner.caller.mutation(execute, {
      id: character.id,
      command: {
        type: 'UPDATE_INVENTORY_ITEM',
        commandId: crypto.randomUUID(),
        expectedVersion: 3,
        itemId: added[0]!.id,
        customName: null,
        notes: null
      }
    })
    expect(cleared).not.toHaveProperty('sheet')
    const clearedSheet = (await owner.caller.query(api.characters.sheet.get, {
      id: cleared.characterId
    }))!
    const clearedItem = clearedSheet.inventory.items.find((item) => item.id === added[0]!.id)!
    expect(clearedItem.customName).toBeUndefined()
    expect(clearedItem.notes).toBeUndefined()

    let expectedVersion = 4
    // Two hands hold two clubs (D107); a third is refused without a write.
    for (const item of added.slice(0, 2)) {
      await owner.caller.mutation(execute, {
        id: character.id,
        command: {
          type: 'EQUIP_ITEM',
          commandId: crypto.randomUUID(),
          expectedVersion,
          itemId: item.id
        }
      })
      expectedVersion += 1
    }
    const beforeThirdClub = await readState()
    await expect(
      owner.caller.mutation(execute, {
        id: character.id,
        command: {
          type: 'EQUIP_ITEM',
          commandId: crypto.randomUUID(),
          expectedVersion,
          itemId: added[2]!.id
        }
      })
    ).rejects.toThrow(HAND_CONFLICT_MESSAGE.HAND_OCCUPIED_TWICE)
    expect(await readState()).toEqual(beforeThirdClub)
    expect(authoredOf(beforeThirdClub).state.equipment.equipped).toEqual([
      { itemId: added[0]!.id, slot: 'MAIN_HAND' },
      { itemId: added[1]!.id, slot: 'OFF_HAND' }
    ])
    for (const item of added.slice(0, 3)) {
      await owner.caller.mutation(execute, {
        id: character.id,
        command: {
          type: 'ATTUNE_ITEM',
          commandId: crypto.randomUUID(),
          expectedVersion,
          itemId: item.id
        }
      })
      expectedVersion += 1
    }
    const beforeAttunementFailure = await readState()
    await expect(
      owner.caller.mutation(execute, {
        id: character.id,
        command: {
          type: 'ATTUNE_ITEM',
          commandId: crypto.randomUUID(),
          expectedVersion,
          itemId: added[3]!.id
        }
      })
    ).rejects.toThrow()

    expect(await readState()).toEqual(beforeAttunementFailure)
    for (const type of ['UNATTUNE_ITEM', 'UNEQUIP_ITEM'] as const) {
      await owner.caller.mutation(execute, {
        id: character.id,
        command: {
          type,
          commandId: crypto.randomUUID(),
          expectedVersion,
          itemId: added[0]!.id
        }
      })
      expectedVersion += 1
    }
    const final = await owner.caller.mutation(execute, {
      id: character.id,
      command: {
        type: 'ATTUNE_ITEM',
        commandId: crypto.randomUUID(),
        expectedVersion,
        itemId: added[3]!.id
      }
    })
    expect(final).not.toHaveProperty('sheet')
    const finalSheet = (await owner.caller.query(api.characters.sheet.get, {
      id: final.characterId
    }))!
    expect(finalSheet.inventory.items.find((item) => item.id === added[0]!.id)).toMatchObject({
      attuned: false,
      equippedSlot: null
    })
    // Unequipping the main-hand club moved the off-hand club into the main hand.
    expect(finalSheet.inventory.items.find((item) => item.id === added[1]!.id)).toMatchObject({
      equippedSlot: 'MAIN_HAND'
    })
    expect(finalSheet.inventory.items.find((item) => item.id === added[3]!.id)?.attuned).toBe(true)
    const afterAttunement = await readState()
    expect(authoredOf(afterAttunement).intent).toEqual(builderIntent)
    expect(
      inventoryItems((await owner.caller.query(getSheet, { id: character.id }))!, equipment.id)
    ).toHaveLength(4)
    const replay = await owner.caller.mutation(execute, addRequest)
    expect(replay).not.toHaveProperty('sheet')
    const replaySheet = (await owner.caller.query(api.characters.sheet.get, {
      id: replay.characterId
    }))!
    expect(replay.historyEntry).toEqual(firstAdd.historyEntry)
    expect(inventoryItems(replaySheet, equipment.id)).toHaveLength(4)
    expect(replaySheet).toEqual(finalSheet)
    expect(await readState()).toEqual(afterAttunement)
  }, 15000)

  it.each([{ type: 'REMOVE_INVENTORY_ITEM' as const }, { type: 'UPDATE_INVENTORY_ITEM' as const }])(
    'cleans only the deleted charged item for $type',
    async ({ type }) => {
      const { owner, character, equipment, readState } = await fixture()
      const first = await owner.caller.mutation(execute, {
        id: character.id,
        command: {
          type: 'ADD_INVENTORY_ITEM',
          commandId: crypto.randomUUID(),
          expectedVersion: 1,
          equipmentId: equipment.id,
          quantity: 1
        }
      })
      expect(first).not.toHaveProperty('sheet')
      const firstSheet = (await owner.caller.query(api.characters.sheet.get, {
        id: first.characterId
      }))!
      const second = await owner.caller.mutation(execute, {
        id: character.id,
        command: {
          type: 'ADD_INVENTORY_ITEM',
          commandId: crypto.randomUUID(),
          expectedVersion: 2,
          equipmentId: equipment.id,
          quantity: 1
        }
      })
      expect(second).not.toHaveProperty('sheet')
      const secondSheet = (await owner.caller.query(api.characters.sheet.get, {
        id: second.characterId
      }))!
      const firstItem = inventoryItems(firstSheet, equipment.id)[0]!
      const secondItem = inventoryItems(secondSheet, equipment.id).find(
        (item) => item.id !== firstItem.id
      )!
      let response = await owner.caller.mutation(execute, {
        id: character.id,
        command: {
          type: 'EQUIP_ITEM',
          commandId: crypto.randomUUID(),
          expectedVersion: 3,
          itemId: firstItem.id
        }
      })
      expect(response).not.toHaveProperty('sheet')
      let responseSheet = (await owner.caller.query(api.characters.sheet.get, {
        id: response.characterId
      }))!
      response = await owner.caller.mutation(execute, {
        id: character.id,
        command: {
          type: 'ATTUNE_ITEM',
          commandId: crypto.randomUUID(),
          expectedVersion: 4,
          itemId: firstItem.id
        }
      })
      expect(response).not.toHaveProperty('sheet')
      responseSheet = (await owner.caller.query(api.characters.sheet.get, {
        id: response.characterId
      }))!
      response = await owner.caller.mutation(execute, {
        id: character.id,
        command: {
          type: 'USE_SHEET_RESOURCE',
          commandId: crypto.randomUUID(),
          expectedVersion: 5,
          owner: responseSheet.resources.items.find(
            (resource) =>
              resource.owner.kind === 'ITEM_INSTANCE' &&
              resource.owner.itemInstanceId === firstItem.id
          )!.owner,
          amount: 1
        }
      })
      expect(response).not.toHaveProperty('sheet')
      responseSheet = (await owner.caller.query(api.characters.sheet.get, {
        id: response.characterId
      }))!
      response = await owner.caller.mutation(execute, {
        id: character.id,
        command: {
          type: 'UPSERT_SHEET_ADJUSTMENT',
          commandId: crypto.randomUUID(),
          expectedVersion: 6,
          adjustment: {
            family: 'ITEM',
            itemInstanceId: firstItem.id,
            field: 'DAMAGE_BONUS',
            value: 1
          }
        }
      })
      expect(response).not.toHaveProperty('sheet')
      responseSheet = (await owner.caller.query(api.characters.sheet.get, {
        id: response.characterId
      }))!
      response = await owner.caller.mutation(execute, {
        id: character.id,
        command: {
          type: 'EQUIP_ITEM',
          commandId: crypto.randomUUID(),
          expectedVersion: 7,
          itemId: secondItem.id
        }
      })
      expect(response).not.toHaveProperty('sheet')
      responseSheet = (await owner.caller.query(api.characters.sheet.get, {
        id: response.characterId
      }))!
      response = await owner.caller.mutation(execute, {
        id: character.id,
        command: {
          type: 'ATTUNE_ITEM',
          commandId: crypto.randomUUID(),
          expectedVersion: 8,
          itemId: secondItem.id
        }
      })
      expect(response).not.toHaveProperty('sheet')
      responseSheet = (await owner.caller.query(api.characters.sheet.get, {
        id: response.characterId
      }))!
      response = await owner.caller.mutation(execute, {
        id: character.id,
        command: {
          type: 'USE_SHEET_RESOURCE',
          commandId: crypto.randomUUID(),
          expectedVersion: 9,
          owner: responseSheet.resources.items.find(
            (resource) =>
              resource.owner.kind === 'ITEM_INSTANCE' &&
              resource.owner.itemInstanceId === secondItem.id
          )!.owner,
          amount: 1
        }
      })
      expect(response).not.toHaveProperty('sheet')
      responseSheet = (await owner.caller.query(api.characters.sheet.get, {
        id: response.characterId
      }))!
      response = await owner.caller.mutation(execute, {
        id: character.id,
        command: {
          type: 'UPSERT_SHEET_ADJUSTMENT',
          commandId: crypto.randomUUID(),
          expectedVersion: 10,
          adjustment: {
            family: 'ITEM',
            itemInstanceId: secondItem.id,
            field: 'DAMAGE_BONUS',
            value: 1
          }
        }
      })
      expect(response).not.toHaveProperty('sheet')
      responseSheet = (await owner.caller.query(api.characters.sheet.get, {
        id: response.characterId
      }))!
      const beforeDelete = await readState()
      const command =
        type === 'REMOVE_INVENTORY_ITEM'
          ? {
              type,
              commandId: crypto.randomUUID(),
              expectedVersion: 11,
              itemId: firstItem.id
            }
          : {
              type,
              commandId: crypto.randomUUID(),
              expectedVersion: 11,
              itemId: firstItem.id,
              quantity: 0
            }
      const deleted = await owner.caller.mutation(execute, { id: character.id, command })
      expect(deleted).not.toHaveProperty('sheet')
      const deletedSheet = (await owner.caller.query(api.characters.sheet.get, {
        id: deleted.characterId
      }))!
      const state = stateOf(await readState())
      expect(
        state.adjustments.some(
          (adjustment) => adjustment.family === 'ITEM' && adjustment.itemInstanceId === firstItem.id
        )
      ).toBe(false)
      expect(
        state.resourceUsage.some(
          (usage) =>
            usage.owner.kind === 'ITEM_INSTANCE' && usage.owner.itemInstanceId === firstItem.id
        )
      ).toBe(false)
      expect(
        state.resourceUsage.some(
          (usage) =>
            usage.owner.kind === 'ITEM_INSTANCE' && usage.owner.itemInstanceId === secondItem.id
        )
      ).toBe(true)
      expect(
        state.adjustments.some(
          (adjustment) =>
            adjustment.family === 'ITEM' && adjustment.itemInstanceId === secondItem.id
        )
      ).toBe(true)
      expect(deletedSheet.inventory.items.some((item) => item.id === firstItem.id)).toBe(false)
      expect(deletedSheet.inventory.items.find((item) => item.id === secondItem.id)).toBeDefined()
      expect((await readState()).receipts).toHaveLength(beforeDelete.receipts.length + 1)
      const afterDelete = await readState()
      expect(authoredOf(afterDelete).state.equipment.equipped).not.toContainEqual(
        expect.objectContaining({ itemId: firstItem.id })
      )
      expect(authoredOf(afterDelete).state.equipment.attuned).not.toContain(firstItem.id)
      expect(deleted.streamVersion).toBe(command.expectedVersion + 1)
      const replay = await owner.caller.mutation(execute, { id: character.id, command })
      expect(replay).not.toHaveProperty('sheet')
      expect(replay.historyEntry).toEqual(deleted.historyEntry)
      expect(await readState()).toEqual(afterDelete)
    }
  )

  it('assigns hands on equip, swaps them, promotes an off-hand weapon, and counts only a held shield (D107)', async () => {
    const { t, owner, character, equipment } = await fixture()
    await importSeededSubjects(t, {
      contentSourceId: SRD_CONTENT_SOURCE.id,
      subjects: [importedSubject({ ...shieldWood, subjectKind: 'EQUIPMENT', document: shieldWood })]
    })
    let version = 1
    const run = async (
      command:
        | { type: 'ADD_INVENTORY_ITEM'; equipmentId: string; quantity: number }
        | { type: 'EQUIP_ITEM' | 'UNEQUIP_ITEM'; itemId: string }
        | { type: 'SWAP_HELD_ITEMS' }
    ) => {
      const response = await owner.caller.mutation(execute, {
        id: character.id,
        command: { ...command, commandId: crypto.randomUUID(), expectedVersion: version }
      })
      version = response.streamVersion
      return (await owner.caller.query(getSheet, { id: character.id }))!
    }
    const slots = (sheet: CharacterSheetResponseDto) =>
      Object.fromEntries(sheet.inventory.items.map((item) => [item.equipmentId, item.equippedSlot]))
    await run({ type: 'ADD_INVENTORY_ITEM', equipmentId: equipment.id, quantity: 1 })
    const carried = await run({
      type: 'ADD_INVENTORY_ITEM',
      equipmentId: shieldWood.id,
      quantity: 1
    })
    const clubId = inventoryItems(carried, equipment.id)[0]!.id
    const shieldId = inventoryItems(carried, shieldWood.id)[0]!.id
    const carriedArmorClass = carried.overview.armorClass

    const withClub = await run({ type: 'EQUIP_ITEM', itemId: clubId })
    expect(slots(withClub)).toMatchObject({ [equipment.id]: 'MAIN_HAND', [shieldWood.id]: null })
    expect(withClub.overview.armorClass).toBe(carriedArmorClass)

    const withShield = await run({ type: 'EQUIP_ITEM', itemId: shieldId })
    expect(slots(withShield)).toMatchObject({
      [equipment.id]: 'MAIN_HAND',
      [shieldWood.id]: 'OFF_HAND'
    })
    expect(withShield.overview.armorClass).toBe(carriedArmorClass + 2)

    const swapped = await run({ type: 'SWAP_HELD_ITEMS' })
    expect(slots(swapped)).toMatchObject({
      [equipment.id]: 'OFF_HAND',
      [shieldWood.id]: 'MAIN_HAND'
    })
    expect(swapped.overview.armorClass).toBe(carriedArmorClass + 2)

    const shieldDropped = await run({ type: 'UNEQUIP_ITEM', itemId: shieldId })
    expect(slots(shieldDropped)).toMatchObject({
      [equipment.id]: 'MAIN_HAND',
      [shieldWood.id]: null
    })
    expect(shieldDropped.overview.armorClass).toBe(carriedArmorClass)

    const lone = await run({ type: 'SWAP_HELD_ITEMS' })
    expect(slots(lone)).toMatchObject({ [equipment.id]: 'OFF_HAND' })
    const empty = await run({ type: 'UNEQUIP_ITEM', itemId: clubId })
    expect(slots(empty)).toMatchObject({ [equipment.id]: null, [shieldWood.id]: null })
    await expect(run({ type: 'SWAP_HELD_ITEMS' })).rejects.toThrow('No item is held to swap.')
  }, 30000)

  it('rejects foreign or missing item ids without writes and rolls back projection failures', async () => {
    const { owner, other, character, equipment, readState } = await fixture()
    const before = await readState()
    for (const actor of [owner, other]) {
      await expect(
        actor.caller.mutation(execute, {
          id: character.id,
          command: {
            type: 'EQUIP_ITEM',
            commandId: crypto.randomUUID(),
            expectedVersion: 1,
            itemId: crypto.randomUUID()
          }
        })
      ).rejects.toThrow()
    }
    expect(await readState()).toEqual(before)
    const original = projection.projectCharacterSheetBundle
    vi.spyOn(projection, 'projectCharacterSheetBundle')
      .mockImplementationOnce(original)
      .mockImplementationOnce(() => {
        throw new Error('Injected inventory projection failure')
      })
    const request: CharacterSheetExecuteInput = {
      id: character.id,
      command: {
        type: 'ADD_INVENTORY_ITEM',
        commandId: crypto.randomUUID(),
        expectedVersion: 1,
        equipmentId: equipment.id,
        quantity: 1
      }
    }
    await expect(owner.caller.mutation(execute, request)).rejects.toThrow(
      'Injected inventory projection failure'
    )
    expect(await readState()).toEqual(before)
    vi.restoreAllMocks()
    const retried = await owner.caller.mutation(execute, request)
    expect(retried).not.toHaveProperty('sheet')
    const retriedSheet = (await owner.caller.query(api.characters.sheet.get, {
      id: retried.characterId
    }))!
    expect(retried.streamVersion).toBe(2)
    expect((await readState()).receipts).toHaveLength(1)
    const stack = retriedSheet.inventory.items.find((item) => item.equipmentId === club.id)!
    expect(stack.quantity).toBe(2)
    await owner.caller.mutation(execute, {
      id: character.id,
      command: {
        type: 'UPSERT_SHEET_ADJUSTMENT',
        commandId: crypto.randomUUID(),
        expectedVersion: 2,
        adjustment: { family: 'ITEM', itemInstanceId: stack.id, field: 'WEIGHT_OVERRIDE', value: 1 }
      }
    })
    const beforePartialRemoval = stateOf(await readState())
    const partial = await owner.caller.mutation(execute, {
      id: character.id,
      command: {
        type: 'REMOVE_INVENTORY_ITEM',
        commandId: crypto.randomUUID(),
        expectedVersion: 3,
        itemId: stack.id,
        quantity: 1
      }
    })
    expect(partial).not.toHaveProperty('sheet')
    const partialSheet = (await owner.caller.query(api.characters.sheet.get, {
      id: partial.characterId
    }))!
    expect(partialSheet.inventory.items.find((item) => item.id === stack.id)?.quantity).toBe(1)
    expect(stateOf(await readState())).toEqual(beforePartialRemoval)
  })

  // RELIABILITY-21.16: the command must stay well inside the 1 s function limit on a full catalogue.
  it('reads the Equipment it adds, not the Equipment catalogue', async () => {
    const { t, owner, character, equipment } = await fixture()
    const catalogueSize = 30
    // An import takes at most 10 subjects.
    for (let batch = 0; batch < catalogueSize / 10; batch += 1)
      await importSeededSubjects(t, {
        contentSourceId: SRD_CONTENT_SOURCE.id,
        subjects: Array.from({ length: 10 }, (_, index) => {
          const other = { ...club, id: crypto.randomUUID(), label: `Club ${batch * 10 + index}` }
          return importedSubject({ subjectKind: 'EQUIPMENT', ...other, document: other })
        })
      })
    const totals = createDatabaseIoTotals()
    await t.run((ctx) =>
      executeCharacterSheetCommand({ ...ctx, db: countDatabaseIo(ctx.db, totals) }, owner.userId, {
        id: character.id,
        command: {
          type: 'ADD_INVENTORY_ITEM',
          commandId: crypto.randomUUID(),
          expectedVersion: 1,
          equipmentId: equipment.id,
          quantity: 1
        }
      })
    )
    expect(totals.reads.byTable.authoredRoots!.distinct).toBeLessThan(catalogueSize)
    const sheet = (await owner.caller.query(api.characters.sheet.get, { id: character.id }))!
    expect(inventoryItems(sheet, equipment.id)).toHaveLength(1)

    await expect(
      owner.caller.mutation(execute, {
        id: character.id,
        command: {
          type: 'ADD_INVENTORY_ITEM',
          commandId: crypto.randomUUID(),
          expectedVersion: 2,
          equipmentId: crypto.randomUUID(),
          quantity: 1
        }
      })
    ).rejects.toThrow('is not available for this character')
  })
})
