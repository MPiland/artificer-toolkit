import { makeFunctionReference } from 'convex/server'
import { describe, expect, it } from 'vitest'
import {
  characterHistoryEntryDtoSchema,
  type CharacterHistoryInput,
  type CharacterHistoryPage
} from '@artificer-toolkit/schema/api/characterHistory'
import type {
  CharacterSheetCommandResponseDto,
  CharacterSheetExecuteInput,
  CharacterRestPreviewInput,
  CharacterRestPreviewResponseDto
} from '@artificer-toolkit/schema/api/characterSheetCommands'
import type {
  CharacterSheetReadInput,
  CharacterSheetResponseDto
} from '@artificer-toolkit/schema/api/characterSheetData'
import { writeCharacterRecord } from '../../tests/fixtures/characterRecords'
import { replaceReceiptRecord } from '../../tests/fixtures/receiptRecords'
import { canonicalizeRuleDocument, checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { readySheetFixture } from '../../tests/fixtures/readyCharacter'
import { readCharacterRecord, readCharacterRow } from './stateDocuments'

const list = makeFunctionReference<'query', CharacterHistoryInput, CharacterHistoryPage>(
  'characters/history:list'
)
const execute = makeFunctionReference<
  'mutation',
  CharacterSheetExecuteInput,
  CharacterSheetCommandResponseDto
>('characters/sheetCommands:execute')
const preview = makeFunctionReference<
  'query',
  CharacterRestPreviewInput,
  CharacterRestPreviewResponseDto
>('characters/rest:preview')
const getSheet = makeFunctionReference<
  'query',
  CharacterSheetReadInput,
  CharacterSheetResponseDto | null
>('characters/sheet:get')

describe('native personal Character history', () => {
  it('continues equal timestamps by public event UUID and rejects foreign or native window cursors', async () => {
    const { t, owner, character, readState, readReceiptStorage } = await readySheetFixture()
    for (const expectedVersion of [1, 2, 3])
      await owner.caller.mutation(execute, {
        id: character.id,
        command: {
          type: 'SET_INSPIRATION',
          inspired: expectedVersion % 2 === 1,
          expectedVersion,
          commandId: crypto.randomUUID()
        }
      })
    const occurredAt = '2026-09-30T00:00:00.000Z'
    const receipts = (await readState()).receipts
    const entries = receipts.map((receipt) => ({
      ...characterHistoryEntryDtoSchema.parse(JSON.parse(receipt.historyJson)),
      occurredAt
    }))
    await t.run(async (ctx) => {
      for (const [index, receipt] of receipts.entries()) {
        const history = entries[index]!
        await replaceReceiptRecord(ctx, 'characterCommandReceipts', receipt._id, {
          occurredAt,
          historyJson: canonicalizeRuleDocument(history),
          historyChecksum: checksumRuleDocument(history)
        })
      }
    })
    entries.sort((left, right) => left.eventId.localeCompare(right.eventId))
    const before = await readReceiptStorage()
    const first = await owner.caller.query(list, {
      id: character.id,
      paginationOpts: { cursor: null, numItems: 48 }
    })
    expect(first.page).toEqual(entries.slice(0, 1))
    const pages = [...first.page]
    let current = first
    while (!current.isDone && pages.length < 4) {
      current = await owner.caller.query(list, {
        id: character.id,
        paginationOpts: { cursor: current.continueCursor, numItems: 48 }
      })
      pages.push(...current.page)
    }
    expect(current.isDone).toBe(true)
    expect(pages).toEqual(entries)
    const empty = await owner.caller.query(list, {
      id: character.id,
      paginationOpts: { cursor: current.continueCursor, numItems: 48 }
    })
    expect(empty).toMatchObject({ page: [], isDone: true })
    const cursor: unknown = JSON.parse(first.continueCursor)
    if (typeof cursor !== 'object' || cursor === null) throw new Error('Expected a history cursor.')
    for (const invalid of [
      'malformed',
      JSON.stringify({ ...cursor, actorId: crypto.randomUUID() }),
      JSON.stringify({ ...cursor, characterId: crypto.randomUUID() })
    ])
      await expect(
        owner.caller.query(list, {
          id: character.id,
          paginationOpts: { cursor: invalid, numItems: 48 }
        })
      ).rejects.toThrow()
    const nativeList = makeFunctionReference<'query', Record<string, unknown>, unknown>(
      'characters/history:list'
    )
    await expect(
      owner.caller.query(nativeList, {
        id: character.id,
        paginationOpts: { cursor: null, numItems: 48, endCursor: first.continueCursor }
      })
    ).rejects.toThrow()
    expect(await readReceiptStorage()).toEqual(before)
  })

  it('pages exact chronological receipts without writes and denies foreign or anonymous readers', async () => {
    const { t, owner, other, character, committed, readState, readReceiptStorage } =
      await readySheetFixture()
    const input: CharacterHistoryInput = {
      id: committed.publicId,
      paginationOpts: { cursor: null, numItems: 2 }
    }
    expect(await owner.caller.query(list, input)).toMatchObject({
      characterId: character.id,
      page: [],
      isDone: true
    })
    const entries = []
    for (const expectedVersion of [1, 2, 3]) {
      const response = await owner.caller.mutation(execute, {
        id: character.id,
        command: {
          type: 'SET_INSPIRATION',
          inspired: expectedVersion % 2 === 1,
          expectedVersion,
          commandId: crypto.randomUUID()
        }
      })
      entries.push(response.historyEntry!)
    }
    const before = await readState()
    const beforeStorage = await readReceiptStorage()
    const first = await owner.caller.query(list, input)
    expect(first.page).toEqual(entries.slice(0, 1))
    expect(first.isDone).toBe(false)
    const history = [...first.page]
    let current = first
    for (let pageIndex = 0; pageIndex < entries.length && !current.isDone; pageIndex++) {
      const cursor = current.continueCursor
      current = await owner.caller.query(list, {
        ...input,
        paginationOpts: { ...input.paginationOpts, cursor }
      })
      expect(current.page.length).toBeLessThanOrEqual(1)
      if (!current.isDone) expect(current.continueCursor).not.toBe(cursor)
      history.push(...current.page)
    }
    expect(current.isDone).toBe(true)
    expect(history).toEqual(entries)
    expect(await owner.caller.query(list, { ...input, id: character.id })).toEqual(first)
    await expect(other.caller.query(list, input)).rejects.toThrow('unavailable')
    await expect(t.query(list, input)).rejects.toThrow()
    await expect(owner.caller.query(list, { ...input, id: crypto.randomUUID() })).rejects.toThrow(
      'unavailable'
    )
    for (const numItems of [0, 49])
      await expect(
        owner.caller.query(list, { ...input, paginationOpts: { cursor: null, numItems } })
      ).rejects.toThrow()
    expect(await readState()).toEqual(before)
    expect(await readReceiptStorage()).toEqual(beforeStorage)
  })

  it('returns original completed-rest results even when current sources cannot render a Sheet', async () => {
    const { t, owner, character, readState } = await readySheetFixture()
    await owner.caller.mutation(execute, {
      id: character.id,
      command: {
        type: 'ADJUST_HIT_POINTS',
        mode: 'DAMAGE',
        amount: 1,
        expectedVersion: 1,
        commandId: crypto.randomUUID()
      }
    })
    const rest: CharacterRestPreviewInput = {
      id: character.id,
      input: {
        restKind: 'LONG',
        expectedVersion: 2,
        selectedHitDice: [],
        resetMaximumHitPointModifier: false,
        healingMode: 'AUTOMATIC',
        manualHealingAccepted: false,
        selectedCompanionInstanceIds: [],
        requestRoll: false
      }
    }
    const projected = await owner.caller.query(preview, rest)
    const completed = await owner.caller.mutation(execute, {
      id: character.id,
      command: {
        type: 'COMPLETE_REST',
        commandId: crypto.randomUUID(),
        expectedVersion: 2,
        restKind: 'LONG',
        previewFingerprint: projected.previewFingerprint,
        selectedHitDice: [],
        resetMaximumHitPointModifier: false,
        healingMode: 'AUTOMATIC',
        manualHealingAccepted: false,
        selectedCompanionInstanceIds: []
      }
    })
    await t.run(async (ctx) => {
      const stored = await readCharacterRow(ctx, character.id)
      if (!stored) throw new Error('Missing Character.')
      const changed = readCharacterRecord(stored)
      changed.state.equipment.inventory[0]!.equipmentId = crypto.randomUUID()
      await writeCharacterRecord(ctx, stored, { document: changed })
    })
    await expect(owner.caller.query(getSheet, { id: character.id })).rejects.toThrow()
    const before = await readState()
    let history = await owner.caller.query(list, {
      id: character.id,
      paginationOpts: { cursor: null, numItems: 48 }
    })
    expect(history.page.length).toBeLessThanOrEqual(1)
    const entries = [...history.page]
    for (let pageIndex = 0; pageIndex < 2 && !history.isDone; pageIndex++) {
      const cursor = history.continueCursor
      history = await owner.caller.query(list, {
        id: character.id,
        paginationOpts: { cursor, numItems: 48 }
      })
      expect(history.page.length).toBeLessThanOrEqual(1)
      if (!history.isDone) expect(history.continueCursor).not.toBe(cursor)
      entries.push(...history.page)
    }
    expect(history.isDone).toBe(true)
    expect(entries).toHaveLength(2)
    expect(entries[1]).toEqual(completed.historyEntry)
    expect(entries[1]!.result).toEqual(completed.result)
    expect(await readState()).toEqual(before)
  })

  it('fails closed on receipt checksum/binding corruption and invalid stored Character identity', async () => {
    const { t, owner, character, readState } = await readySheetFixture()
    const response = await owner.caller.mutation(execute, {
      id: character.id,
      command: {
        type: 'SET_INSPIRATION',
        inspired: true,
        expectedVersion: 1,
        commandId: crypto.randomUUID()
      }
    })
    const original = (await readState()).receipts[0]!
    const input: CharacterHistoryInput = {
      id: character.id,
      paginationOpts: { cursor: null, numItems: 48 }
    }
    for (const changed of [
      { ...response.historyEntry!, eventId: crypto.randomUUID() },
      { ...response.historyEntry!, actorId: 'other-actor' },
      { ...response.historyEntry!, occurredAt: '2020-01-01T00:00:00.000Z' }
    ]) {
      await t.run((ctx) =>
        replaceReceiptRecord(ctx, 'characterCommandReceipts', original._id, {
          historyJson: canonicalizeRuleDocument(changed),
          historyChecksum: checksumRuleDocument(changed)
        })
      )
      const before = await readState()
      await expect(owner.caller.query(list, input)).rejects.toThrow('history identity mismatch')
      expect(await readState()).toEqual(before)
    }
    await t.run((ctx) =>
      replaceReceiptRecord(ctx, 'characterCommandReceipts', original._id, {
        historyJson: original.historyJson,
        historyChecksum: '0'.repeat(64)
      })
    )
    const corrupted = await readState()
    await expect(owner.caller.query(list, input)).rejects.toThrow('history checksum mismatch')
    expect(await readState()).toEqual(corrupted)
    await t.run(async (ctx) => {
      await replaceReceiptRecord(ctx, 'characterCommandReceipts', original._id, {
        historyJson: original.historyJson,
        historyChecksum: original.historyChecksum
      })
      const stored = await readCharacterRow(ctx, character.id)
      if (!stored) throw new Error('Missing Character.')
      await ctx.db.patch(stored.play._id, { userId: 'other-owner' })
    })
    await expect(owner.caller.query(list, input)).rejects.toThrow('Character identity mismatch')
  })

  it('fails closed on packed payload, pointer, and scalar header corruption without writes', async () => {
    const { t, owner, character, readState, readReceiptStorage } = await readySheetFixture()
    await owner.caller.mutation(execute, {
      id: character.id,
      command: {
        type: 'SET_INSPIRATION',
        inspired: true,
        expectedVersion: 1,
        commandId: crypto.randomUUID()
      }
    })
    const original = await readReceiptStorage()
    const header = original.headers[0]!
    const ledger = original.ledgers.find((row) => row.id === header.ledgerId)!
    const input: CharacterHistoryInput = {
      id: character.id,
      paginationOpts: { cursor: null, numItems: 48 }
    }
    for (const changed of [
      { ledgerId: crypto.randomUUID() },
      { entryIndex: 1 },
      { entryChecksum: '0'.repeat(64) },
      { commandFingerprint: '0'.repeat(64) }
    ]) {
      await t.run((ctx) => ctx.db.patch(header._id, changed))
      const before = await readReceiptStorage()
      await expect(owner.caller.query(list, input)).rejects.toThrow('Receipt')
      expect(await readReceiptStorage()).toEqual(before)
      await t.run((ctx) =>
        ctx.db.patch(header._id, {
          commandFingerprint: header.commandFingerprint,
          ledgerId: header.ledgerId,
          entryIndex: header.entryIndex,
          entryChecksum: header.entryChecksum
        })
      )
    }
    await t.run((ctx) => ctx.db.patch(ledger._id, { checksum: '0'.repeat(64) }))
    const before = await readReceiptStorage()
    await expect(owner.caller.query(list, input)).rejects.toThrow('payload checksum')
    expect(await readReceiptStorage()).toEqual(before)
    await t.run((ctx) => ctx.db.patch(ledger._id, { checksum: ledger.checksum }))
    expect(await readReceiptStorage()).toEqual(original)
    expect((await readState()).receipts).toHaveLength(1)
  })
})
