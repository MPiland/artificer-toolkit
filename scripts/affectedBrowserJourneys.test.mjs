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
  proofNames,
  runnerProofs
} from './affectedBrowserJourneys.mjs'

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
