import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import { buildImportGraph } from './affectedTests.mjs'
import {
  acJourneyProblems,
  checkKnownBugs,
  ciProofsOf,
  JOURNEY_ENTRIES,
  journeyRunReason,
  ledgerTasks,
  GATING_SHARDS,
  proofNames,
  pushProofs,
  runnerProofs,
  shardProofs,
  sliceJourneys
} from './affectedBrowserJourneys.mjs'
import PROOF_SECONDS from './browserJourneyDurations.json' with { type: 'json' }
import KNOWN_BUG_PROOFS from './knownBugProofs.json' with { type: 'json' }

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

  describe('known-bug label edits', () => {
    const ciProofs = ['builder-browser', 'player-browser', 'vtt-browser']
    const labels = { 'builder-browser': 'RELIABILITY-21.T16' }

    it('selects no proofs for an added or retargeted label', () => {
      const added = { ...labels, 'vtt-browser': 'RELIABILITY-21.T9' }
      const retargeted = { 'builder-browser': 'RELIABILITY-21.T9' }
      for (const head of [added, retargeted])
        expect(
          pushProofs(graph, ['scripts/knownBugProofs.json'], ciProofs, labels, head, [])
        ).toEqual({
          reason: null,
          proofs: []
        })
    })

    it('selects exactly the proof whose label was removed', () => {
      const base = { ...labels, 'vtt-browser': 'RELIABILITY-21.T9' }
      expect(
        pushProofs(graph, ['scripts/knownBugProofs.json'], ciProofs, base, labels, [])
      ).toEqual({
        reason: 'known-bug labels removed',
        proofs: ['vtt-browser']
      })
    })

    it('selects every proof when the selector code changes too', () => {
      const changed = ['scripts/knownBugProofs.json', 'scripts/affectedBrowserJourneys.mjs']
      expect(pushProofs(graph, changed, ciProofs, labels, {}, [])).toEqual({
        reason: 'scripts/affectedBrowserJourneys.mjs changed',
        proofs: ciProofs
      })
    })
  })

  // RELIABILITY-21.19: a slice gates on the journeys its acceptance criteria name.
  describe('named journeys', () => {
    const ciProofs = ['builder-browser', 'player-browser', 'vtt-browser']
    const route = 'apps/web/src/routes/-authoredCreateRouteLoader.ts'

    it('runs only the named journeys when the change reaches a journey', () => {
      const push = pushProofs(graph, [route], ciProofs, {}, {}, ['vtt-browser', 'player-browser'])
      expect(push.proofs).toEqual(['player-browser', 'vtt-browser'])
      expect(push.reason).toMatch(
        /^the change reaches .*; the acceptance criteria name these journeys$/
      )
    })

    it('runs the named journeys when a served asset changes', () => {
      expect(
        pushProofs(graph, ['apps/web/public/favicon.svg'], ciProofs, {}, {}, ['vtt-browser']).proofs
      ).toEqual(['vtt-browser'])
    })

    it('runs no journey when the acceptance criteria name none', () => {
      expect(pushProofs(graph, [route], ciProofs, {}, {}, [])).toEqual({ reason: null, proofs: [] })
    })

    it('runs no named journey when the change reaches none', () => {
      expect(pushProofs(graph, ['AGENTS.md'], ciProofs, {}, {}, ['vtt-browser'])).toEqual({
        reason: null,
        proofs: []
      })
    })

    it('runs every journey for a stack change, whatever the criteria name', () => {
      expect(
        pushProofs(graph, [route, 'yarn.lock'], ciProofs, {}, {}, ['vtt-browser']).proofs
      ).toEqual(ciProofs)
    })

    it('adds a released known-bug proof to the named journeys', () => {
      const base = { 'builder-browser': 'RELIABILITY-21.T16' }
      expect(
        pushProofs(graph, [route, 'scripts/knownBugProofs.json'], ciProofs, base, {}, [
          'vtt-browser'
        ])
      ).toEqual({
        reason: `${journeyRunReason(graph, [route])}; the acceptance criteria name these journeys; known-bug labels removed`,
        proofs: ['builder-browser', 'vtt-browser']
      })
    })
  })
})

