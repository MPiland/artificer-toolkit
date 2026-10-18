import { readReceiptHeaders } from '../lib/receiptLedgers'
import { makeFunctionReference } from 'convex/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type {
  CharacterSheetExecuteInput,
  CharacterSheetCommandResponseDto
} from '@artificer-toolkit/schema/api/characterSheetCommands'
import type {
  CharacterSheetReadInput,
  CharacterSheetResponseDto
} from '@artificer-toolkit/schema/api/characterSheetData'
import * as projection from '@artificer-toolkit/rules-runtime/character/sheetProjection'
import { backpack } from '@artificer-toolkit/source-data/srd/equipment/backpack.js'
import { fighter } from '@artificer-toolkit/source-data/srd/classes/fighter.js'
import { SRD_CONTENT_SOURCE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { api, internal } from '../_generated/api'
import { readyCharacterFixture } from '../../tests/fixtures/readyCharacter'
import { importedSubject } from '../../tests/fixtures/publication'
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
if (fighter.category !== 'BASE') throw new Error('Expected the canonical parent Fighter class.')
const currencyId = fighter.startingGold.currencyId

async function fixture() {
  const base = await readyCharacterFixture()
  await base.t.mutation(internal.content.import.importSubjects, {
    contentSourceId: SRD_CONTENT_SOURCE.id,
    subjects: [importedSubject({ subjectKind: 'EQUIPMENT', ...backpack, document: backpack })]
  })
  const { draft, character } = await base.createCharacter()
  await base.owner.caller.mutation(api.characters.commit.commit, {
    expectedDraftId: draft.id,
    mode: 'create',
    character
  })
  const sheet = (await base.owner.caller.query(getSheet, { id: character.id }))!
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
  return { ...base, character, sheet, readState }
}

afterEach(() => vi.restoreAllMocks())

describe('native Character Sheet currency and containers', () => {
  it('moves balances atomically, replays current state, and releases an emptied container', async () => {
    const { owner, character, sheet, readState } = await fixture()
    const before = await readState()
    const loose = sheet.inventory.currencies.find(
      (currency) => currency.currencyId === currencyId && !currency.containerId
    )!.amount
    const added = await owner.caller.mutation(execute, {
      id: character.id,
      command: {
        type: 'ADD_INVENTORY_ITEM',
        commandId: crypto.randomUUID(),
        expectedVersion: 1,
        equipmentId: backpack.id,
        quantity: 1
      }
    })
    expect(added).not.toHaveProperty('sheet')
    const addedSheet = (await owner.caller.query(api.characters.sheet.get, {
      id: added.characterId
    }))!
    const bag = addedSheet.inventory.containers![0]!
    const credit: CharacterSheetExecuteInput = {
      id: character.id,
      command: {
        type: 'ADJUST_CURRENCY',
        commandId: crypto.randomUUID(),
        expectedVersion: 2,
        currencyId,
        kind: 'RULESET',
        amount: 10,
        containerId: bag.id
      }
    }
    const credited = await owner.caller.mutation(execute, credit)
    expect(credited).not.toHaveProperty('sheet')
    const creditedSheet = (await owner.caller.query(api.characters.sheet.get, {
      id: credited.characterId
    }))!
    expect(creditedSheet.inventory.currencies).toContainEqual(
      expect.objectContaining({
        currencyId,
        kind: 'RULESET',
        amount: 10,
        containerId: bag.id
      })
    )
    const move: CharacterSheetExecuteInput = {
      id: character.id,
      command: {
        type: 'MOVE_CURRENCY',
        commandId: crypto.randomUUID(),
        expectedVersion: 3,
        currencyId,
        kind: 'RULESET',
        amount: 5,
        fromContainerId: bag.id
      }
    }
    const beforeMove = await readState()
    const original = projection.projectCharacterSheetBundle
    vi.spyOn(projection, 'projectCharacterSheetBundle')
      .mockImplementationOnce(original)
      .mockImplementationOnce(() => {
        throw new Error('Injected currency failure')
      })
    await expect(owner.caller.mutation(execute, move)).rejects.toThrow('Injected currency failure')
    expect(await readState()).toEqual(beforeMove)
    vi.restoreAllMocks()
    const moved = await owner.caller.mutation(execute, move)
    expect(moved).not.toHaveProperty('sheet')
    const movedSheet = (await owner.caller.query(api.characters.sheet.get, {
      id: moved.characterId
    }))!
    expect(movedSheet.inventory.currencies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          currencyId,
          kind: 'RULESET',
          amount: 5,
          containerId: bag.id
        }),
        expect.objectContaining({ currencyId, amount: loose + 5 })
      ])
    )
    const afterMove = await readState()
    const replay = await owner.caller.mutation(execute, credit)
    expect(replay).not.toHaveProperty('sheet')
    const replaySheet = (await owner.caller.query(api.characters.sheet.get, {
      id: replay.characterId
    }))!
    expect(replay.historyEntry).toEqual(credited.historyEntry)
    expect(replaySheet).toEqual(movedSheet)
    expect(await readState()).toEqual(afterMove)
    await owner.caller.mutation(execute, {
      ...move,
      command: {
        ...move.command,
        type: 'MOVE_CURRENCY',
        commandId: crypto.randomUUID(),
        expectedVersion: 4,
        currencyId,
        kind: 'RULESET',
        amount: 5,
        fromContainerId: bag.id
      }
    })
    const removed = await owner.caller.mutation(execute, {
      id: character.id,
      command: {
        type: 'REMOVE_INVENTORY_ITEM',
        commandId: crypto.randomUUID(),
        expectedVersion: 5,
        itemId: bag.id
      }
    })
    expect(removed).not.toHaveProperty('sheet')
    const removedSheet = (await owner.caller.query(api.characters.sheet.get, {
      id: removed.characterId
    }))!
    expect(removedSheet.inventory.containers).toEqual([])
    expect(removedSheet.inventory.currencies).toContainEqual(
      expect.objectContaining({ currencyId, amount: loose + 10 })
    )
    const stored = readCharacterRecord((await readState()).character!)
    expect(stored.intent).toEqual(readCharacterRecord(before.character!).intent)
    expect(stored.state.currency.every((group) => group.containerId !== bag.id)).toBe(true)
  })

  it('rejects unknown currencies, foreign containers, overspending, nested containers and nonempty deletion', async () => {
    const { owner, character, sheet, readState } = await fixture()
    const added = await owner.caller.mutation(execute, {
      id: character.id,
      command: {
        type: 'ADD_INVENTORY_ITEM',
        commandId: crypto.randomUUID(),
        expectedVersion: 1,
        equipmentId: backpack.id,
        quantity: 1
      }
    })
    expect(added).not.toHaveProperty('sheet')
    const addedSheet = (await owner.caller.query(api.characters.sheet.get, {
      id: added.characterId
    }))!
    const bag = addedSheet.inventory.containers![0]!
    const item = sheet.inventory.items[0]!
    const beforeInvalid = await readState()
    for (const command of [
      { type: 'ADJUST_CURRENCY', currencyId: crypto.randomUUID(), kind: 'RULESET', amount: 1 },
      { type: 'ADJUST_CURRENCY', currencyId, kind: 'RULESET', amount: 1, containerId: crypto.randomUUID() },
      { type: 'MOVE_CURRENCY', currencyId, kind: 'RULESET', amount: 1, fromContainerId: crypto.randomUUID() },
      { type: 'MOVE_CURRENCY', currencyId, kind: 'RULESET', amount: 1, toContainerId: crypto.randomUUID() },
      { type: 'MOVE_CURRENCY', currencyId, kind: 'RULESET', amount: 1, fromContainerId: bag.id },
      { type: 'ADD_INVENTORY_ITEM', equipmentId: backpack.id, quantity: 1, containerId: bag.id },
      { type: 'UPDATE_INVENTORY_ITEM', itemId: bag.id, containerId: bag.id }
    ] as const) {
      await expect(
        owner.caller.mutation(execute, {
          id: character.id,
          command: {
            ...command,
            commandId: crypto.randomUUID(),
            expectedVersion: 2
          }
        })
      ).rejects.toThrow()
      expect(await readState()).toEqual(beforeInvalid)
    }
    await owner.caller.mutation(execute, {
      id: character.id,
      command: {
        type: 'UPDATE_INVENTORY_ITEM',
        commandId: crypto.randomUUID(),
        expectedVersion: 2,
        itemId: item.id,
        containerId: bag.id
      }
    })
    const beforeRemoval = await readState()
    for (const command of [
      { type: 'REMOVE_INVENTORY_ITEM', itemId: bag.id },
      { type: 'UPDATE_INVENTORY_ITEM', itemId: bag.id, quantity: 0 }
    ] as const) {
      await expect(
        owner.caller.mutation(execute, {
          id: character.id,
          command: {
            ...command,
            commandId: crypto.randomUUID(),
            expectedVersion: 3
          }
        })
      ).rejects.toThrow(/Move all items and currency/)
      expect(await readState()).toEqual(beforeRemoval)
    }
    await owner.caller.mutation(execute, {
      id: character.id,
      command: {
        type: 'UPDATE_INVENTORY_ITEM',
        commandId: crypto.randomUUID(),
        expectedVersion: 3,
        itemId: item.id,
        containerId: null
      }
    })
    await owner.caller.mutation(execute, {
      id: character.id,
      command: {
        type: 'ADJUST_CURRENCY',
        commandId: crypto.randomUUID(),
        expectedVersion: 4,
        currencyId,
        kind: 'RULESET',
        amount: 1,
        containerId: bag.id
      }
    })
    const beforeCurrencyRemoval = await readState()
    await expect(
      owner.caller.mutation(execute, {
        id: character.id,
        command: {
          type: 'REMOVE_INVENTORY_ITEM',
          commandId: crypto.randomUUID(),
          expectedVersion: 5,
          itemId: bag.id
        }
      })
    ).rejects.toThrow(/Move all items and currency/)
    expect(await readState()).toEqual(beforeCurrencyRemoval)
  })

  it('preserves existing zero-balance rows and clamps debits without changing Builder intent', async () => {
    const { owner, character, sheet, readState } = await fixture()
    const before = await readState()
    const initial = sheet.inventory.currencies.find(
      (currency) => currency.currencyId === currencyId && !currency.containerId
    )!
    const debited = await owner.caller.mutation(execute, {
      id: character.id,
      command: {
        type: 'ADJUST_CURRENCY',
        commandId: crypto.randomUUID(),
        expectedVersion: 1,
        currencyId,
        kind: 'RULESET',
        amount: -initial.amount - 1
      }
    })
    expect(debited).not.toHaveProperty('sheet')
    const debitedSheet = (await owner.caller.query(api.characters.sheet.get, {
      id: debited.characterId
    }))!
    expect(debitedSheet.inventory.currencies).toContainEqual(
      expect.objectContaining({ currencyId, amount: 0 })
    )
    const stored = readCharacterRecord((await readState()).character!)
    const original = readCharacterRecord(before.character!)
    expect(stored.state.currency.map((group) => group.id)).toEqual(
      original.state.currency.map((group) => group.id)
    )
    expect(stored.intent).toEqual(original.intent)
  })
})
