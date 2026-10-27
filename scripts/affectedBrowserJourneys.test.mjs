import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import { buildImportGraph } from './affectedTests.mjs'
import { JOURNEY_ENTRIES, journeyRunReason, proofNames } from './affectedBrowserJourneys.mjs'

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
