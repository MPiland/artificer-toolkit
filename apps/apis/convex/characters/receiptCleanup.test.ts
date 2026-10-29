import { convexTest } from '../../tests/convexTest'
import { makeFunctionReference } from 'convex/server'
import { describe, expect, it } from 'vitest'
import {
  receiptLedgerEntrySchema,
  receiptLedgerEntryKeyFields,
  type ReceiptLedgerEntryTable
} from '@artificer-toolkit/schema/api/liveSessionCheckpointRecords'
import type { CharacterReceiptPurgeInput } from '@artificer-toolkit/schema/projections/receiptLedgerPersistence'
import type { JsonValue } from '@artificer-toolkit/schema/shared/jsonDelta'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { sha256Hex } from '@artificer-toolkit/shared/sha256'
import schema from '../schema'
import { createReceiptLedger } from '../lib/receiptLedgers'
import { retireCharacterReceipts } from './receiptCleanup'

const uuid = (ordinal: number) =>
  `00000000-0000-4000-8000-${ordinal.toString(16).padStart(12, '0')}`
const characterId = uuid(1)
const ownerUserId = uuid(2)
const timestamp = '2026-09-29T00:00:00.000Z'
const checksum = sha256Hex('fixture')
const purge = makeFunctionReference<'mutation', CharacterReceiptPurgeInput, null>(
  'characters/receiptCleanup:purge'
)

function fixture() {
  return convexTest(schema, import.meta.glob('/apps/apis/convex/**/*.*s'))
}

function entry(table: ReceiptLedgerEntryTable, value: Record<string, JsonValue>) {
  return receiptLedgerEntrySchema.parse({
    table,
    key: receiptLedgerEntryKeyFields[table].map((field) => value[field]),
    value,
    checksum: checksumCanonicalJson(value)
  })
}

function characterReceipt(id = characterId, ordinal = 1) {
  const history = { ordinal }
  return entry('characterCommandReceipts', {
    id: uuid(100 + ordinal),
    characterId: id,
    commandId: uuid(200 + ordinal),
    actorId: ownerUserId,
    commandFingerprint: checksum,
    occurredAt: timestamp,
    historyJson: history,
    historyChecksum: checksumCanonicalJson(history)
  })
}

function identity(
  id = uuid(10),
  scopeId = characterId,
  scope: 'CHARACTER' | 'CAMPAIGN' = 'CHARACTER'
) {
  return { id, scope, scopeId, epoch: uuid(20), checkpointId: uuid(21), createdAt: timestamp }
}

async function snapshot(t: ReturnType<typeof fixture>) {
  return t.run(async (ctx) => ({
    ledgers: await ctx.db.query('receiptLedgers').take(10),
    parts: await ctx.db.query('receiptLedgerParts').take(30),
    headers: await ctx.db.query('characterCommandReceipts').take(10),
    runHeaders: await ctx.db.query('encounterRunCommands').take(10),
    ruleHeaders: await ctx.db.query('encounterRuleReceipts').take(10),
    jobs: await ctx.db.query('characterReceiptPurgeJobs').take(10),
    schedules: await ctx.db.system.query('_scheduled_functions').collect()
  }))
}

async function retire(t: ReturnType<typeof fixture>) {
  return t.run(async (ctx) => {
    const headers = await ctx.db
      .query('characterCommandReceipts')
      .withIndex('by_characterId_commandId', (q) => q.eq('characterId', characterId))
      .take(10)
    await retireCharacterReceipts(ctx, characterId, ownerUserId, headers)
  })
}

