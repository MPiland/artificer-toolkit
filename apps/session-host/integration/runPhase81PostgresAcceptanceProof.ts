import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { parseEnv } from 'node:util'

import { proveGate2EncounterRuleActionPostgresSemantics } from './gate2EncounterRuleActionPostgresProof.js'
import { provePhase81PostgresActionAuthorityRaces } from './phase81PostgresActionAuthorityRaceProof.js'
import { provePhase81EffectDecisionRaces } from './phase81PostgresEffectDecisionRaceProof.js'
import { provePhase81InitiativeLoadoutRaces } from './phase81PostgresInitiativeLoadoutRaceProof.js'
import { provePhase81MovementRaces } from './phase81PostgresMovementRaceProof.js'
import { provePhase81PostgresCleanup } from './phase81PostgresCleanupProof.js'
import { provePhase81PostgresPrivacy } from './phase81PostgresPrivacyProof.js'
import {
  loadPhase81PostgresRaceIds,
  type Phase81PostgresEnvironment,
  type Phase81RaceCaseId,
  type Phase81RacePassResult
} from './phase81PostgresRaceSupport.js'
import { proveRuleExecutionOccurrencePostgresSemantics } from './ruleExecutionOccurrencePostgresProof.js'

const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '::1', 'host.docker.internal'])
const REMOTE_ONLY_ENVIRONMENT = /^(?:NETLIFY_|PROD_|STAGING_|MANAGED_|SUPABASE_ACCESS_TOKEN$)/u
const PHASE81_POSTGRES_CASE_PREFIX = 'P81-PG-'

interface AcceptanceCase {
  id: string
  proofTier: string
}

interface AcceptanceGate {
  fixedTotal: number
  gate: number
  cases: AcceptanceCase[]
}

interface AcceptanceLedger {
  addenda?: { cases: AcceptanceCase[]; fixedTotal: number; phase: string }[]
  gates: AcceptanceGate[]
}

interface ProofInventory {
  lifecycle: readonly string[]
  races: readonly Phase81RaceCaseId[]
}

type ProofGroup =
  | 'all'
  | 'lifecycle'
  | 'replay'
  | 'rollback'
  | 'concurrency'
  | 'privacy'
  | 'cleanup'

function loadLocalEnvironment(): void {
  const repoRoot = fileURLToPath(new URL('../../../', import.meta.url))
  const environmentPath = `${repoRoot}/.env.local`
  if (!existsSync(environmentPath)) return
  for (const [key, value] of Object.entries(parseEnv(readFileSync(environmentPath, 'utf8')))) {
    if (REMOTE_ONLY_ENVIRONMENT.test(key)) continue
    if (process.env[key] === undefined) process.env[key] = value
  }
  for (const key of Object.keys(process.env)) {
    if (REMOTE_ONLY_ENVIRONMENT.test(key)) delete process.env[key]
  }
}

function requireLoopback(name: string, value: string): string {
  const host = new URL(value).hostname.toLowerCase()
  if (!LOCAL_HOSTS.has(host)) {
    throw new Error(`${name} must use a loopback host for the Phase 8.1 PostgreSQL proof.`)
  }
  return value
}

function rejectRemoteOnlyEnvironment(): void {
  const present = Object.entries(process.env)
    .filter(([key, value]) => Boolean(value) && REMOTE_ONLY_ENVIRONMENT.test(key))
    .map(([key]) => key)
  if (present.length > 0) {
    throw new Error(
      `Phase 8.1 PostgreSQL proof refuses remote-only environment variables: ${present.join(', ')}.`
    )
  }
}

