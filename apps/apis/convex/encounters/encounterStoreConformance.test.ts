import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createMemoryEncounterStore,
  type EncounterStoreWrite
} from '@artificer-toolkit/encounter-persistence/memoryEncounterStore'
import type { EncounterWriteTransaction } from '@artificer-toolkit/encounter-persistence/ports'
import type {
  EncounterDocument,
  EncounterTableName
} from '@artificer-toolkit/encounter-persistence/store'
import { encounterStoreSchemas } from '@artificer-toolkit/encounter-persistence/storeTables'
import { receiptHeaderSchemas } from '@artificer-toolkit/schema/projections/receiptHeaderPersistence'
import { canonicalizeJson } from '@artificer-toolkit/shared/canonicalJson'
import type { PlayerControlFixture } from '../../tests/fixtures/playerControl'
import { encounterConformanceCorpus } from '../../tests/fixtures/encounterConformanceCorpus'
import { useLocalRoomWorker } from '../../tests/fixtures/localRoomWorker'
import { createConvexEncounterStoreReader } from '../lib/convexEncounterStore'
import { encounterWriteTransaction } from './encounterPorts'

/**
 * Runs each Encounter persistence operation against Convex's `ctx.db` and against the in-memory
 * reference store loaded with the same documents, with the same ports, random UUIDs and clock. Both
 * must return the same result and make the same store changes; the Convex outcome is the golden.
 */

// Evidence rolls are room-only (D88): Convex holds no such table, so there is nothing to compare.
const tables = (Object.keys(encounterStoreSchemas) as EncounterTableName[]).filter(
  (table) => table !== 'encounterEvidenceRolls'
)
type StoreSnapshot = { [Table in EncounterTableName]: EncounterDocument<Table>[] }
type Operation<Result> = (transaction: EncounterWriteTransaction) => Promise<Result>

class Rollback extends Error {}

// Registered before the hooks below: hooks after each test run in reverse, so the room closes on
// restored mocks and real timers.
useLocalRoomWorker()

// Sequential UUIDs from the fixture on make the golden token order repeatable; both runs of an
// operation start from the same point in the sequence and at the same fixed time.
let uuidSequence = 0
beforeEach(() => {
  uuidSequence = 0
  vi.spyOn(crypto, 'randomUUID').mockImplementation(
    () =>
      `00000000-0000-4000-8000-${(++uuidSequence).toString(16).padStart(12, '0')}` as ReturnType<
        typeof crypto.randomUUID
      >
  )
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

function atFixedTime() {
  // Ahead of every commit: a transaction's clock cannot run behind the last one.
  vi.useFakeTimers({ toFake: ['Date'], now: new Date('2100-01-01T12:00:00.000Z') })
}

/** Receipt ledgers store `*Json` bodies canonically, so Convex reads them back key-sorted. */
function canonicalReceiptJson(document: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(document).map(([field, value]) => [
      field,
      field.endsWith('Json') && typeof value === 'string'
        ? canonicalizeJson(JSON.parse(value))
        : value
    ])
  )
}

function storeOf(memory: ReturnType<typeof createMemoryEncounterStore>) {
  return Object.fromEntries(
    tables.map((table) => [
      table,
      Object.hasOwn(receiptHeaderSchemas, table)
        ? memory.documents(table).map(canonicalReceiptJson)
        : memory.documents(table)
    ])
  ) as unknown as StoreSnapshot
}

async function snapshotStore(base: PlayerControlFixture): Promise<StoreSnapshot> {
  // The memory store holds logical rows; the Convex reader joins receipt headers with their ledgers.
  return base.t.run(async (ctx) => {
    // The reader's per-table overloads cannot take a runtime table name.
    const { query } = createConvexEncounterStoreReader(ctx) as unknown as {
      query: (table: EncounterTableName) => { collect: () => Promise<unknown[]> }
    }
    const entries = await Promise.all(
      tables.map(async (table) => [table, await query(table).collect()] as const)
    )
    return Object.fromEntries(entries) as unknown as StoreSnapshot
  })
}

/** The documents an operation inserted, changed and deleted, with Convex identities left out. */
function storeChanges(before: StoreSnapshot, after: StoreSnapshot) {
  return Object.fromEntries(
    tables.flatMap((table) => {
      const prior = new Map(before[table].map((document) => [document._id, document]))
      const current = new Map(after[table].map((document) => [document._id, document]))
      const strip = ({ _id, _creationTime, ...fields }: EncounterDocument<typeof table>) => fields
      const changes = {
        inserted: after[table].filter((document) => !prior.has(document._id)).map(strip),
        updated: after[table].flatMap((document) => {
          const previous = prior.get(document._id)
          return previous && JSON.stringify(previous) !== JSON.stringify(document)
            ? [{ before: strip(previous), after: strip(document) }]
            : []
        }),
        deleted: before[table].filter((document) => !current.has(document._id)).map(strip)
      }
      return changes.inserted.length || changes.updated.length || changes.deleted.length
        ? [[table, changes]]
        : []
    })
  )
}

/** Replaces UUIDs, checksums and timestamps with stable tokens in order of appearance. */
function golden(value: unknown) {
  const tokens = new Map<string, string>()
  const token = (kind: string) => (match: string) => {
    let name = tokens.get(match)
    if (!name) {
      name = `<${kind}:${tokens.size}>`
      tokens.set(match, name)
    }
    return name
  }
  return JSON.parse(
    JSON.stringify(value)
      .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, token('uuid'))
      .replace(/\b[0-9a-f]{64}\b/g, token('sha'))
      .replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z/g, token('time'))
  )
}

