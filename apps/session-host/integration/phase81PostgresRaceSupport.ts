import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import type { DBLike } from '@artificer-toolkit/db'
import { sql } from 'kysely'

interface AcceptanceCase {
  id: string
  proofTier: string
}

interface Phase81AcceptanceLedger {
  addenda?: {
    cases: AcceptanceCase[]
    fixedTotal: number
    phase: string
  }[]
}

export const phase81PostgresRaceIds = [
  'P81-RACE-ACTION-ADVANCE-ACTION-FIRST',
  'P81-RACE-ACTION-ADVANCE-ADVANCE-FIRST',
  'P81-RACE-ACTION-ASSIGNMENT-ACTION-FIRST',
  'P81-RACE-ACTION-ASSIGNMENT-ASSIGNMENT-FIRST',
  'P81-RACE-ACTION-LEASE-ACTION-FIRST',
  'P81-RACE-ACTION-LEASE-LEASE-FIRST',
  'P81-RACE-ACTION-MEMBER-ACTION-FIRST',
  'P81-RACE-ACTION-MEMBER-MEMBER-FIRST',
  'P81-RACE-DUPLICATE-DUPLICATE-FIRST',
  'P81-RACE-DUPLICATE-RETRY-FIRST',
  'P81-RACE-CONCENTRATION-CLEANUP-CHECK-FIRST',
  'P81-RACE-CONCENTRATION-CLEANUP-CLEANUP-FIRST',
  'P81-RACE-DECISION-SUPERSEDE-RESOLVE-FIRST',
  'P81-RACE-DECISION-SUPERSEDE-SUPERSEDE-FIRST',
  'P81-RACE-EFFECT-REMOVE-REMOVE-FIRST',
  'P81-RACE-EFFECT-REMOVE-TICK-FIRST',
  'P81-RACE-OPTIONAL-DECISION-DECISION-FIRST',
  'P81-RACE-OPTIONAL-DECISION-OVERRIDE-FIRST',
  'P81-RACE-INITIATIVE-ALLEGIANCE-ALLEGIANCE-FIRST',
  'P81-RACE-INITIATIVE-ALLEGIANCE-SELECT-FIRST',
  'P81-RACE-INITIATIVE-REMOVE-REMOVE-FIRST',
  'P81-RACE-INITIATIVE-REMOVE-SELECT-FIRST',
  'P81-RACE-LOADOUT-ACTION-ACTION-FIRST',
  'P81-RACE-LOADOUT-ACTION-REPLACE-FIRST',
  'P81-RACE-MOVEMENT-REACTION-MOVE-FIRST',
  'P81-RACE-MOVEMENT-REACTION-REACTION-FIRST',
  'P81-RACE-MOVEMENT-SCENE-MOVE-FIRST',
  'P81-RACE-MOVEMENT-SCENE-SCENE-FIRST'
] as const

export type Phase81RaceCaseId = (typeof phase81PostgresRaceIds)[number]

export interface Phase81PostgresEnvironment {
  connectionString: string
  supabaseSecretKey: string
  supabaseUrl: string
}

export interface Phase81RaceOperationResult<T = unknown> {
  error?: unknown
  fulfilled: boolean
  value?: T
}

export type Phase81RaceOrdering = 'FIRST_WINS' | 'SECOND_WINS'

export interface Phase81RacePassResult<TCaseId extends Phase81RaceCaseId = Phase81RaceCaseId> {
  assertions: readonly [string, ...string[]]
  caseId: TCaseId
  ordering: Phase81RaceOrdering
  status: 'PASS'
}

export interface Phase81RaceModuleContract<TCaseId extends Phase81RaceCaseId> {
  caseIds: readonly TCaseId[]
  module: string
}

export const phase81RaceModuleContracts = {
  actionAuthority: {
    module: 'phase81PostgresActionAuthorityRaceProof',
    caseIds: phase81PostgresRaceIds.slice(0, 10)
  },
  effectDecision: {
    module: 'phase81PostgresEffectDecisionRaceProof',
    caseIds: phase81PostgresRaceIds.slice(10, 18)
  },
  initiativeLoadout: {
    module: 'phase81PostgresInitiativeLoadoutRaceProof',
    caseIds: phase81PostgresRaceIds.slice(18, 24)
  },
  movement: {
    module: 'phase81PostgresMovementRaceProof',
    caseIds: phase81PostgresRaceIds.slice(24, 28)
  }
} as const satisfies Record<string, Phase81RaceModuleContract<Phase81RaceCaseId>>

export function loadPhase81PostgresRaceIds(): readonly Phase81RaceCaseId[] {
  const ledgerPath = fileURLToPath(
    new URL('../../../docs/roadmap/08-vtt-acceptance.json', import.meta.url)
  )
  const ledger = JSON.parse(readFileSync(ledgerPath, 'utf8')) as Phase81AcceptanceLedger
  const addendum = ledger.addenda?.find(({ phase }) => phase === '8.1')
  assert.ok(addendum, 'Acceptance ledger must retain the Phase 8.1 addendum.')
  assert.equal(addendum.fixedTotal, 73, 'Phase 8.1 denominator must remain frozen at 73.')
  const ledgerRaceIds = addendum.cases
    .filter(({ id, proofTier }) => proofTier === 'DATABASE' && id.startsWith('P81-RACE-'))
    .map(({ id }) => id)
    .sort()
  assert.deepEqual(ledgerRaceIds, [...phase81PostgresRaceIds].sort())
  assert.equal(ledgerRaceIds.length, 28, 'Phase 8.1 must retain exactly 28 PostgreSQL races.')
  return phase81PostgresRaceIds
}

