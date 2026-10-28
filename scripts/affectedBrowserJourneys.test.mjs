import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import { buildImportGraph } from './affectedTests.mjs'
import {
  checkKnownBugs,
  JOURNEY_ENTRIES,
  journeyRunReason,
  KNOWN_BUG_PROOFS,
  ledgerTasks,
  GATING_SHARDS,
  proofNames,
  runnerProofs,
  shardProofs
} from './affectedBrowserJourneys.mjs'
import PROOF_SECONDS from './browserJourneyDurations.json' with { type: 'json' }

// The repository's own import graph, so the entries are proved against the code the journeys serve.
describe('browser journey selection', () => {
  const root = resolve(import.meta.dirname, '..')
  let graph
  beforeAll(() => {
    const tracked = execFileSync('git', ['ls-files'], {
      cwd: root,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024
    })
      .split('\n')
      .filter(Boolean)
    graph = buildImportGraph(root, tracked)
  }, 120_000)

  it('names only tracked entries', () => {
    const tracked = execFileSync('git', ['ls-files', ...JOURNEY_ENTRIES], {
      cwd: root,
      encoding: 'utf8'
    })
    expect(tracked.split('\n').filter(Boolean).sort()).toEqual([...JOURNEY_ENTRIES].sort())
  })

  it.each([
    ['a web route helper', 'apps/web/src/routes/-authoredCreateRouteLoader.ts'],
    ['a Convex function module', 'apps/apis/convex/campaigns/acquiredEquipment.ts'],
    ['a Session Worker module', 'apps/session-worker/src/accessTokenSubject.ts'],
    ['a rules-runtime module', 'packages/rules-runtime/src/abilityScoreCapability.ts']
  ])('runs when %s changes', (_, path) => {
    expect(journeyRunReason(graph, [path])).toMatch(/^the change reaches /)
  })

  it.each([
    ['the proof runner', 'scripts/runLocalConvexProof.ps1'],
    ['the workflow', '.github/workflows/browser-journeys.yml'],
    ['the backend image pin', '.github/workflows/live-backend.yml'],
    ['a served asset', 'apps/web/public/favicon.svg'],
    ['a dependency', 'yarn.lock']
  ])('runs when %s changes', (_, path) => {
    expect(journeyRunReason(graph, [path])).toBe(`${path} changed`)
  })

  it.each([
    ['docs and the ledger', ['docs/roadmap/08-phase-ledger.json', 'AGENTS.md']],
    ['a web unit test', ['apps/web/src/auth/AuthForms.test.tsx']],
    ['a rules-runtime test', ['packages/rules-runtime/src/__tests__/actionSurge.test.ts']],
    ['a web snapshot', ['apps/web/src/auth/__snapshots__/AuthForms.test.tsx.snap']]
  ])('skips %s', (_, changed) => {
    expect(journeyRunReason(graph, changed)).toBeNull()
  })
})

describe('proofNames', () => {
  it('splits the CI proof list on whitespace and commas', () => {
    expect(proofNames(' player-browser, hide-browser\nmovement ')).toEqual([
      'player-browser',
      'hide-browser',
      'movement'
    ])
    expect(proofNames('')).toEqual([])
  })

  it.each(['player browser;rm', '$(id)', 'Player-Browser', '-browser'])('refuses %s', (text) => {
    expect(() => proofNames(text)).toThrow(/is not a proof name/)
  })
})

