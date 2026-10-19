import { describe, expect, it } from 'vitest'
import {
  docsOnly,
  MergeRefused,
  nextMergeNumber,
  runsVerdict,
  validateInputs
} from './mergeSlice.mjs'

describe('nextMergeNumber', () => {
  it('is one more than the highest numbered batch, compared as numbers', () => {
    const refs = ['refs/heads/ci/merge-m9', 'refs/heads/ci/merge-m114', 'refs/heads/ci/merge-m76']
    expect(nextMergeNumber(refs, 'ci/merge-m')).toBe(115)
  })

  it('ignores branches that only share the prefix', () => {
    const refs = [
      'refs/heads/ci/merge-m200-retry',
      'refs/heads/ci/merge-mx',
      'refs/heads/ci/merge-m3'
    ]
    expect(nextMergeNumber(refs, 'ci/merge-m')).toBe(4)
  })

  it('starts at 1 without batches', () => {
    expect(nextMergeNumber([], 'ci/p25-merge-m')).toBe(1)
  })
})

describe('runsVerdict', () => {
  const runAt = (workflowName, createdAt, status, conclusion, databaseId = 1) => ({
    workflowName,
    createdAt,
    status,
    conclusion,
    databaseId
  })

  it('is green only when the newest Tests and Live runs both succeeded', () => {
    const runs = [
      runAt('Tests', '2026-10-18T10:00:00Z', 'completed', 'failure', 1),
      runAt('Tests', '2026-10-18T11:00:00Z', 'completed', 'success', 2),
      runAt('Live backend', '2026-10-18T10:00:00Z', 'completed', 'success', 3)
    ]
    expect(runsVerdict(runs)).toEqual({ state: 'green', detail: 'Tests 2, Live backend 3' })
  })

  it('is red when the newest run of either failed or was cancelled, even if an older one passed', () => {
    const runs = [
      runAt('Tests', '2026-10-18T10:00:00Z', 'completed', 'success', 1),
      runAt('Tests', '2026-10-18T11:00:00Z', 'completed', 'cancelled', 2),
      runAt('Live backend', '2026-10-18T10:00:00Z', 'in_progress', '', 3)
    ]
    expect(runsVerdict(runs)).toEqual({ state: 'red', detail: 'Tests 2 cancelled' })
  })

  it('names a workflow with no run on the commit as missing', () => {
    const runs = [runAt('Tests', '2026-10-18T10:00:00Z', 'completed', 'success')]
    expect(runsVerdict(runs)).toEqual({ state: 'missing', missing: ['Live backend'] })
  })

  it('is pending while a run is queued or in progress', () => {
    const runs = [
      runAt('Tests', '2026-10-18T10:00:00Z', 'queued', ''),
      runAt('Live backend', '2026-10-18T10:00:00Z', 'completed', 'success')
    ]
    expect(runsVerdict(runs)).toEqual({ state: 'pending', detail: 'Tests' })
  })

  it('ignores other workflows', () => {
    const runs = [
      runAt('Deploy web', '2026-10-18T12:00:00Z', 'completed', 'failure'),
      runAt('Tests', '2026-10-18T10:00:00Z', 'completed', 'success'),
      runAt('Live backend', '2026-10-18T10:00:00Z', 'completed', 'success')
    ]
    expect(runsVerdict(runs).state).toBe('green')
  })
})

describe('docsOnly', () => {
  it('accepts no change and changes under docs/ only', () => {
    expect(docsOnly([])).toBe(true)
    expect(docsOnly(['docs/roadmap/08-phase-ledger.json', 'docs/handoffs/x.md'])).toBe(true)
  })

  it('rejects any change outside docs/', () => {
    expect(docsOnly(['docs/roadmap/08-phase-ledger.json', 'AGENTS.md'])).toBe(false)
    expect(docsOnly(['apps/docs/readme.md'])).toBe(false)
  })
})

describe('validateInputs', () => {
  const valid = {
    branch: 'ci/spells-4-t1a',
    sha: 'a'.repeat(40),
    title: 'Merge SPELLS-4.T1a: zones',
    target: 'codex/phase-08-2-convex-cutover',
    batchPrefix: 'ci/merge-m'
  }

  it('accepts a slice branch, a full SHA and a phase target', () => {
    expect(() => validateInputs(valid)).not.toThrow()
  })

  it.each([
    ['a non-ci branch', { branch: 'codex/phase-08-2-convex-cutover' }],
    ['a merge batch as the slice', { branch: 'ci/merge-m114' }],
    [
      'a batch under a custom prefix as the slice',
      { branch: 'ci/p25-merge-m2', batchPrefix: 'ci/p25-merge-m' }
    ],
    ['an abbreviated SHA', { sha: 'abc1234' }],
    ['an empty title', { title: '  ' }],
    ['main as the target', { target: 'main' }],
    ['a ci branch as the target', { target: 'ci/p25-target' }],
    ['a batch prefix outside ci/', { batchPrefix: 'merge-m' }],
    ['a batch prefix ending in a digit', { batchPrefix: 'ci/merge-m1' }]
  ])('refuses %s', (_, change) => {
    expect(() => validateInputs({ ...valid, ...change })).toThrow(MergeRefused)
  })
})