export function createPhase81RacePassResult<TCaseId extends Phase81RaceCaseId>(input: {
  assertions: readonly string[]
  caseId: TCaseId
  ordering: Phase81RaceOrdering
}): Phase81RacePassResult<TCaseId> {
  assert.ok(input.assertions.length > 0 && input.assertions.length <= 8)
  assert.ok(input.assertions.every((assertion) => assertion.length > 0 && assertion.length <= 120))
  return {
    assertions: input.assertions as readonly [string, ...string[]],
    caseId: input.caseId,
    ordering: input.ordering,
    status: 'PASS'
  }
}

export async function requirePhase81BackendPid(db: DBLike): Promise<number> {
  const result = await sql<{ pid: number }>`select pg_backend_pid() as pid`.execute(db)
  const pid = Number(result.rows[0]?.pid)
  assert.ok(Number.isInteger(pid) && pid > 0, 'PostgreSQL backend PID is unavailable.')
  return pid
}

export async function waitForPhase81DatabaseBlock(
  observer: DBLike,
  blockerPid: number,
  contenderPid: number
): Promise<void> {
  for (let attempt = 0; attempt < 500; attempt += 1) {
    const result = await sql<{ waiting: boolean }>`
      select exists (
        select 1
        from pg_catalog.pg_stat_activity
        where datname = current_database()
          and pid = ${contenderPid}
          and wait_event_type = 'Lock'
          and ${blockerPid} = any(pg_catalog.pg_blocking_pids(pid))
      ) as waiting
    `.execute(observer)
    if (result.rows[0]?.waiting) return
    await new Promise<void>((resolve) => setImmediate(resolve))
  }
  throw new Error(
    `The production contender backend ${contenderPid} never waited on PostgreSQL backend ${blockerPid}.`
  )
}

async function settlePhase81Operation<T>(
  operation: () => Promise<T>
): Promise<Phase81RaceOperationResult<T>> {
  try {
    return { fulfilled: true, value: await operation() }
  } catch (error) {
    return { error, fulfilled: false }
  }
}

export async function runPhase81CampaignRootRace<TWinner, TContender>(input: {
  campaignId: string
  connectionFactory: () => DBLike
  contender: (db: DBLike) => Promise<TContender>
  observer: DBLike
  winner: (db: DBLike) => Promise<TWinner>
}): Promise<
  readonly [Phase81RaceOperationResult<TWinner>, Phase81RaceOperationResult<TContender>]
> {
  return runPhase81ProductionRootRace({
    connectionFactory: input.connectionFactory,
    contender: input.contender,
    observer: input.observer,
    lockWinnerRoot: async (trx) => {
      await sql`
        select id
        from public.campaigns
        where id = ${input.campaignId}::uuid
        for update
      `.execute(trx)
      return requirePhase81BackendPid(trx)
    },
    winner: input.winner
  })
}

export async function runPhase81ProductionRootRace<TWinner, TContender>(input: {
  connectionFactory: () => DBLike
  contender: (db: DBLike) => Promise<TContender>
  lockWinnerRoot: (db: DBLike) => Promise<number>
  observer: DBLike
  winner: (db: DBLike) => Promise<TWinner>
}): Promise<
  readonly [Phase81RaceOperationResult<TWinner>, Phase81RaceOperationResult<TContender>]
> {
  const contenderDb = input.connectionFactory()
  const winnerDb = input.connectionFactory()
  let contenderResult: Promise<Phase81RaceOperationResult<TContender>> | null = null
  try {
    const winnerResult = await settlePhase81Operation(() =>
      winnerDb.transaction().execute(async (trx) => {
        const blockerPid = await input.lockWinnerRoot(trx)
        const contenderStarted = deferred<number>()
        contenderResult = settlePhase81Operation(() =>
          contenderDb.transaction().execute(async (contenderTrx) => {
            contenderStarted.resolve(await requirePhase81BackendPid(contenderTrx))
            return input.contender(contenderTrx)
          })
        )
        const contenderPid = await contenderStarted.promise
        await waitForPhase81DatabaseBlock(input.observer, blockerPid, contenderPid)
        return input.winner(trx)
      })
    )
    assert.ok(contenderResult, 'The production contender must start before the winner commits.')
    return [winnerResult, await contenderResult]
  } finally {
    try {
      if (contenderResult) await contenderResult
    } finally {
      await Promise.all([contenderDb.destroy(), winnerDb.destroy()])
    }
  }
}

interface Deferred<T> {
  promise: Promise<T>
  resolve(value: T): void
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((currentResolve) => {
    resolve = currentResolve
  })
  return { promise, resolve }
}

export interface Phase81TwoPartyBarrier {
  arrive(party: 'FIRST' | 'SECOND'): Promise<void>
  release(): void
}

export function createPhase81TwoPartyBarrier(): Phase81TwoPartyBarrier {
  const arrived = new Set<'FIRST' | 'SECOND'>()
  const bothArrived = deferred<void>()
  const released = deferred<void>()
  return {
    async arrive(party) {
      assert.ok(!arrived.has(party), `${party} reached the race barrier more than once.`)
      arrived.add(party)
      if (arrived.size === 2) bothArrived.resolve()
      await bothArrived.promise
      await released.promise
    },
    release() {
      assert.equal(arrived.size, 2, 'Both PostgreSQL race parties must reach the barrier first.')
      released.resolve()
    }
  }
}