async function conformance<Result>(base: PlayerControlFixture, operation: Operation<Result>) {
  const before = await snapshotStore(base)
  const memory = createMemoryEncounterStore()
  for (const table of tables) memory.load(table, before[table])

  // The memory run reads its ports from an untouched Convex transaction, then rolls it back.
  const sequenceStart = uuidSequence
  atFixedTime()
  let memoryResult: Result | undefined
  let writeSet: readonly EncounterStoreWrite[] = []
  await expect(
    base.owner.caller.run(async (ctx) => {
      memory.transaction.begin()
      memoryResult = await operation({
        db: memory.store,
        ports: encounterWriteTransaction(ctx).ports
      })
      writeSet = memory.transaction.commit()
      throw new Rollback()
    })
  ).rejects.toBeInstanceOf(Rollback)
  const memoryAfter = storeOf(memory)
  vi.useRealTimers()
  expect(await snapshotStore(base)).toEqual(before)

  // The room persists a command as its write set (ADR 0035, S2): replaying the stored set onto the
  // documents the command started from must reproduce the store it left, identities included.
  const replayed = createMemoryEncounterStore()
  for (const table of tables) replayed.load(table, before[table])
  replayed.apply(JSON.parse(JSON.stringify(writeSet)) as EncounterStoreWrite[])
  expect(storeOf(replayed)).toEqual(memoryAfter)

  uuidSequence = sequenceStart
  atFixedTime()
  const convexResult = await base.owner.caller.run((ctx) =>
    operation(encounterWriteTransaction(ctx))
  )
  vi.useRealTimers()
  const convexChanges = storeChanges(before, await snapshotStore(base))

  // A Convex transaction returns an absent result as null.
  expect(memoryResult ?? null).toEqual(convexResult)
  expect(storeChanges(before, memoryAfter)).toEqual(convexChanges)
  return golden({ result: convexResult, changes: convexChanges })
}

describe('Encounter store conformance: Convex and the in-memory store', () => {
  for (const { name, setup } of encounterConformanceCorpus)
    it(name, async () => {
      const { base, operation } = await setup()
      expect(await conformance(base, operation)).toMatchSnapshot()
    })
})
