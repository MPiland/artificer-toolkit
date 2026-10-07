import { convexTest } from '../../tests/convexTest'
import { describe, expect, it, vi } from 'vitest'
import {
  receiptLedgerEntrySchema,
  receiptLedgerEntryKeyFields,
  type ReceiptLedgerEntry,
  type ReceiptLedgerEntryTable
} from '@artificer-toolkit/schema/api/liveSessionCheckpointRecords'
import {
  RECEIPT_LEDGER_MAX_BYTES,
  RECEIPT_LEDGER_MAX_ENTRIES,
  type ReceiptLedgerMetadata,
  type ReceiptLedgerPayloadMetadata
} from '@artificer-toolkit/schema/projections/receiptLedgerPersistence'
import type { JsonValue } from '@artificer-toolkit/schema/shared/jsonDelta'
import { encodeReceiptLedgerPayload } from '@artificer-toolkit/encounter-persistence/receiptLedger'
import { canonicalizeJson, checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { JSON_PAYLOAD_CHUNK_MAX_BYTES } from '@artificer-toolkit/shared/jsonPayloadChunks'
import { sha256Hex } from '@artificer-toolkit/shared/sha256'
import schema from '../schema'
import {
  createReceiptLedger,
  deleteReceiptHeaders,
  readReceiptHeader,
  readReceiptHeaders,
  readReceiptLedger,
  readReceiptLedgerMetadata,
  type ReceiptHeaderRef
} from './receiptLedgers'
import {
  createConvexEncounterStore,
  createConvexEncounterStoreReader
} from './convexEncounterStore'
import { paginateReceiptHeaders } from './receiptPagination'

const uuid = (ordinal: number) =>
  `00000000-0000-4000-8000-${ordinal.toString(16).padStart(12, '0')}`
const timestamp = '2026-09-29T00:00:00.000Z'
const campaignId = uuid(1)
const characterId = uuid(2)
const checksum = sha256Hex('fixture')

function identity(id = uuid(20)): Omit<ReceiptLedgerMetadata, keyof ReceiptLedgerPayloadMetadata> {
  return {
    id,
    scope: 'CHARACTER',
    scopeId: characterId,
    epoch: uuid(21),
    checkpointId: uuid(23),
    createdAt: timestamp
  }
}

function campaignIdentity(
  id = uuid(24)
): Omit<ReceiptLedgerMetadata, keyof ReceiptLedgerPayloadMetadata> {
  return { ...identity(id), scope: 'CAMPAIGN', scopeId: campaignId }
}

function historyEntry(
  table: ReceiptLedgerEntryTable,
  value: Record<string, JsonValue>
): ReceiptLedgerEntry {
  return receiptLedgerEntrySchema.parse({
    table,
    key: receiptLedgerEntryKeyFields[table].map((field) => value[field]),
    value,
    checksum: checksumCanonicalJson(value)
  })
}

// These are the validated logical rows from encounter-persistence's receiptLedger fixture.
function characterReceipt(ordinal = 1, history: JsonValue = { ordinal }) {
  return historyEntry('characterCommandReceipts', {
    id: uuid(100 + ordinal),
    characterId,
    commandId: uuid(200 + ordinal),
    actorId: uuid(3),
    commandFingerprint: checksum,
    occurredAt: timestamp,
    historyJson: history,
    historyChecksum: checksumCanonicalJson(history)
  })
}

function encounterEntries() {
  const replay = { roll: null, occurrence: null }
  const result = { settled: true }
  return [
    historyEntry('encounterRunCommands', {
      id: uuid(10),
      campaignId,
      encounterId: uuid(4),
      commandId: uuid(11),
      commandFingerprint: checksum,
      actorUserId: uuid(3),
      createdAt: timestamp,
      visibility: 'TABLE',
      commandType: 'UPSERT_REMINDER',
      version: 1,
      commandJson: { type: 'UPSERT_REMINDER', label: 'Ready' },
      replayReceiptJson: replay,
      replayReceiptChecksum: checksumCanonicalJson(replay)
    }),
    historyEntry('encounterRuleReceipts', {
      id: uuid(12),
      campaignId,
      encounterId: uuid(4),
      occurrenceId: uuid(5),
      commandId: uuid(13),
      commandType: 'RESOLVE_RULE_OCCURRENCE',
      commandFingerprint: checksum,
      encounterVersion: 1,
      commandMetadataJson: { label: 'Attack' },
      resultJson: result,
      resultChecksum: checksumCanonicalJson(result),
      actorUserId: uuid(3),
      correlationId: null,
      createdAt: timestamp
    }),
    historyEntry('encounterEvidenceRolls', {
      id: uuid(14),
      campaignId,
      encounterId: uuid(4),
      occurrenceId: uuid(5),
      occurrenceVersion: 1,
      requestId: 'attack',
      userId: uuid(3),
      commandId: uuid(15),
      commandFingerprint: checksum,
      attempt: 1,
      faces: [12],
      value: 12,
      rollMode: null,
      derivedRollMode: null,
      createdAt: timestamp
    })
  ]
}

function fixture() {
  return convexTest(schema)
}

async function snapshot(t: ReturnType<typeof fixture>) {
  return t.run(async (ctx) => ({
    ledgers: await ctx.db.query('receiptLedgers').take(5),
    parts: await ctx.db.query('receiptLedgerParts').take(40),
    run: await ctx.db.query('encounterRunCommands').take(10),
    rule: await ctx.db.query('encounterRuleReceipts').take(10),
    roll: await ctx.db.query('encounterEvidenceRolls').take(10),
    character: await ctx.db.query('characterCommandReceipts').take(10),
    state: await ctx.db.query('sceneVisionRevisions').take(10)
  }))
}

async function headers(t: ReturnType<typeof fixture>): Promise<ReceiptHeaderRef[]> {
  return t.run(async (ctx) => [
    ...(await ctx.db.query('encounterRunCommands').take(10)).map((header) => ({
      table: 'encounterRunCommands' as const,
      header
    })),
    ...(await ctx.db.query('encounterRuleReceipts').take(10)).map((header) => ({
      table: 'encounterRuleReceipts' as const,
      header
    })),
    ...(await ctx.db.query('encounterEvidenceRolls').take(10)).map((header) => ({
      table: 'encounterEvidenceRolls' as const,
      header
    })),
    ...(await ctx.db.query('characterCommandReceipts').take(10)).map((header) => ({
      table: 'characterCommandReceipts' as const,
      header
    }))
  ])
}

describe('native receipt ledger storage', () => {
  it.each([false, true])(
    'round-trips all families and canonical JSON with multipart=%s',
    async (large) => {
      const t = fixture()
      const history: JsonValue = large
        ? { text: '🐉é'.repeat(JSON_PAYLOAD_CHUNK_MAX_BYTES / 4) }
        : { ordinal: 1 }
      const encounter = encounterEntries()
      const character = characterReceipt(1, history)
      const before = structuredClone([...encounter, character])
      await t.run((ctx) => createReceiptLedger(ctx, campaignIdentity(), encounter))
      await t.run((ctx) => createReceiptLedger(ctx, identity(), [character]))
      const refs = await headers(t)
      await t.run(async (ctx) => {
        const shared = await readReceiptLedger(ctx, campaignIdentity().id)
        const ledger = await readReceiptLedger(ctx, identity().id)
        expect(shared.entries).toEqual(encounter)
        expect(shared.parts).toEqual([])
        expect(ledger.entries).toEqual([character])
        expect(ledger.parts.length > 1).toBe(large)
        expect(ledger.head.payload === null).toBe(large)
        expect(
          ledger.parts.every((part) => part.bytes.byteLength <= JSON_PAYLOAD_CHUNK_MAX_BYTES)
        ).toBe(true)
        for (const ref of refs) {
          const hydrated = await readReceiptHeader(ctx, ref.table, ref.header)
          const { _id, _creationTime, ...logical } = hydrated
          const entry =
            ref.table === 'characterCommandReceipts' ? character : encounter[ref.header.entryIndex]!
          const expected = Object.fromEntries(
            Object.entries(entry.value).map(([field, value]) => [
              field,
              field.endsWith('Json') && value !== null ? canonicalizeJson(value) : value
            ])
          )
          expect(logical).toEqual(expected)
          expect(_id).toBe(ref.header._id)
          expect(_creationTime).toBe(ref.header._creationTime)
        }
        const row = await ctx.db.query('characterCommandReceipts').first()
        if (!row) throw new Error('Missing fixture header.')
        expect(Object.hasOwn(row, 'historyJson')).toBe(false)
        expect((await readReceiptHeader(ctx, 'characterCommandReceipts', row)).historyJson).toBe(
          canonicalizeJson(history)
        )
      })
      expect(refs).toHaveLength(before.length)
      expect([...encounter, character]).toEqual(before)
    }
  )

  it('refuses a valid checksum pointer into another family or command identity', async () => {
    const t = fixture()
    const entries = [characterReceipt(1), characterReceipt(2)]
    const otherFamily = encounterEntries()[2]!
    await t.run((ctx) => createReceiptLedger(ctx, identity(), entries))
    await t.run((ctx) => createReceiptLedger(ctx, campaignIdentity(), [otherFamily]))
    for (const target of [
      { ledgerId: identity().id, entryIndex: 1, entryChecksum: entries[1]!.checksum },
      { ledgerId: campaignIdentity().id, entryIndex: 0, entryChecksum: otherFamily.checksum }
    ]) {
      await t.run(async (ctx) => {
        const row = await ctx.db
          .query('characterCommandReceipts')
          .withIndex('by_characterId_commandId', (q) =>
            q.eq('characterId', characterId).eq('commandId', uuid(201))
          )
          .unique()
        if (!row) throw new Error('Missing fixture header.')
        await ctx.db.patch(row._id, target)
      })
      await expect(
        t.run(async (ctx) => {
          const row = await ctx.db
            .query('characterCommandReceipts')
            .withIndex('by_characterId_commandId', (q) =>
              q.eq('characterId', characterId).eq('commandId', uuid(201))
            )
            .unique()
          if (!row) throw new Error('Missing fixture header.')
          await readReceiptHeader(ctx, 'characterCommandReceipts', row)
        })
      ).rejects.toThrow(/identity/)
    }
  })

  it('hydrates a page in input order with one head and one parts query per distinct ledger', async () => {
    const t = fixture()
    await t.run((ctx) =>
      createReceiptLedger(ctx, identity(), [characterReceipt(1), characterReceipt(2)])
    )
    await t.run((ctx) => createReceiptLedger(ctx, identity(uuid(22)), [characterReceipt(3)]))
    await t.run(async (ctx) => {
      const rows = await ctx.db.query('characterCommandReceipts').take(4)
      const page = [rows[2]!, rows[0]!, rows[1]!, rows[0]!]
      const query = vi.spyOn(ctx.db, 'query')
      try {
        const hydrated = await readReceiptHeaders(ctx, 'characterCommandReceipts', page)
        expect(hydrated.map((row) => row._id)).toEqual(page.map((row) => row._id))
        expect(query.mock.calls.map(([table]) => table)).toEqual([
          'receiptLedgers',
          'receiptLedgerParts',
          'receiptLedgers',
          'receiptLedgerParts'
        ])
      } finally {
        query.mockRestore()
      }
    })
  })

  // The next three tests (through 'forwards empty native pages') stub only the platform's
  // `paginate`: convex-test cannot produce Convex's opaque cursors, `pageStatus` split signals,
  // multi-row windows under a one-row read cap or empty-but-advanced pages. Everything the
  // ledger code does with the returned page runs for real against stored ledgers.
  it('paginates once, forwards native metadata and hydrates every returned header in order', async () => {
    const t = fixture()
    await t.run((ctx) =>
      createReceiptLedger(ctx, identity(), [characterReceipt(1), characterReceipt(2)])
    )
    await t.run((ctx) => createReceiptLedger(ctx, identity(uuid(22)), [characterReceipt(3)]))
    await t.run(async (ctx) => {
      const headers = await ctx.db.query('characterCommandReceipts').order('asc').take(3)
      const native = ctx.db.query('characterCommandReceipts').order('asc')
      const page = {
        page: [headers[1]!, headers[0]!],
        isDone: false,
        continueCursor: 'opaque native continuation',
        splitCursor: 'opaque native split',
        pageStatus: 'SplitRequired' as const
      }
      const paginate = vi.spyOn(native, 'paginate').mockResolvedValue(page)
      const query = vi.spyOn(ctx.db, 'query')
      const options = {
        numItems: 48,
        cursor: 'opaque native start',
        endCursor: 'opaque native end',
        maximumRowsRead: 100,
        maximumBytesRead: 12_345
      }
      try {
        const result = await paginateReceiptHeaders(
          ctx,
          'characterCommandReceipts',
          native,
          options
        )
        expect(paginate).toHaveBeenCalledTimes(1)
        expect(paginate).toHaveBeenCalledWith({ ...options, numItems: 1, maximumRowsRead: 1 })
        const { page: hydrated, ...metadata } = result
        const { page: _headers, ...nativeMetadata } = page
        expect(metadata).toEqual(nativeMetadata)
        expect(hydrated.map((row) => row._id)).toEqual(page.page.map((header) => header._id))
        expect(hydrated.map((row) => row.commandId)).toEqual([uuid(202), uuid(201)])
        // Both returned rows share one ledger. The unreturned third row's ledger stays unread.
        expect(query.mock.calls.filter(([table]) => table === 'receiptLedgers')).toHaveLength(1)
        expect(query.mock.calls.filter(([table]) => table === 'receiptLedgerParts')).toHaveLength(1)
      } finally {
        paginate.mockRestore()
        query.mockRestore()
      }
    })
  })

  it('rejects a native window spanning two oversized ledgers before reading either body', async () => {
    const t = fixture()
    for (const ordinal of [1, 2])
      await t.run((ctx) =>
        createReceiptLedger(ctx, identity(uuid(30 + ordinal)), [
          characterReceipt(ordinal, { text: 'x'.repeat(RECEIPT_LEDGER_MAX_BYTES / 2) })
        ])
      )
    await t.run(async (ctx) => {
      const rows = await ctx.db.query('characterCommandReceipts').order('asc').take(2)
      const native = ctx.db.query('characterCommandReceipts').order('asc')
      const paginate = vi.spyOn(native, 'paginate').mockResolvedValue({
        page: rows,
        isDone: true,
        continueCursor: 'complete',
        splitCursor: null,
        pageStatus: 'SplitRecommended' as const
      })
      const query = vi.spyOn(ctx.db, 'query')
      try {
        await expect(
          paginateReceiptHeaders(ctx, 'characterCommandReceipts', native, {
            numItems: 48,
            cursor: null
          })
        ).rejects.toThrow(/payload read limit/)
        expect(paginate).toHaveBeenCalledWith({ numItems: 1, cursor: null, maximumRowsRead: 1 })
        expect(query.mock.calls.filter(([table]) => table === 'receiptLedgers')).toHaveLength(2)
        expect(query.mock.calls.filter(([table]) => table === 'receiptLedgerParts')).toHaveLength(0)
      } finally {
        paginate.mockRestore()
        query.mockRestore()
      }
    })
  }, 60_000)

  it('forwards empty native pages without loading bodies', async () => {
    const t = fixture()
    await t.run(async (ctx) => {
      const native = ctx.db.query('characterCommandReceipts').order('asc')
      const page = {
        page: [],
        isDone: false,
        continueCursor: 'opaque advanced empty cursor',
        splitCursor: null,
        pageStatus: 'SplitRecommended' as const
      }
      const paginate = vi.spyOn(native, 'paginate').mockResolvedValue(page)
      const query = vi.spyOn(ctx.db, 'query')
      const options = { numItems: 10, cursor: null, maximumRowsRead: 1, maximumBytesRead: 1_024 }
      try {
        expect(
          await paginateReceiptHeaders(ctx, 'characterCommandReceipts', native, options)
        ).toEqual(page)
        expect(paginate).toHaveBeenCalledTimes(1)
        expect(paginate).toHaveBeenCalledWith({ ...options, numItems: 1 })
        expect(query).not.toHaveBeenCalled()
      } finally {
        paginate.mockRestore()
        query.mockRestore()
      }
    })
  })

  it('rejects a zero scan cap before it can disable the native page bound', async () => {
    const t = fixture()
    await t.run(async (ctx) => {
      const native = ctx.db.query('characterCommandReceipts').order('asc')
      const paginate = vi.spyOn(native, 'paginate')
      const query = vi.spyOn(ctx.db, 'query')
      try {
        await expect(
          paginateReceiptHeaders(ctx, 'characterCommandReceipts', native, {
            numItems: 48,
            cursor: null,
            maximumRowsRead: 0
          })
        ).rejects.toThrow(/scan limit/)
        expect(paginate).not.toHaveBeenCalled()
        expect(query).not.toHaveBeenCalled()
      } finally {
        paginate.mockRestore()
        query.mockRestore()
      }
    })
  })

  it('continues complete native short pages across distinct maximal ledgers', async () => {
    const t = fixture()
    for (let ordinal = 1; ordinal <= 3; ordinal++) {
      const overhead = encodeReceiptLedgerPayload([
        characterReceipt(ordinal, { text: '' })
      ]).byteLength
      const entry = characterReceipt(ordinal, {
        text: 'x'.repeat(RECEIPT_LEDGER_MAX_BYTES - overhead)
      })
      const ledgerId = uuid(30 + ordinal)
      await t.run(async (ctx) => {
        await createReceiptLedger(ctx, identity(ledgerId), [entry])
        expect((await readReceiptLedgerMetadata(ctx, ledgerId)).byteLength).toBe(
          RECEIPT_LEDGER_MAX_BYTES
        )
      })
    }
    const commands: string[] = []
    let cursor: string | null = null
    let done = false
    let pages = 0
    while (!done) {
      if (++pages > 4) throw new Error('Native receipt pagination failed to finish.')
      const result = await t.run(async (ctx) => {
        const native = ctx.db
          .query('characterCommandReceipts')
          .withIndex('by_characterId_commandId', (q) => q.eq('characterId', characterId))
          .order('asc')
        const paginate = vi.spyOn(native, 'paginate')
        const query = vi.spyOn(ctx.db, 'query')
        try {
          const result = await paginateReceiptHeaders(ctx, 'characterCommandReceipts', native, {
            numItems: 48,
            cursor
          })
          expect(paginate).toHaveBeenCalledTimes(1)
          expect(paginate).toHaveBeenCalledWith({ numItems: 1, cursor, maximumRowsRead: 1 })
          expect(result.page.length).toBeLessThanOrEqual(1)
          expect(query.mock.calls.filter(([table]) => table === 'receiptLedgers')).toHaveLength(
            result.page.length
          )
          expect(query.mock.calls.filter(([table]) => table === 'receiptLedgerParts')).toHaveLength(
            result.page.length
          )
          for (const row of result.page)
            expect(row.historyJson.length).toBeGreaterThan(RECEIPT_LEDGER_MAX_BYTES - 2_000)
          return {
            commands: result.page.map((row) => row.commandId),
            continueCursor: result.continueCursor,
            isDone: result.isDone
          }
        } finally {
          paginate.mockRestore()
          query.mockRestore()
        }
      })
      commands.push(...result.commands)
      if (!result.isDone) expect(result.continueCursor).not.toBe(cursor)
      cursor = result.continueCursor
      done = result.isDone
    }
    expect(commands).toEqual([uuid(201), uuid(202), uuid(203)])
  }, 60_000)

  it.each([false, true])(
    'peeks metadata without parts and reuses the head for body reads, multipart=%s',
    async (large) => {
      const t = fixture()
      const entry = characterReceipt(1, large ? { text: '🐉'.repeat(100_000) } : { ordinal: 1 })
      await t.run((ctx) => createReceiptLedger(ctx, identity(), [entry]))
      await t.run(async (ctx) => {
        const query = vi.spyOn(ctx.db, 'query')
        try {
          const [first, second] = await Promise.all([
            readReceiptLedgerMetadata(ctx, identity().id),
            readReceiptLedgerMetadata(ctx, identity().id)
          ])
          expect(second).toEqual(first)
          expect(first.partCount > 1).toBe(large)
          expect(query.mock.calls.filter(([table]) => table === 'receiptLedgers')).toHaveLength(1)
          expect(query.mock.calls.filter(([table]) => table === 'receiptLedgerParts')).toHaveLength(
            0
          )
          const ledger = await readReceiptLedger(ctx, identity().id)
          expect(ledger.metadata).toEqual(first)
          expect(ledger.entries).toEqual([entry])
          expect(query.mock.calls.filter(([table]) => table === 'receiptLedgers')).toHaveLength(1)
          expect(query.mock.calls.filter(([table]) => table === 'receiptLedgerParts')).toHaveLength(
            1
          )
        } finally {
          query.mockRestore()
        }
      })
    }
  )

  it('shares direct native header reads and reloads surviving slots after native cleanup', async () => {
    const t = fixture()
    await t.run((ctx) =>
      createReceiptLedger(ctx, identity(), [
        characterReceipt(1, { text: '🐉'.repeat(100_000) }),
        characterReceipt(2)
      ])
    )
    await t.run(async (ctx) => {
      const [removed, surviving] = await ctx.db
        .query('characterCommandReceipts')
        .order('asc')
        .take(2)
      const nativeHead = await ctx.db.query('receiptLedgers').first()
      if (!removed || !surviving || !nativeHead) throw new Error('Missing fixture storage.')
      expect(nativeHead.partCount).toBeGreaterThan(1)
      const query = vi.spyOn(ctx.db, 'query')
      try {
        // Independent callers share the same pending native load, without an adapter.
        const [removedBody, survivingBody] = await Promise.all([
          readReceiptHeader(ctx, 'characterCommandReceipts', removed),
          readReceiptHeader(ctx, 'characterCommandReceipts', surviving)
        ])
        expect(removedBody.commandId).toBe(uuid(201))
        expect(survivingBody.commandId).toBe(uuid(202))
        expect(await createConvexEncounterStoreReader(ctx).get(surviving._id)).toEqual(
          survivingBody
        )
        expect(query.mock.calls.filter(([table]) => table === 'receiptLedgers')).toHaveLength(1)
        expect(query.mock.calls.filter(([table]) => table === 'receiptLedgerParts')).toHaveLength(1)

        await deleteReceiptHeaders(ctx, [{ table: 'characterCommandReceipts', header: removed }])
        const rewritten = await ctx.db.get(nativeHead._id)
        expect(rewritten?.partCount).toBe(0)
        expect(rewritten?.checksum).not.toBe(nativeHead.checksum)
        query.mockClear()

        const metadata = await readReceiptLedgerMetadata(ctx, identity().id)
        expect(metadata.checksum).toBe(rewritten?.checksum)
        expect(metadata.partCount).toBe(0)
        expect(await readReceiptHeader(ctx, 'characterCommandReceipts', surviving)).toEqual(
          survivingBody
        )
        const ledger = await readReceiptLedger(ctx, identity().id)
        expect(ledger.entries[0]).toBeNull()
        expect(ledger.entries[1]).toEqual(characterReceipt(2))
        expect(ledger.parts).toEqual([])
        expect(query.mock.calls.filter(([table]) => table === 'receiptLedgers')).toHaveLength(1)
        expect(query.mock.calls.filter(([table]) => table === 'receiptLedgerParts')).toHaveLength(1)
      } finally {
        query.mockRestore()
      }
    })
  })

  it('shares one ledger load across separate indexed queries, terminals and native-ID gets', async () => {
    const t = fixture()
    await t.run((ctx) => createReceiptLedger(ctx, campaignIdentity(), encounterEntries()))
    await t.run((ctx) =>
      createReceiptLedger(ctx, identity(), [characterReceipt(1), characterReceipt(2)])
    )
    await t.run(async (ctx) => {
      const store = createConvexEncounterStoreReader(ctx)
      const query = vi.spyOn(ctx.db, 'query')
      try {
        // Concurrent first loads share the Campaign ledger across its receipt families.
        const [run, rule] = await Promise.all([
          store
            .query('encounterRunCommands')
            .withIndex('by_campaignId_commandId', (q) => q.eq('campaignId', campaignId))
            .first(),
          store
            .query('encounterRuleReceipts')
            .withIndex('by_campaignId_commandId', (q) => q.eq('campaignId', campaignId))
            .unique()
        ])
        expect(run?.commandId).toBe(uuid(11))
        expect(rule?.commandId).toBe(uuid(13))
        const page = await store
          .query('characterCommandReceipts')
          .withIndex('by_characterId_commandId', (q) => q.eq('characterId', characterId))
          .order('asc')
          .take(2)
        expect(page.map((row) => row.commandId)).toEqual([uuid(201), uuid(202)])
        expect(await store.get(page[0]!._id)).toEqual(page[0])
        expect(
          await store
            .query('characterCommandReceipts')
            .withIndex('by_characterId_commandId', (q) => q.eq('characterId', characterId))
            .collect()
        ).toEqual(page)
        expect((await store.query('encounterEvidenceRolls').first())?.id).toBe(uuid(14))
        expect(query.mock.calls.filter(([table]) => table === 'receiptLedgers')).toHaveLength(2)
        expect(query.mock.calls.filter(([table]) => table === 'receiptLedgerParts')).toHaveLength(2)
      } finally {
        query.mockRestore()
      }
    })
  })

  it('loads one ledger while iterating its rows and cancels before loading the next ledger', async () => {
    const t = fixture()
    await t.run((ctx) =>
      createReceiptLedger(ctx, identity(), [characterReceipt(1), characterReceipt(2)])
    )
    await t.run((ctx) => createReceiptLedger(ctx, identity(uuid(22)), [characterReceipt(3)]))
    await t.run(async (ctx) => {
      const store = createConvexEncounterStoreReader(ctx)
      const query = vi.spyOn(ctx.db, 'query')
      try {
        const iterator = store
          .query('characterCommandReceipts')
          .order('asc')
          [Symbol.asyncIterator]()
        expect(query.mock.calls.filter(([table]) => table === 'receiptLedgers')).toHaveLength(0)
        const first = await iterator.next()
        const second = await iterator.next()
        if (first.done || second.done)
          throw new Error('Fixture iterator ended before two receipts.')
        expect(first.value.commandId).toBe(uuid(201))
        expect(second.value.commandId).toBe(uuid(202))
        await iterator.return?.()
        expect(query.mock.calls.filter(([table]) => table === 'receiptLedgers')).toHaveLength(1)
        expect(query.mock.calls.filter(([table]) => table === 'receiptLedgerParts')).toHaveLength(1)
      } finally {
        query.mockRestore()
      }
    })
  })

  it('reloads rewritten storage after deleting a receipt through the mutation adapter', async () => {
    const t = fixture()
    await t.run((ctx) =>
      createReceiptLedger(ctx, identity(), [
        characterReceipt(1, { text: '🐉'.repeat(100_000) }),
        characterReceipt(2)
      ])
    )
    await t.run(async (ctx) => {
      const store = createConvexEncounterStore(ctx)
      const before = await store.query('characterCommandReceipts').order('asc').take(2)
      const nativeHead = await ctx.db.query('receiptLedgers').first()
      if (!nativeHead) throw new Error('Missing fixture ledger.')
      expect(nativeHead.partCount).toBeGreaterThan(1)
      await store.delete(before[0]!._id)
      const rewritten = await ctx.db.get(nativeHead._id)
      expect(rewritten?.partCount).toBe(0)
      expect(rewritten?.checksum).not.toBe(nativeHead.checksum)
      const query = vi.spyOn(ctx.db, 'query')
      try {
        expect(await store.get(before[1]!._id)).toEqual(before[1])
        expect(
          await store
            .query('characterCommandReceipts')
            .withIndex('by_characterId_commandId', (q) => q.eq('characterId', characterId))
            .first()
        ).toEqual(before[1])
        expect(await store.get(before[0]!._id)).toBeNull()
        expect(query.mock.calls.filter(([table]) => table === 'receiptLedgers')).toHaveLength(1)
        expect(query.mock.calls.filter(([table]) => table === 'receiptLedgerParts')).toHaveLength(1)
      } finally {
        query.mockRestore()
      }
    })
  })

  it('invalidates transaction ledger promises after receipt insertion', async () => {
    const t = fixture()
    await t.run((ctx) => createReceiptLedger(ctx, identity(), [characterReceipt(1)]))
    await t.run(async (ctx) => {
      const store = createConvexEncounterStore(ctx)
      const existing = await store.query('characterCommandReceipts').first()
      if (!existing) throw new Error('Missing fixture receipt.')
      const { _id, _creationTime, ...logical } = existing
      const insertedId = await store.insert('characterCommandReceipts', {
        ...logical,
        id: uuid(102),
        commandId: uuid(202)
      })
      const query = vi.spyOn(ctx.db, 'query')
      try {
        expect(await store.get(_id)).toEqual(existing)
        expect(query.mock.calls.filter(([table]) => table === 'receiptLedgers')).toHaveLength(1)
        expect(query.mock.calls.filter(([table]) => table === 'receiptLedgerParts')).toHaveLength(1)
        expect((await store.get(insertedId))?.commandId).toBe(uuid(202))
        expect(query.mock.calls.filter(([table]) => table === 'receiptLedgers')).toHaveLength(2)
        expect(query.mock.calls.filter(([table]) => table === 'receiptLedgerParts')).toHaveLength(2)
      } finally {
        query.mockRestore()
      }
    })
  })

  it.each(['actorId', 'commandFingerprint', 'entryChecksum', 'entryIndex', 'occurredAt'] as const)(
    'refuses tampered header %s',
    async (field) => {
      const t = fixture()
      await t.run((ctx) => createReceiptLedger(ctx, identity(), [characterReceipt()]))
      await t.run(async (ctx) => {
        const row = await ctx.db.query('characterCommandReceipts').first()
        if (!row) throw new Error('Missing fixture header.')
        switch (field) {
          case 'actorId':
            await ctx.db.patch(row._id, { actorId: uuid(99) })
            break
          case 'commandFingerprint':
            await ctx.db.patch(row._id, { commandFingerprint: sha256Hex('other') })
            break
          case 'entryChecksum':
            await ctx.db.patch(row._id, { entryChecksum: sha256Hex('other') })
            break
          case 'entryIndex':
            await ctx.db.patch(row._id, { entryIndex: 1 })
            break
          case 'occurredAt':
            await ctx.db.patch(row._id, { occurredAt: '2026-09-28T00:00:00.000Z' })
            break
        }
      })
      await expect(
        t.run(async (ctx) => {
          const row = await ctx.db.query('characterCommandReceipts').first()
          if (!row) throw new Error('Missing fixture header.')
          await readReceiptHeader(ctx, 'characterCommandReceipts', row)
        })
      ).rejects.toThrow()
    }
  )

  it.each(['missing', 'extra', 'duplicate', 'wrong index', 'reordered bytes'] as const)(
    'refuses %s multipart storage',
    async (corruption) => {
      const t = fixture()
      await t.run((ctx) =>
        createReceiptLedger(ctx, identity(), [
          characterReceipt(1, { text: '🐉é'.repeat(JSON_PAYLOAD_CHUNK_MAX_BYTES / 4) })
        ])
      )
      await t.run(async (ctx) => {
        const parts = await ctx.db
          .query('receiptLedgerParts')
          .withIndex('by_ledgerId_index', (q) => q.eq('ledgerId', identity().id))
          .take(20)
        const first = parts[0]!
        if (corruption === 'missing') await ctx.db.delete(first._id)
        else if (corruption === 'extra' || corruption === 'duplicate')
          await ctx.db.insert('receiptLedgerParts', {
            ledgerId: first.ledgerId,
            index: corruption === 'extra' ? parts.length : first.index,
            bytes: first.bytes
          })
        else if (corruption === 'wrong index') await ctx.db.patch(first._id, { index: 99 })
        else {
          const second = parts[1]!
          await ctx.db.patch(first._id, { bytes: second.bytes })
          await ctx.db.patch(second._id, { bytes: first.bytes })
        }
      })
      await expect(t.run((ctx) => readReceiptLedger(ctx, identity().id))).rejects.toThrow()
    }
  )

  it('rejects corrupt advertised limits before issuing a parts query', async () => {
    const t = fixture()
    await t.run((ctx) => createReceiptLedger(ctx, identity(), [characterReceipt()]))
    await t.run(async (ctx) => {
      const head = await ctx.db.query('receiptLedgers').first()
      if (!head) throw new Error('Missing fixture ledger.')
      await ctx.db.patch(head._id, {
        byteLength: RECEIPT_LEDGER_MAX_BYTES + 1,
        entryCount: RECEIPT_LEDGER_MAX_ENTRIES + 1,
        partCount: Number.MAX_SAFE_INTEGER
      })
    })
    await t.run(async (ctx) => {
      const query = vi.spyOn(ctx.db, 'query')
      try {
        await expect(readReceiptLedger(ctx, identity().id)).rejects.toThrow()
        expect(query.mock.calls.map(([table]) => table)).toEqual(['receiptLedgers'])
      } finally {
        query.mockRestore()
      }
    })
  })

  it('rolls back caller state, head and parts when an existing command identity collides', async () => {
    const t = fixture()
    await t.run((ctx) => createReceiptLedger(ctx, identity(), [characterReceipt()]))
    const before = await snapshot(t)
    await expect(
      t.run(async (ctx) => {
        await ctx.db.insert('sceneVisionRevisions', {
          scope: 'CHARACTER',
          id: characterId,
          revision: 'must rollback'
        })
        await createReceiptLedger(ctx, identity(uuid(22)), [characterReceipt()])
      })
    ).rejects.toThrow(/identity/)
    expect(await snapshot(t)).toEqual(before)
  })

  it('refuses two Evidence rows sharing a command identity and rolls back preceding headers', async () => {
    const t = fixture()
    const first = encounterEntries()[2]!
    const second = historyEntry('encounterEvidenceRolls', { ...first.value, id: uuid(999) })
    const before = await snapshot(t)
    await expect(
      t.run((ctx) => createReceiptLedger(ctx, campaignIdentity(), [first, second]))
    ).rejects.toThrow(/identity/)
    expect(await snapshot(t)).toEqual(before)
  })

  it('rejects wrong scope before writes and rejects reused ledger IDs', async () => {
    const t = fixture()
    await expect(
      t.run((ctx) => createReceiptLedger(ctx, identity(), encounterEntries()))
    ).rejects.toThrow(/scope/)
    expect((await snapshot(t)).ledgers).toEqual([])
    await t.run((ctx) => createReceiptLedger(ctx, identity(), [characterReceipt()]))
    const before = await snapshot(t)
    await expect(
      t.run((ctx) => createReceiptLedger(ctx, identity(), [characterReceipt(2)]))
    ).rejects.toThrow(/identity/)
    expect(await snapshot(t)).toEqual(before)
  })

  it('rejects mixed ownership atomically and accepts distinct ledgers at one checkpoint', async () => {
    const t = fixture()
    const before = await snapshot(t)
    await expect(
      t.run(async (ctx) => {
        await ctx.db.insert('sceneVisionRevisions', {
          scope: 'CHARACTER',
          id: characterId,
          revision: 'must rollback'
        })
        await createReceiptLedger(ctx, campaignIdentity(), [
          encounterEntries()[0]!,
          characterReceipt()
        ])
      })
    ).rejects.toThrow(/scope/)
    expect(await snapshot(t)).toEqual(before)
    await t.run((ctx) => createReceiptLedger(ctx, campaignIdentity(), encounterEntries()))
    await t.run((ctx) => createReceiptLedger(ctx, identity(), [characterReceipt()]))
    const ledgers = (await snapshot(t)).ledgers
    expect(ledgers).toHaveLength(2)
    expect(ledgers.map((ledger) => ledger.id)).toEqual([campaignIdentity().id, identity().id])
    expect(ledgers.map((ledger) => [ledger.epoch, ledger.checkpointId])).toEqual([
      [uuid(21), uuid(23)],
      [uuid(21), uuid(23)]
    ])
  })

  it('tombstones selected shared receipts while retaining separate private Character history', async () => {
    const t = fixture()
    const encounter = encounterEntries()
    const character = characterReceipt(1, { text: '🐉'.repeat(100_000) })
    await t.run((ctx) => createReceiptLedger(ctx, campaignIdentity(), encounter))
    await t.run((ctx) => createReceiptLedger(ctx, identity(), [character]))
    const refs = await headers(t)
    const selected = refs.filter((ref) => ref.table === 'encounterRunCommands')
    await t.run((ctx) => deleteReceiptHeaders(ctx, selected))
    const surviving = await headers(t)
    expect(surviving).toHaveLength(3)
    await t.run(async (ctx) => {
      const shared = await readReceiptLedger(ctx, campaignIdentity().id)
      expect(shared.entries).toEqual([null, encounter[1], encounter[2]])
      for (const ref of surviving.filter((ref) => ref.table !== 'characterCommandReceipts')) {
        expect(ref.header.entryIndex).toBeGreaterThan(0)
        expect(await readReceiptHeader(ctx, ref.table, ref.header)).toMatchObject({
          _id: ref.header._id
        })
      }
      const privateLedger = await readReceiptLedger(ctx, identity().id)
      expect(privateLedger.entries).toEqual([character])
      expect(privateLedger.parts.length).toBeGreaterThan(1)
    })
    await t.run((ctx) =>
      deleteReceiptHeaders(
        ctx,
        surviving.filter((ref) => ref.table !== 'characterCommandReceipts')
      )
    )
    const privateRefs = await headers(t)
    expect(privateRefs).toHaveLength(1)
    expect(privateRefs[0]?.table).toBe('characterCommandReceipts')
    expect((await snapshot(t)).ledgers).toHaveLength(1)
    await t.run((ctx) => deleteReceiptHeaders(ctx, privateRefs))
    const after = await snapshot(t)
    expect(after.ledgers).toEqual([])
    expect(after.parts).toEqual([])
    expect(await headers(t)).toEqual([])
  })

  it('rolls back cleanup of an earlier ledger when another ledger has a corrupt surviving pointer', async () => {
    const t = fixture()
    await t.run((ctx) => createReceiptLedger(ctx, identity(), [characterReceipt(1)]))
    await t.run((ctx) =>
      createReceiptLedger(ctx, identity(uuid(22)), [characterReceipt(2), characterReceipt(3)])
    )
    await t.run(async (ctx) => {
      const row = await ctx.db
        .query('characterCommandReceipts')
        .withIndex('by_characterId_commandId', (q) =>
          q.eq('characterId', characterId).eq('commandId', uuid(203))
        )
        .unique()
      if (!row) throw new Error('Missing fixture header.')
      await ctx.db.patch(row._id, { entryChecksum: sha256Hex('injected corruption') })
    })
    const selected = (await headers(t)).filter((ref) => ref.header.entryIndex === 0)
    const before = await snapshot(t)
    await expect(
      t.run(async (ctx) => {
        await ctx.db.insert('sceneVisionRevisions', {
          scope: 'CHARACTER',
          id: characterId,
          revision: 'must rollback'
        })
        await deleteReceiptHeaders(ctx, selected)
      })
    ).rejects.toThrow()
    expect(await snapshot(t)).toEqual(before)
  })

  it('refuses a missing live header and a duplicate slot before cleanup can orphan storage', async () => {
    for (const corruption of ['missing', 'duplicate'] as const) {
      const t = fixture()
      await t.run((ctx) =>
        createReceiptLedger(ctx, identity(), [characterReceipt(1), characterReceipt(2)])
      )
      await t.run(async (ctx) => {
        const row = await ctx.db
          .query('characterCommandReceipts')
          .withIndex('by_characterId_commandId', (q) =>
            q.eq('characterId', characterId).eq('commandId', uuid(202))
          )
          .unique()
        if (!row) throw new Error('Missing fixture header.')
        if (corruption === 'missing') await ctx.db.delete(row._id)
        else {
          const { _id, _creationTime, ...fields } = row
          await ctx.db.insert('characterCommandReceipts', fields)
        }
      })
      const selected = (await headers(t)).filter((ref) => ref.header.entryIndex === 0)
      const before = await snapshot(t)
      await expect(t.run((ctx) => deleteReceiptHeaders(ctx, selected))).rejects.toThrow()
      expect(await snapshot(t)).toEqual(before)
    }
  })
})