describe('sliceJourneys', () => {
  const ledger = {
    features: [
      {
        pbis: [
          {
            id: 'SAMPLE-1',
            acs: [
              { id: 'SAMPLE-1.1', journeys: ['vtt-browser'] },
              { id: 'SAMPLE-1.2', journeys: ['player-browser', 'vtt-browser'] },
              { id: 'SAMPLE-1.3' }
            ],
            tasks: [
              { id: 'SAMPLE-1.T1', closes: ['SAMPLE-1.1', 'SAMPLE-1.2'] },
              { id: 'SAMPLE_UI-1.T2b', closes: ['SAMPLE-1.3'] }
            ]
          }
        ]
      }
    ]
  }

  it('maps a slice branch to its task and the journeys of the criteria it closes', () => {
    expect(sliceJourneys(ledger, 'ci/sample-1-t1')).toEqual({
      task: 'SAMPLE-1.T1',
      journeys: ['vtt-browser', 'player-browser']
    })
  })

  it('maps underscores and dots to dashes, and a task with unnamed criteria to no journey', () => {
    expect(sliceJourneys(ledger, 'ci/sample-ui-1-t2b')).toEqual({
      task: 'SAMPLE_UI-1.T2b',
      journeys: []
    })
  })

  it.each(['ci/merge-m9', 'ci/known-bug-relabel', ''])('maps %s to no task', (branch) => {
    expect(sliceJourneys(ledger, branch)).toEqual({ task: null, journeys: [] })
  })

  it('maps this slice in the real ledger', () => {
    const root = resolve(import.meta.dirname, '..')
    const real = JSON.parse(
      readFileSync(resolve(root, 'docs/roadmap/08-phase-ledger.json'), 'utf8')
    )
    expect(sliceJourneys(real, 'ci/reliability-21-t21').task).toBe('RELIABILITY-21.T21')
  })
})

describe('acJourneyProblems', () => {
  const root = resolve(import.meta.dirname, '..')
  const ciProofs = ciProofsOf(
    readFileSync(resolve(root, 'scripts/runLocalConvexProof.ps1'), 'utf8')
  )
  const ledgerOf = (ac) => ({ pbis: [{ acs: [{ id: 'SAMPLE-1.1', ...ac }], tasks: [] }] })

  it('accepts the real ledger', () => {
    const real = JSON.parse(
      readFileSync(resolve(root, 'docs/roadmap/08-phase-ledger.json'), 'utf8')
    )
    expect(acJourneyProblems(real, ciProofs)).toEqual([])
  })

  it('accepts an AC with no journeys or CI proofs', () => {
    expect(acJourneyProblems(ledgerOf({}), ciProofs)).toEqual([])
    expect(acJourneyProblems(ledgerOf({ journeys: ['vtt-browser'] }), ciProofs)).toEqual([])
  })

  it.each([
    ['a proof outside the CI list', ['movement']],
    ['an unknown name', ['vtt']],
    ['an empty list', []],
    ['a bare name', 'vtt-browser']
  ])('refuses %s', (_, journeys) => {
    expect(acJourneyProblems(ledgerOf({ journeys }), ciProofs)).toEqual([
      expect.stringMatching(/^SAMPLE-1\.1 journeys must list CI proofs/)
    ])
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
  const ciProofs = ciProofsOf(
    readFileSync(resolve(root, 'scripts/runLocalConvexProof.ps1'), 'utf8')
  )
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

  // A fixed label, so the case holds while the live file has no known bugs.
  const dispatchLabels = { 'builder-browser': 'RELIABILITY-21.T16' }
  it.each([
    ['a gating proof', 'auth-browser', false],
    ['a known-bug proof', 'builder-browser', true],
    ['a native proof', 'movement', false]
  ])('runs a dispatched %s alone', (_, proof, knownBug) => {
    expect(shardProofs([proof], dispatchLabels, PROOF_SECONDS)).toEqual([
      expect.objectContaining({
        knownBug,
        proofs: [{ proof, knownBug: dispatchLabels[proof] ?? '' }]
      })
    ])
  })

  it('selects no shard when no proof is selected', () => {
    expect(shardProofs([], KNOWN_BUG_PROOFS, PROOF_SECONDS)).toEqual([])
  })
})