describe('known-bug proofs', () => {
  const root = resolve(import.meta.dirname, '..')
  const ciProofs = runnerProofs(
    readFileSync(resolve(root, 'scripts/runLocalConvexProof.ps1'), 'utf8')
  ).filter((name) => name.endsWith('-browser'))
  const tasks = ledgerTasks(
    JSON.parse(readFileSync(resolve(root, 'docs/roadmap/08-phase-ledger.json'), 'utf8'))
  )

  it('reads the CI proofs from the runner ValidateSet', () => {
    expect(ciProofs).toContain('player-browser')
    expect(ciProofs).toContain('vtt-browser')
    expect(ciProofs.every((name) => name.endsWith('-browser'))).toBe(true)
  })

  it('names an open registered task for every entry', () => {
    expect(() => checkKnownBugs(KNOWN_BUG_PROOFS, ciProofs, tasks)).not.toThrow()
  })

  it.each([
    ['no task id', { 'player-browser': '' }, /must name a registered task/],
    [
      'an unregistered task',
      { 'player-browser': 'RELIABILITY-99.T1' },
      /must name a registered task/
    ],
    ['a proof outside the CI list', { movement: 'RELIABILITY-21.T1' }, /is not a CI proof/]
  ])('refuses an entry with %s', (_, entry, message) => {
    expect(() => checkKnownBugs(entry, ciProofs, tasks)).toThrow(message)
  })

  it('refuses an entry whose task is DONE', () => {
    const done = new Map([['RELIABILITY-21.T1', 'DONE']])
    expect(() => checkKnownBugs({ 'player-browser': 'RELIABILITY-21.T1' }, ciProofs, done)).toThrow(
      /is DONE; remove the entry/
    )
  })
})

// RELIABILITY-21.18: the real proof list, labels and recorded durations, packed onto shared stacks.
describe('shardProofs', () => {
  const root = resolve(import.meta.dirname, '..')
  const allProofs = runnerProofs(
    readFileSync(resolve(root, 'scripts/runLocalConvexProof.ps1'), 'utf8')
  )
  const ciProofs = allProofs.filter((name) => name.endsWith('-browser'))
  const shards = shardProofs(ciProofs, KNOWN_BUG_PROOFS, PROOF_SECONDS)
  const names = (shard) => shard.proofs.map(({ proof }) => proof)

  it('runs every CI proof exactly once', () => {
    expect(shards.flatMap(names).sort()).toEqual([...ciProofs].sort())
  })

  it('uses at most the gating shards plus one known-bug shard', () => {
    expect(shards.filter((shard) => !shard.knownBug)).toHaveLength(GATING_SHARDS)
    expect(shards.filter((shard) => shard.knownBug).length).toBeLessThanOrEqual(1)
  })

  it('keeps known-bug proofs apart from gating proofs, each with its own label', () => {
    for (const shard of shards)
      for (const { proof, knownBug } of shard.proofs) {
        expect(knownBug).toBe(KNOWN_BUG_PROOFS[proof] ?? '')
        expect(shard.knownBug).toBe(Boolean(KNOWN_BUG_PROOFS[proof]))
      }
  })

  it('keeps every shard well inside the 45-minute job timeout', () => {
    const seconds = (shard) => names(shard).reduce((sum, proof) => sum + PROOF_SECONDS[proof], 0)
    expect(Math.max(...shards.map(seconds))).toBeLessThanOrEqual(30 * 60)
  })

  it('records durations only for runner proofs', () => {
    expect(Object.keys(PROOF_SECONDS).filter((proof) => !allProofs.includes(proof))).toEqual([])
  })

  it('assigns a proof with no recorded duration', () => {
    const added = shardProofs([...ciProofs, 'new-browser'], KNOWN_BUG_PROOFS, PROOF_SECONDS)
    expect(added.filter((shard) => names(shard).includes('new-browser'))).toHaveLength(1)
    expect(added.find((shard) => names(shard).includes('new-browser')).knownBug).toBe(false)
  })

  it('reverses each shard without moving a proof', () => {
    const reversed = shardProofs(ciProofs, KNOWN_BUG_PROOFS, PROOF_SECONDS, { reverse: true })
    expect(reversed.map((shard) => names(shard).reverse())).toEqual(shards.map(names))
  })

  it.each([
    ['a gating proof', 'auth-browser', false],
    ['a known-bug proof', Object.keys(KNOWN_BUG_PROOFS)[0], true],
    ['a native proof', 'movement', false]
  ])('runs a dispatched %s alone', (_, proof, knownBug) => {
    expect(shardProofs([proof], KNOWN_BUG_PROOFS, PROOF_SECONDS)).toEqual([
      expect.objectContaining({
        knownBug,
        proofs: [{ proof, knownBug: KNOWN_BUG_PROOFS[proof] ?? '' }]
      })
    ])
  })

  it('selects no shard when no proof is selected', () => {
    expect(shardProofs([], KNOWN_BUG_PROOFS, PROOF_SECONDS)).toEqual([])
  })
})
