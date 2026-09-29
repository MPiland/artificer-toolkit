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
import { club } from '@artificer-toolkit/source-data/srd/equipment/club.js'
import { SRD_CONTENT_SOURCE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import * as projection from '@artificer-toolkit/rules-runtime/character/sheetProjection'
import { api, internal } from '../_generated/api'
import { importedSubject } from '../../tests/fixtures/publication'
import { readyCharacterFixture } from '../../tests/fixtures/readyCharacter'
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
  await base.t.mutation(internal.content.import.importSubjects, {
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
      receipts: await ctx.db
        .query('characterCommandReceipts')
        .withIndex('by_characterId_commandId', (q) => q.eq('characterId', character.id))
        .collect()
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
    const added = inventoryItems(firstAdd.sheet, equipment.id)
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
    expect(renamed.sheet.inventory.items.find((item) => item.id === added[0]!.id)).toMatchObject({
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
    const clearedItem = cleared.sheet.inventory.items.find((item) => item.id === added[0]!.id)!
    expect(clearedItem.customName).toBeUndefined()
    expect(clearedItem.notes).toBeUndefined()

    let expectedVersion = 4
    for (const item of added) {
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
    expect(final.sheet.inventory.items.find((item) => item.id === added[0]!.id)).toMatchObject({
      attuned: false,
      equipped: false
    })
    expect(final.sheet.inventory.items.find((item) => item.id === added[3]!.id)?.attuned).toBe(true)
    const afterAttunement = await readState()
    expect(authoredOf(afterAttunement).intent).toEqual(builderIntent)
    expect(
      inventoryItems((await owner.caller.query(getSheet, { id: character.id }))!, equipment.id)
    ).toHaveLength(4)
    const replay = await owner.caller.mutation(execute, addRequest)
    expect(replay.historyEntry).toEqual(firstAdd.historyEntry)
    expect(inventoryItems(replay.sheet, equipment.id)).toHaveLength(4)
    expect(replay.sheet).toEqual(final.sheet)
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
      const firstItem = inventoryItems(first.sheet, equipment.id)[0]!
      const secondItem = inventoryItems(second.sheet, equipment.id).find(
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
      response = await owner.caller.mutation(execute, {
        id: character.id,
        command: {
          type: 'ATTUNE_ITEM',
          commandId: crypto.randomUUID(),
          expectedVersion: 4,
          itemId: firstItem.id
        }
      })
      response = await owner.caller.mutation(execute, {
        id: character.id,
        command: {
          type: 'USE_SHEET_RESOURCE',
          commandId: crypto.randomUUID(),
          expectedVersion: 5,
          owner: response.sheet.resources.items.find(
            (resource) =>
              resource.owner.kind === 'ITEM_INSTANCE' &&
              resource.owner.itemInstanceId === firstItem.id
          )!.owner,
          amount: 1
        }
      })
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
      response = await owner.caller.mutation(execute, {
        id: character.id,
        command: {
          type: 'EQUIP_ITEM',
          commandId: crypto.randomUUID(),
          expectedVersion: 7,
          itemId: secondItem.id
        }
      })
      response = await owner.caller.mutation(execute, {
        id: character.id,
        command: {
          type: 'ATTUNE_ITEM',
          commandId: crypto.randomUUID(),
          expectedVersion: 8,
          itemId: secondItem.id
        }
      })
      response = await owner.caller.mutation(execute, {
        id: character.id,
        command: {
          type: 'USE_SHEET_RESOURCE',
          commandId: crypto.randomUUID(),
          expectedVersion: 9,
          owner: response.sheet.resources.items.find(
            (resource) =>
              resource.owner.kind === 'ITEM_INSTANCE' &&
              resource.owner.itemInstanceId === secondItem.id
          )!.owner,
          amount: 1
        }
      })
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
      expect(deleted.sheet.inventory.items.some((item) => item.id === firstItem.id)).toBe(false)
      expect(deleted.sheet.inventory.items.find((item) => item.id === secondItem.id)).toBeDefined()
      expect((await readState()).receipts).toHaveLength(beforeDelete.receipts.length + 1)
      const afterDelete = await readState()
      expect(authoredOf(afterDelete).state.equipment.equipped).not.toContain(firstItem.id)
      expect(authoredOf(afterDelete).state.equipment.attuned).not.toContain(firstItem.id)
      expect(deleted.streamVersion).toBe(command.expectedVersion + 1)
      const replay = await owner.caller.mutation(execute, { id: character.id, command })
      expect(replay.historyEntry).toEqual(deleted.historyEntry)
      expect(await readState()).toEqual(afterDelete)
    }
  )

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
    expect(retried.streamVersion).toBe(2)
    expect((await readState()).receipts).toHaveLength(1)
    const stack = retried.sheet.inventory.items.find((item) => item.equipmentId === club.id)!
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
    expect(partial.sheet.inventory.items.find((item) => item.id === stack.id)?.quantity).toBe(1)
    expect(stateOf(await readState())).toEqual(beforePartialRemoval)
  })
})
