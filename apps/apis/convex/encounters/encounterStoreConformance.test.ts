import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { EncounterCommandInputDto } from '@artificer-toolkit/schema/api/encounters'
import { encounterRunStateSchema } from '@artificer-toolkit/schema/projections/encounterRunState'
import { planEncounterMechanicsBatch } from '@artificer-toolkit/rules-runtime/encounterMechanicsBatchPlan'
import { createMemoryEncounterStore } from '@artificer-toolkit/encounter-persistence/memoryEncounterStore'
import type { EncounterWriteTransaction } from '@artificer-toolkit/encounter-persistence/ports'
import type {
  EncounterDocument,
  EncounterTableName
} from '@artificer-toolkit/encounter-persistence/store'
import { encounterStoreSchemas } from '@artificer-toolkit/encounter-persistence/storeTables'
import { recordEncounterCommand } from '@artificer-toolkit/encounter-persistence/commands'
import {
  persistEncounterMechanicsBatchPlan,
  readEncounterMechanicsBatchTarget
} from '@artificer-toolkit/encounter-persistence/mechanicsBatchPersistence'
import { prepareRuleOccurrenceVoid } from '@artificer-toolkit/encounter-persistence/occurrenceVoid'
import { recordTurnMovement } from '@artificer-toolkit/encounter-persistence/turnMovement'
import { playerControlFixture, type PlayerControlFixture } from '../../tests/fixtures/playerControl'
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

async function gmTool(base: PlayerControlFixture, command: EncounterCommandInputDto) {
  return conformance(base, (transaction) =>
    recordEncounterCommand(transaction, command, base.owner.userId, () => {
      throw new Error('GM tools draw no dice.')
    })
  )
}

async function runState(base: PlayerControlFixture) {
  return base.t.run(async (ctx) => {
    const row = await ctx.db
      .query('encounterRuns')
      .withIndex('by_publicId', (q) => q.eq('id', base.run.id))
      .unique()
    if (!row) throw new Error('Missing conformance Run.')
    return encounterRunStateSchema.parse(JSON.parse(row.stateJson))
  })
}

describe('Encounter store conformance: Convex and the in-memory store', () => {
  it('applies an action mechanics batch to a Creature', async () => {
    const base = await playerControlFixture()
    const state = await runState(base)
    const target = base.run.actors.find((actor) => actor.id === base.enemy.id)!
    const outcome = await conformance(base, async (transaction) => {
      const read = await readEncounterMechanicsBatchTarget(transaction, {
        encounterId: base.run.id,
        targetActorId: target.id,
        expectedEncounterVersion: state.version,
        effectiveMaximumHitPoints: target.maxHitPoints,
        occurrenceId: '10000000-0000-4000-8000-000000000001',
        sourceCommandId: '10000000-0000-4000-8000-000000000002',
        commandId: '10000000-0000-4000-8000-000000000003',
        occurredAt: '2026-09-27T12:00:00.000Z',
        expectedCharacterStreamVersion: null,
        forceVersionAdvance: false,
        applications: [
          {
            sourceNodeId: 'conformance',
            sourceOperationKey: 'damage',
            authoredPath: null,
            resolvedPath: 'CONFORMANCE',
            kind: 'DAMAGE',
            targetActorId: target.id,
            requestedAmount: 2,
            resolvedAmount: 2,
            appliedAmount: 2,
            beforeCurrentHitPoints: target.currentHitPoints,
            afterCurrentHitPoints: target.currentHitPoints - 2,
            beforeTemporaryHitPoints: 0,
            afterTemporaryHitPoints: 0,
            maximumHitPoints: target.maxHitPoints,
            damageTypeId: '10000000-0000-4000-8000-000000000004',
            damageDisposition: 'NORMAL'
          }
        ]
      })
      const plan = planEncounterMechanicsBatch({
        batch: read.input,
        actor: read.actor,
        userId: read.userId
      })
      return persistEncounterMechanicsBatchPlan(transaction, read, {
        actor: read.actor,
        character: null,
        plan
      })
    })
    expect(outcome).toMatchSnapshot()
  })

  it('corrects the current turn', async () => {
    const base = await playerControlFixture()
    const state = await runState(base)
    expect(
      await gmTool(base, {
        type: 'SET_CURRENT_ACTOR',
        encounterId: base.run.id,
        commandId: '10000000-0000-4000-8000-000000000011',
        expectedVersion: state.version,
        actorId: base.enemy.id
      })
    ).toMatchSnapshot()
  })

  it('records turn movement', async () => {
    const base = await playerControlFixture()
    const state = await runState(base)
    expect(
      await conformance(base, async (transaction) => {
        await recordTurnMovement(transaction, { state, actorId: base.companion.id, feet: 15 })
        await recordTurnMovement(transaction, { state, actorId: base.companion.id, feet: 10 })
      })
    ).toMatchSnapshot()
  })

  it('voids a paused action', async () => {
    const base = await playerControlFixture({ bite: 'ATTACK', promptRolls: true })
    const started = await base.gm(await base.bite(base.companion.id, base.enemy.id))
    const pending = started.occurrence?.pending
    if (!pending) throw new Error('Expected a paused action.')
    expect(
      await conformance(base, (transaction) =>
        prepareRuleOccurrenceVoid(transaction, {
          type: 'VOID_RULE_OCCURRENCE',
          encounterId: base.run.id,
          commandId: '10000000-0000-4000-8000-000000000021',
          expectedVersion: pending.encounterVersion,
          occurrenceId: pending.occurrenceId,
          expectedOccurrenceVersion: pending.occurrenceVersion
        })
      )
    ).toMatchSnapshot()
  })

  it('reverts the last action', async () => {
    const base = await playerControlFixture()
    await base.gm(await base.bite(base.companion.id, base.enemy.id))
    const state = await runState(base)
    expect(
      await gmTool(base, {
        type: 'REVERT_LAST_ACTION',
        encounterId: base.run.id,
        commandId: '10000000-0000-4000-8000-000000000031',
        expectedVersion: state.version
      })
    ).toMatchSnapshot()
  })

  it('removes an actor', async () => {
    const base = await playerControlFixture()
    const state = await runState(base)
    expect(
      await gmTool(base, {
        type: 'REMOVE_ACTOR',
        encounterId: base.run.id,
        commandId: '10000000-0000-4000-8000-000000000041',
        expectedVersion: state.version,
        actorId: base.lurker.id
      })
    ).toMatchSnapshot()
  })
})
