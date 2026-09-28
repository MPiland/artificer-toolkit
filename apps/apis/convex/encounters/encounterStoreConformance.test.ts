import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryEncounterStore } from '@artificer-toolkit/encounter-persistence/memoryEncounterStore'
import type { EncounterWriteTransaction } from '@artificer-toolkit/encounter-persistence/ports'
import type {
  EncounterDocument,
  EncounterTableName
} from '@artificer-toolkit/encounter-persistence/store'
import { encounterStoreSchemas } from '@artificer-toolkit/encounter-persistence/storeTables'
import type { PlayerControlFixture } from '../../tests/fixtures/playerControl'
import { encounterConformanceCorpus } from '../../tests/fixtures/encounterConformanceCorpus'
import { encounterWriteTransaction } from './encounterPorts'

/**
 * Runs each Encounter persistence operation against Convex's `ctx.db` and against the in-memory
 * reference store loaded with the same documents, with the same ports, random UUIDs and clock. Both
 * must return the same result and make the same store changes; the Convex outcome is the golden.
 */

const tables = Object.keys(encounterStoreSchemas) as EncounterTableName[]
type StoreSnapshot = { [Table in EncounterTableName]: EncounterDocument<Table>[] }
type Operation<Result> = (transaction: EncounterWriteTransaction) => Promise<Result>

class Rollback extends Error {}

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
  vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-09-27T12:00:00.000Z') })
}

async function snapshotStore(base: PlayerControlFixture): Promise<StoreSnapshot> {
  return base.t.run(async (ctx) => {
    const entries = await Promise.all(
      tables.map(async (table) => [table, await ctx.db.query(table).collect()] as const)
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
  await expect(
    base.owner.caller.run(async (ctx) => {
      memoryResult = await operation({
        db: memory.store,
        ports: encounterWriteTransaction(ctx).ports
      })
      throw new Rollback()
    })
  ).rejects.toBeInstanceOf(Rollback)
  const memoryAfter = Object.fromEntries(
    tables.map((table) => [table, memory.documents(table)])
  ) as unknown as StoreSnapshot
  vi.useRealTimers()
  expect(await snapshotStore(base)).toEqual(before)

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