describe('private Character receipt retirement', () => {
  it('rolls back header deletion, durable intent and scheduling on a late failure', async () => {
    const t = fixture()
    await t.run((ctx) => createReceiptLedger(ctx, identity(), [characterReceipt()]))
    const before = await snapshot(t)
    await expect(
      t.run(async (ctx) => {
        const headers = await ctx.db.query('characterCommandReceipts').take(10)
        await retireCharacterReceipts(ctx, characterId, ownerUserId, headers)
        throw new Error('Abort retirement.')
      })
    ).rejects.toThrow('Abort retirement.')
    expect(await snapshot(t)).toEqual(before)
  })

  it.each(['MALFORMED', 'NONCANONICAL', 'FOREIGN'] as const)(
    'rejects invalid scalar header metadata before deleting anything: %s',
    async (kind) => {
      const t = fixture()
      await t.run((ctx) => createReceiptLedger(ctx, identity(), [characterReceipt()]))
      await t.run(async (ctx) => {
        const header = await ctx.db.query('characterCommandReceipts').first()
        if (!header) throw new Error('Missing header.')
        await ctx.db.patch(
          header._id,
          kind === 'FOREIGN'
            ? { characterId: uuid(3) }
            : {
                actorId:
                  kind === 'MALFORMED' ? 'invalid-uuid' : 'ABCDEFAB-0000-4000-8000-000000000002'
              }
        )
      })
      const before = await snapshot(t)
      await expect(
        t.run(async (ctx) => {
          const headers = await ctx.db.query('characterCommandReceipts').take(10)
          await retireCharacterReceipts(ctx, characterId, ownerUserId, headers)
        })
      ).rejects.toThrow()
      expect(await snapshot(t)).toEqual(before)
    }
  )

  it('retires private headers without decoding corrupt discarded payloads', async () => {
    const t = fixture()
    await t.run((ctx) => createReceiptLedger(ctx, identity(), [characterReceipt()]))
    await t.run(async (ctx) => {
      const head = await ctx.db.query('receiptLedgers').first()
      if (!head) throw new Error('Missing ledger.')
      await ctx.db.patch(head._id, { payload: new Uint8Array([255]).buffer })
    })
    const before = await snapshot(t)
    await retire(t)
    const after = await snapshot(t)
    expect(after.headers).toEqual([])
    expect(after.ledgers).toEqual(before.ledgers)
    expect(after.jobs).toEqual([expect.objectContaining({ characterId, ownerUserId })])
    expect(after.schedules).toHaveLength(1)
    expect(after.schedules[0]).toMatchObject({
      name: 'characters/receiptCleanup:purge',
      args: [{ characterId }]
    })
    await t.mutation(purge, { characterId })
    expect((await snapshot(t)).ledgers).toEqual([])
    await t.mutation(purge, { characterId })
    expect((await snapshot(t)).jobs).toEqual([])
  })

  it('purges at most four parts per pass, retains shared and foreign history, and completes on replay', async () => {
    const t = fixture()
    await t.run(async (ctx) => {
      await createReceiptLedger(ctx, identity(), [characterReceipt()])
      await createReceiptLedger(ctx, identity(uuid(11), uuid(3)), [characterReceipt(uuid(3), 2)])
      const replay = { roll: null, occurrence: null }
      await createReceiptLedger(ctx, identity(uuid(12), characterId, 'CAMPAIGN'), [
        entry('encounterRunCommands', {
          id: uuid(103),
          campaignId: characterId,
          encounterId: uuid(4),
          commandId: uuid(203),
          actorUserId: ownerUserId,
          commandFingerprint: checksum,
          createdAt: timestamp,
          visibility: 'TABLE',
          commandType: 'UPSERT_REMINDER',
          version: 1,
          commandJson: { type: 'UPSERT_REMINDER', label: 'Retained' },
          replayReceiptJson: replay,
          replayReceiptChecksum: checksumCanonicalJson(replay)
        })
      ])
      const head = await ctx.db
        .query('receiptLedgers')
        .withIndex('by_publicId', (q) => q.eq('id', uuid(10)))
        .unique()
      if (!head) throw new Error('Missing ledger.')
      await ctx.db.patch(head._id, { payload: null, partCount: 9 })
      for (let index = 0; index < 9; index++)
        await ctx.db.insert('receiptLedgerParts', {
          ledgerId: head.id,
          index,
          bytes: new Uint8Array([255]).buffer
        })
    })
    const before = await snapshot(t)
    await retire(t)
    for (const remaining of [5, 1, 0]) {
      await t.mutation(purge, { characterId })
      const current = await snapshot(t)
      expect(current.parts).toHaveLength(remaining)
      expect(current.ledgers.some((head) => head.id === uuid(10))).toBe(remaining > 0)
      expect(current.jobs).toHaveLength(1)
      expect(current.schedules.at(-1)).toMatchObject({
        name: 'characters/receiptCleanup:purge',
        args: [{ characterId }]
      })
      expect(current.ledgers.filter((head) => head.id !== uuid(10))).toEqual(
        before.ledgers.filter((head) => head.id !== uuid(10))
      )
      expect(current.headers).toEqual(
        before.headers.filter((header) => header.characterId !== characterId)
      )
      expect(current.runHeaders).toEqual(before.runHeaders)
    }
    await t.mutation(purge, { characterId })
    const completed = await snapshot(t)
    expect(completed.jobs).toEqual([])
    await t.mutation(purge, { characterId })
    expect(await snapshot(t)).toEqual(completed)
  })

  it.each(['HEAD', 'PART', 'JOB'] as const)(
    'rejects malformed purge metadata and rolls back the pass: %s',
    async (kind) => {
      const t = fixture()
      await t.run((ctx) => createReceiptLedger(ctx, identity(), [characterReceipt()]))
      await retire(t)
      await t.run(async (ctx) => {
        const head = await ctx.db.query('receiptLedgers').first()
        const job = await ctx.db.query('characterReceiptPurgeJobs').first()
        if (!head || !job) throw new Error('Missing purge fixture.')
        if (kind === 'HEAD') await ctx.db.patch(head._id, { checksum: 'invalid-checksum' })
        if (kind === 'JOB') await ctx.db.patch(job._id, { ownerUserId: 'invalid-uuid' })
        if (kind === 'PART') {
          await ctx.db.patch(head._id, { payload: null, partCount: 1 })
          for (const index of [0, 1])
            await ctx.db.insert('receiptLedgerParts', {
              ledgerId: head.id,
              index,
              bytes: new Uint8Array([255]).buffer
            })
        }
      })
      const before = await snapshot(t)
      await expect(t.mutation(purge, { characterId })).rejects.toThrow()
      expect(await snapshot(t)).toEqual(before)
    }
  )

  it.each(['CHARACTER', 'DRAFT', 'ROUTE', 'PRIVATE_HEADER'] as const)(
    'refuses to purge a retained Character identity: %s',
    async (kind) => {
      const t = fixture()
      await t.run((ctx) => createReceiptLedger(ctx, identity(), [characterReceipt()]))
      await retire(t)
      await t.run(async (ctx) => {
        if (kind === 'CHARACTER')
          await ctx.db.insert('characters', {
            id: characterId,
            userId: ownerUserId,
            systemId: uuid(4),
            label: 'Retained',
            status: 'ACTIVE',
            createdAt: timestamp
          })
        if (kind === 'DRAFT')
          await ctx.db.insert('characterDrafts', {
            id: uuid(5),
            characterId,
            userId: ownerUserId,
            systemId: uuid(4),
            publicId: 'retained',
            label: 'Retained',
            status: 'DRAFT',
            mode: 'create',
            baseActiveUpdatedAt: null,
            createdAt: timestamp,
            updatedAt: timestamp,
            checksum,
            payloadId: uuid(6),
            payloadDocumentId: 'retained'
          })
        if (kind === 'ROUTE')
          await ctx.db.insert('authoredRouteIds', {
            subjectKind: 'CHARACTER',
            subjectId: characterId,
            publicId: 'retained',
            ownerUserId,
            routeNumber: 1
          })
        if (kind === 'PRIVATE_HEADER')
          await createReceiptLedger(ctx, identity(uuid(13)), [characterReceipt(characterId, 4)])
      })
      const before = await snapshot(t)
      await expect(t.mutation(purge, { characterId })).rejects.toThrow(
        'retained Character or live history'
      )
      expect(await snapshot(t)).toEqual(before)
    }
  )

  it.each(['encounterRunCommands', 'encounterRuleReceipts', 'characterCommandReceipts'] as const)(
    'refuses any live header family referencing the private ledger: %s',
    async (table) => {
      const t = fixture()
      await t.run((ctx) => createReceiptLedger(ctx, identity(), [characterReceipt()]))
      await retire(t)
      await t.run(async (ctx) => {
        const pointer = { ledgerId: uuid(10), entryIndex: 0, entryChecksum: checksum }
        const common = {
          ...pointer,
          id: uuid(30),
          campaignId: uuid(31),
          encounterId: uuid(32),
          commandId: uuid(33),
          commandFingerprint: checksum,
          createdAt: timestamp
        }
        if (table === 'encounterRunCommands')
          await ctx.db.insert(table, {
            ...common,
            actorUserId: ownerUserId,
            commandType: 'UPSERT_REMINDER',
            version: 1,
            visibility: 'TABLE'
          })
        if (table === 'encounterRuleReceipts')
          await ctx.db.insert(table, {
            ...common,
            occurrenceId: uuid(34),
            actorUserId: ownerUserId,
            commandType: 'RESOLVE_RULE_OCCURRENCE',
            encounterVersion: 1
          })
        if (table === 'characterCommandReceipts')
          await ctx.db.insert(table, {
            ...pointer,
            id: uuid(30),
            characterId: uuid(3),
            commandId: uuid(33),
            actorId: ownerUserId,
            commandFingerprint: checksum,
            occurredAt: timestamp
          })
      })
      const before = await snapshot(t)
      await expect(t.mutation(purge, { characterId })).rejects.toThrow('live references')
      expect(await snapshot(t)).toEqual(before)
    }
  )
})