function required(
  name: 'DATABASE_CONNECTION_STRING' | 'SUPABASE_SECRET_KEY' | 'SUPABASE_URL'
): string {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is required for the Phase 8.1 PostgreSQL proof.`)
  return value
}

function loadInventory(): ProofInventory {
  const ledgerPath = fileURLToPath(
    new URL('../../../docs/roadmap/08-vtt-acceptance.json', import.meta.url)
  )
  const ledger = JSON.parse(readFileSync(ledgerPath, 'utf8')) as AcceptanceLedger
  const addendum = ledger.addenda?.find(({ phase }) => phase === '8.1')
  assert.ok(addendum, 'Acceptance ledger must retain the Phase 8.1 addendum.')
  assert.equal(addendum.phase, '8.1', 'Acceptance ledger must retain the Phase 8.1 addendum.')
  assert.equal(addendum.fixedTotal, 73, 'Phase 8.1 denominator must remain frozen at 73.')
  const cases = addendum.cases
  const lifecycle = cases
    .filter(
      ({ id, proofTier }) => proofTier === 'DATABASE' && id.startsWith(PHASE81_POSTGRES_CASE_PREFIX)
    )
    .map(({ id }) => id)
    .sort()
  const races = loadPhase81PostgresRaceIds()
  assert.deepEqual(lifecycle, [
    'P81-PG-CLEANUP',
    'P81-PG-CONCURRENCY',
    'P81-PG-LIFECYCLE',
    'P81-PG-PRIVACY',
    'P81-PG-REPLAY',
    'P81-PG-ROLLBACK'
  ])
  assert.equal(new Set([...lifecycle, ...races]).size, lifecycle.length + races.length)
  return { lifecycle, races }
}

function parseGroup(arguments_: readonly string[]): ProofGroup | 'list' {
  if (arguments_.length === 1 && arguments_[0] === '--list') return 'list'
  assert.equal(arguments_.length, 1, 'Pass exactly one selector: --list or --group=<group>.')
  const value = arguments_[0]
  if (!value?.startsWith('--group='))
    throw new Error(`Unsupported Phase 8.1 proof selector "${value}".`)
  const group = value.slice('--group='.length)
  if (
    ['all', 'lifecycle', 'replay', 'rollback', 'concurrency', 'privacy', 'cleanup'].includes(group)
  ) {
    return group as ProofGroup
  }
  throw new Error(`Unsupported Phase 8.1 proof group "${group}".`)
}

function emitCase(
  id: string,
  group: ProofGroup,
  status: 'PASS' | 'INVENTORIED' | 'UNIMPLEMENTED'
): void {
  console.log(JSON.stringify({ caseId: id, group, status }))
}

function emitRace(result: Phase81RacePassResult, group: ProofGroup): void {
  console.log(JSON.stringify({ ...result, group }))
}

async function runRaceProofs(
  environment: Phase81PostgresEnvironment,
  runId: string,
  expectedCaseIds: readonly Phase81RaceCaseId[]
): Promise<void> {
  const results: Phase81RacePassResult[] = [
    ...(await provePhase81PostgresActionAuthorityRaces({
      environment,
      runId: `${runId}-action-authority`
    })),
    ...(await provePhase81EffectDecisionRaces(environment, `${runId}-effect-decision`)),
    ...(await provePhase81InitiativeLoadoutRaces({
      environment,
      runId: `${runId}-initiative-loadout`
    })),
    ...(await provePhase81MovementRaces(environment, `${runId}-movement`))
  ]
  const actualCaseIds = results.map(({ caseId }) => caseId)
  assert.equal(new Set(actualCaseIds).size, actualCaseIds.length, 'Race proofs must be unique.')
  assert.deepEqual(
    [...actualCaseIds].sort(),
    [...expectedCaseIds].sort(),
    'Race proofs must cover the exact frozen 28-case inventory.'
  )
  for (const result of results) emitRace(result, 'concurrency')
}

async function runGroup(
  group: ProofGroup,
  inventory: ProofInventory,
  environment: Phase81PostgresEnvironment
): Promise<void> {
  if (group === 'lifecycle') {
    throw new Error(
      'P81-PG-LIFECYCLE is owned by the complete pre-staging local manifest because it requires the ordered reset, generation, seed, audit, build, PostgreSQL, and E2E lifecycle.'
    )
  }
  const runId = randomUUID()
  await proveRuleExecutionOccurrencePostgresSemantics({
    ...environment,
    runId: `${runId}-occurrence`
  })
  await proveGate2EncounterRuleActionPostgresSemantics({
    ...environment,
    runId: `${runId}-encounter`
  })
  if (group === 'privacy' || group === 'all') await provePhase81PostgresPrivacy(environment, runId)
  if (group === 'cleanup' || group === 'all') await provePhase81PostgresCleanup(environment, runId)

  const lifecycleCases =
    group === 'all'
      ? inventory.lifecycle.filter((id) => id !== 'P81-PG-LIFECYCLE')
      : inventory.lifecycle.filter((id) => id === `P81-PG-${group.toUpperCase()}`)
  for (const id of lifecycleCases) emitCase(id, group, 'PASS')
  if (group === 'all' || group === 'concurrency') {
    await runRaceProofs(environment, runId, inventory.races)
  }
}

async function main(): Promise<void> {
  const selector = parseGroup(process.argv.slice(2))
  const inventory = loadInventory()
  if (selector === 'list') {
    for (const id of [...inventory.lifecycle, ...inventory.races])
      emitCase(id, 'all', 'INVENTORIED')
    console.log(
      JSON.stringify({ postgresProofTotal: inventory.lifecycle.length + inventory.races.length })
    )
    return
  }

  loadLocalEnvironment()
  rejectRemoteOnlyEnvironment()
  const connectionString = requireLoopback(
    'DATABASE_CONNECTION_STRING',
    required('DATABASE_CONNECTION_STRING')
  )
  const supabaseUrl = requireLoopback('SUPABASE_URL', required('SUPABASE_URL'))
  await runGroup(selector, inventory, {
    connectionString,
    supabaseSecretKey: required('SUPABASE_SECRET_KEY'),
    supabaseUrl
  })
}

main().catch((error: unknown) => {
  console.error(
    JSON.stringify({
      classification: error instanceof Error ? error.name : 'NonErrorFailure',
      error:
        error instanceof Error
          ? error.message.replaceAll(/\s+/gu, ' ').slice(0, 800)
          : String(error)
    })
  )
  process.exitCode = 1
})
