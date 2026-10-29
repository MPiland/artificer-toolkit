import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  docsOnly,
  mergeSizeBudgets,
  mergeSlice,
  parseSlices,
  READ_TRIES,
  MergeRefused,
  nextMergeNumber,
  runsVerdict,
  validateInputs,
  WORKFLOWS
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
      runAt('Tests', '2026-10-18T11:00:00Z', 'completed', 'failure', 2),
      runAt('Live backend', '2026-10-18T10:00:00Z', 'in_progress', '', 3)
    ]
    expect(runsVerdict(runs)).toEqual({ state: 'red', detail: 'Tests 2 failure' })
  })

  it('ignores a cancelled duplicate created after a green run of the same workflow', () => {
    const runs = [
      runAt('Tests', '2026-10-21T10:00:00Z', 'completed', 'success', 1),
      runAt('Tests', '2026-10-21T10:05:00Z', 'completed', 'cancelled', 2),
      runAt('Live backend', '2026-10-21T10:00:00Z', 'completed', 'success', 3),
      runAt('Live backend', '2026-10-21T10:05:00Z', 'completed', 'cancelled', 4)
    ]
    expect(runsVerdict(runs)).toEqual({ state: 'green', detail: 'Tests 1, Live backend 3' })
  })

  it('is red when a workflow has only cancelled runs', () => {
    const runs = [
      runAt('Tests', '2026-10-21T10:00:00Z', 'completed', 'cancelled', 1),
      runAt('Tests', '2026-10-21T10:05:00Z', 'completed', 'cancelled', 2),
      runAt('Live backend', '2026-10-21T10:00:00Z', 'completed', 'success', 3)
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

  describe('Browser journeys gate only where they ran (RELIABILITY-20.2)', () => {
    const green = [
      runAt('Tests', '2026-10-27T10:00:00Z', 'completed', 'success', 1),
      runAt('Live backend', '2026-10-27T10:00:00Z', 'completed', 'success', 2)
    ]

    it('is green without a browser run', () => {
      expect(runsVerdict(green)).toEqual({ state: 'green', detail: 'Tests 1, Live backend 2' })
    })

    it('counts a green browser run', () => {
      const runs = [
        ...green,
        runAt('Browser journeys', '2026-10-27T10:00:00Z', 'completed', 'success', 3)
      ]
      expect(runsVerdict(runs)).toEqual({
        state: 'green',
        detail: 'Tests 1, Live backend 2, Browser journeys 3'
      })
    })

    it('is red when any browser run failed, even under a newer green dispatch', () => {
      const runs = [
        ...green,
        runAt('Browser journeys', '2026-10-27T10:00:00Z', 'completed', 'failure', 3),
        runAt('Browser journeys', '2026-10-27T11:00:00Z', 'completed', 'success', 4)
      ]
      expect(runsVerdict(runs)).toEqual({ state: 'red', detail: 'Browser journeys 3 failure' })
    })

    it('waits for a browser run in progress', () => {
      const runs = [
        ...green,
        runAt('Browser journeys', '2026-10-27T10:00:00Z', 'in_progress', '', 3)
      ]
      expect(runsVerdict(runs)).toEqual({ state: 'pending', detail: 'Browser journeys' })
    })

    it('ignores a cancelled duplicate beside a green browser run, but not a lone cancelled one', () => {
      const cancelled = runAt(
        'Browser journeys',
        '2026-10-27T11:00:00Z',
        'completed',
        'cancelled',
        4
      )
      const passed = runAt('Browser journeys', '2026-10-27T10:00:00Z', 'completed', 'success', 3)
      expect(runsVerdict([...green, passed, cancelled]).state).toBe('green')
      expect(runsVerdict([...green, cancelled])).toEqual({
        state: 'red',
        detail: 'Browser journeys 4 cancelled'
      })
    })
  })

  // RELIABILITY-21.19: a merge batch requires Browser journeys like Tests and Live.
  describe('requiring Browser journeys on a batch', () => {
    const all = Object.keys(WORKFLOWS)
    const green = [
      runAt('Tests', '2026-10-28T10:00:00Z', 'completed', 'success', 1),
      runAt('Live backend', '2026-10-28T10:00:00Z', 'completed', 'success', 2)
    ]

    it('is missing without a browser run', () => {
      expect(runsVerdict(green, all)).toEqual({ state: 'missing', missing: ['Browser journeys'] })
    })

    it('counts the newest browser run once', () => {
      const runs = [
        ...green,
        runAt('Browser journeys', '2026-10-28T10:00:00Z', 'completed', 'failure', 3),
        runAt('Browser journeys', '2026-10-28T11:00:00Z', 'completed', 'success', 4)
      ]
      expect(runsVerdict(runs, all)).toEqual({
        state: 'green',
        detail: 'Tests 1, Live backend 2, Browser journeys 4'
      })
    })
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

describe('mergeSizeBudgets', () => {
  it('takes the lower cap of the two sides per entry', () => {
    const base = { 'a.ts': 1700, 'b.ts': 1700 }
    expect(
      mergeSizeBudgets(base, { 'a.ts': 1600, 'b.ts': 1700 }, { 'a.ts': 1650, 'b.ts': 1680 })
    ).toEqual({ 'a.ts': 1600, 'b.ts': 1680 })
  })

  it('keeps an entry removed when either side removed it', () => {
    const base = { 'a.ts': 1700, 'b.ts': 1700 }
    expect(mergeSizeBudgets(base, { 'b.ts': 1650 }, { 'a.ts': 1600, 'b.ts': 1700 })).toEqual({
      'b.ts': 1650
    })
  })

  it('keeps the union of entries the base did not have, leaving new entries to the ratchet', () => {
    expect(mergeSizeBudgets({}, { 'a.ts': 1600 }, { 'b.ts': 1650 })).toEqual({
      'a.ts': 1600,
      'b.ts': 1650
    })
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

describe('mergeSlice waiting on dispatched runs', () => {
  const PHASE = 'phase'
  const input = (sha) => ({
    branch: 'ci/slice-a',
    sha,
    title: 'Merge A',
    target: PHASE,
    batchPrefix: 'ci/merge-m'
  })
  const gitEnv = {
    ...process.env,
    GIT_AUTHOR_NAME: 't',
    GIT_AUTHOR_EMAIL: 't@t',
    GIT_COMMITTER_NAME: 't',
    GIT_COMMITTER_EMAIL: 't@t'
  }
  const sh = (cwd, ...args) => {
    const result = spawnSync('git', args, { cwd, encoding: 'utf8', env: gitEnv })
    if (result.status !== 0) throw new Error(`git ${args.join(' ')}: ${result.stderr}`)
    return result.stdout.trim()
  }

  // A bare origin with a phase branch and ci/slice-a one docs commit ahead of it, plus a working clone.
  const repo = () => {
    const root = mkdtempSync(join(tmpdir(), 'merge-slice-'))
    const origin = join(root, 'origin.git')
    const work = join(root, 'work')
    sh(root, 'init', '--bare', '--initial-branch', PHASE, origin)
    sh(root, 'clone', origin, work)
    writeFileSync(join(work, 'base.txt'), 'base')
    sh(work, 'add', '.')
    sh(work, 'commit', '-m', 'base')
    sh(work, 'push', 'origin', `HEAD:refs/heads/${PHASE}`)
    sh(work, 'switch', '-c', 'ci/slice-a')
    mkdirSync(join(work, 'docs'))
    writeFileSync(join(work, 'docs', 'a.md'), 'a')
    sh(work, 'add', '.')
    sh(work, 'commit', '-m', 'slice a')
    sh(work, 'push', 'origin', 'ci/slice-a')
    return { work, tip: sh(work, 'rev-parse', 'HEAD'), origin }
  }

  // Fakes only the platform: gh, the clock and sleep. The commit-filtered listing never shows a run,
  // as in the three refused merges; dispatched runs are only reachable by id or a branch listing.
  const platform = (
    work,
    {
      printUrl = true,
      conclusion = 'success',
      finishAfterPolls = 2,
      commitRuns = [],
      emptyCommitListings = Infinity,
      failReads = []
    } = {}
  ) => {
    const calls = []
    const runs = new Map()
    let clock = 0
    let nextId = 1000
    let commitListings = 0
    const view = (id) => {
      const state = runs.get(id)
      state.polls += 1
      const done = state.polls >= finishAfterPolls
      return {
        databaseId: Number(id),
        workflowName: state.name,
        createdAt: new Date(state.at).toISOString(),
        status: done ? 'completed' : 'in_progress',
        conclusion: done
          ? typeof conclusion === 'function'
            ? conclusion(state.ref, state.name)
            : conclusion
          : ''
      }
    }
    const gh = (args) => {
      calls.push(args.join(' '))
      if (args[0] === 'run' && args[1] === 'list' && args[2] === '--commit') {
        commitListings += 1
        return JSON.stringify(commitListings > emptyCommitListings ? commitRuns : [])
      }
      if (args[0] === 'workflow') {
        const id = String(nextId++)
        const name = Object.entries(WORKFLOWS).find(([, file]) => file === args[2])[0]
        runs.set(id, { name, at: clock, polls: 0, ref: args[args.indexOf('--ref') + 1] })
        return printUrl ? `https://github.com/o/r/actions/runs/${id}` : ''
      }
      if (args[0] === 'run' && args[1] === 'view') return JSON.stringify(view(args[2]))
      if (args[0] === 'run' && args[1] === 'list') {
        const workflow = args[3]
        return JSON.stringify(
          [...runs.keys()]
            .filter((id) => WORKFLOWS[runs.get(id).name] === workflow)
            .map((id) => view(id))
        )
      }
      throw new Error(`unexpected gh ${args.join(' ')}`)
    }
    // failReads: stderr texts returned, in order, by the next gh reads (list/view) before they succeed.
    const ghResult = (args) =>
      args[0] === 'run' && failReads.length > 0
        ? { status: 1, stdout: '', stderr: failReads.shift() }
        : { status: 0, stdout: gh(args), stderr: '' }
    const tools = {
      run: (command, args) =>
        command === 'gh'
          ? ghResult(args)
          : spawnSync('git', args, { cwd: work, encoding: 'utf8', env: gitEnv }),
      sleep: async (ms) => {
        clock += ms
      },
      now: () => clock,
      log: () => {}
    }
    return { tools, calls }
  }

  it('waits on the runs it dispatched by id when the commit listing never shows them', async () => {
    const { work, tip, origin } = repo()
    const { tools, calls } = platform(work)
    await mergeSlice(input(tip), tools)
    expect(calls.some((call) => call.startsWith('run view 1000'))).toBe(true)
    expect(sh(origin, 'rev-parse', PHASE)).not.toBe(sh(origin, 'rev-parse', 'ci/slice-a'))
    expect(sh(origin, 'log', '-1', '--format=%P', PHASE)).toContain(tip)
  })

  it('dispatches every workflow, browser journeys included, as the fast-path backstop', async () => {
    const { work, tip } = repo()
    const { tools, calls } = platform(work)
    await mergeSlice(input(tip), tools)
    expect(calls.filter((call) => call.includes('--ref ci/merge-m1'))).toEqual(
      Object.values(WORKFLOWS).map((file) => `workflow run ${file} --ref ci/merge-m1`)
    )
  })

  it('treats an empty commit listing as unknown and does not dispatch runs that exist', async () => {
    const { work, tip } = repo()
    const green = (workflowName, databaseId) => ({
      workflowName,
      databaseId,
      status: 'completed',
      conclusion: 'success',
      createdAt: '2026-10-22T10:00:00Z'
    })
    const { tools, calls } = platform(work, {
      emptyCommitListings: 1,
      commitRuns: [green('Tests', 1), green('Live backend', 2)]
    })
    await mergeSlice(input(tip), tools)
    expect(
      calls.filter((call) => call.startsWith('workflow run') && call.includes('ci/slice-a'))
    ).toEqual([])
  })

  describe('Browser journeys on the slice tip (RELIABILITY-20.2)', () => {
    const run = (workflowName, databaseId, conclusion) => ({
      workflowName,
      databaseId,
      status: 'completed',
      conclusion,
      createdAt: '2026-10-27T10:00:00Z'
    })
    const testsAndLive = [run('Tests', 1, 'success'), run('Live backend', 2, 'success')]
    const merge = async (commitRuns) => {
      const { work, tip, origin } = repo()
      const before = sh(origin, 'rev-parse', PHASE)
      const { tools, calls } = platform(work, { emptyCommitListings: 0, commitRuns })
      const outcome = await mergeSlice(input(tip), tools).catch((error) => error)
      return { outcome, calls, tip, phase: sh(origin, 'rev-parse', PHASE), before, origin }
    }

    it('refuses a tip whose browser run is red, pushing nothing', async () => {
      const { outcome, phase, before } = await merge([
        ...testsAndLive,
        run('Browser journeys', 3, 'failure')
      ])
      expect(outcome).toBeInstanceOf(MergeRefused)
      expect(outcome.message).toMatch(/Not green.*Browser journeys 3 failure/)
      expect(phase).toBe(before)
    })

    it('merges a tip whose browser run is green', async () => {
      const { outcome, origin, tip } = await merge([
        ...testsAndLive,
        run('Browser journeys', 3, 'success')
      ])
      expect(outcome).toBeUndefined()
      expect(sh(origin, 'log', '-1', '--format=%P', PHASE)).toContain(tip)
    })

    it('merges a tip with no browser run without dispatching one', async () => {
      const { outcome, origin, tip, calls } = await merge(testsAndLive)
      expect(outcome).toBeUndefined()
      expect(sh(origin, 'log', '-1', '--format=%P', PHASE)).toContain(tip)
      // The fast path's batch backstop dispatches every journey; the slice tip gets none.
      expect(
        calls.filter((call) => call.includes('browser-journeys.yml') && call.includes('ci/slice-a'))
      ).toEqual([])
    })
  })

  it('finds a dispatched run by branch listing when gh prints no run URL', async () => {
    const { work, tip, origin } = repo()
    const { tools } = platform(work, { printUrl: false })
    await mergeSlice(input(tip), tools)
    expect(sh(origin, 'log', '-1', '--format=%P', PHASE)).toContain(tip)
  })

  it('refuses a dispatched run that finished red, pushing nothing to the phase branch', async () => {
    const { work, tip, origin } = repo()
    const before = sh(origin, 'rev-parse', PHASE)
    const { tools } = platform(work, { conclusion: 'failure' })
    await expect(mergeSlice(input(tip), tools)).rejects.toThrow(/Not green.*failure/)
    expect(sh(origin, 'rev-parse', PHASE)).toBe(before)
  })

  it('refuses at the overall timeout when a dispatched run never finishes', async () => {
    const { work, tip } = repo()
    const { tools } = platform(work, { finishAfterPolls: Infinity })
    await expect(mergeSlice(input(tip), tools)).rejects.toThrow(/did not finish/)
  })

  // Real gh stderr from the failed merge runs m470 (HTTP 500) and m472 (HTTP 504).
  const HTTP_500 =
    'failed to get run: HTTP 500 (https://api.github.com/repos/MPiland/artificer-toolkit/actions/workflows/367981974)'
  const HTTP_504 = "failed to get run: HTTP 504: We couldn't respond to your request in time."

  it.each([HTTP_500, HTTP_504])(
    'retries a transient GitHub error and still merges: %s',
    async (stderr) => {
      const { work, tip, origin } = repo()
      const failReads = [stderr]
      const { tools } = platform(work, { failReads })
      await mergeSlice(input(tip), tools)
      expect(failReads).toHaveLength(0)
      expect(sh(origin, 'log', '-1', '--format=%P', PHASE)).toContain(tip)
    }
  )

  it('fails with the error after exactly READ_TRIES attempts when a 5xx persists', async () => {
    const { work, tip, origin } = repo()
    const before = sh(origin, 'rev-parse', PHASE)
    const failReads = Array(READ_TRIES + 5).fill(HTTP_500)
    const { tools } = platform(work, { failReads })
    await expect(mergeSlice(input(tip), tools)).rejects.toThrow(/HTTP 500/)
    expect(READ_TRIES + 5 - failReads.length).toBe(READ_TRIES)
    expect(sh(origin, 'rev-parse', PHASE)).toBe(before)
  })

  it('fails at once on a 4xx with a single attempt', async () => {
    const { work, tip } = repo()
    const failReads = Array(READ_TRIES).fill('failed to get run: HTTP 404: Not Found')
    const { tools } = platform(work, { failReads })
    await expect(mergeSlice(input(tip), tools)).rejects.toThrow(/HTTP 404/)
    expect(failReads).toHaveLength(READ_TRIES - 1)
  })

  describe('batching several slices', () => {
    // Adds ci/slice-<name> off the phase branch with one file; reusing a file name forces a conflict.
    const addSlice = (work, name, file, content) => {
      sh(work, 'switch', '-q', '-c', `ci/slice-${name}`, `origin/${PHASE}`)
      writeFileSync(join(work, file), content)
      sh(work, 'add', '.')
      sh(work, 'commit', '-m', `slice ${name}`)
      sh(work, 'push', '-q', 'origin', `ci/slice-${name}`)
      return { branch: `ci/slice-${name}`, sha: sh(work, 'rev-parse', 'HEAD') }
    }
    const batchInput = (slices) => ({
      slices,
      title: 'Merge batch',
      target: PHASE,
      batchPrefix: 'ci/merge-m'
    })
    const three = () => {
      const { work, origin } = repo()
      const slices = [
        addSlice(work, 'b', 'b.txt', 'b'),
        addSlice(work, 'c', 'c.txt', 'c'),
        addSlice(work, 'd', 'd.txt', 'd')
      ]
      return { work, origin, slices, before: sh(origin, 'rev-parse', PHASE) }
    }

    it('merges three slices in order into one batch commit and moves the phase branch once', async () => {
      const { work, origin, slices, before } = three()
      const { tools, calls } = platform(work)
      await mergeSlice(batchInput(slices), tools)
      const phase = sh(origin, 'rev-parse', PHASE)
      expect(phase).toBe(sh(origin, 'rev-parse', 'ci/merge-m1'))
      expect(sh(origin, 'ls-tree', '--name-only', phase).split('\n')).toEqual(
        expect.arrayContaining(['b.txt', 'c.txt', 'd.txt'])
      )
      const merged = sh(origin, 'log', '--first-parent', '--format=%P', `${before}..${phase}`)
        .split('\n')
        .map((parents) => parents.split(' ')[1])
      expect(merged).toEqual(slices.map((slice) => slice.sha).reverse())
      // Tests, Live and every browser journey run once on the batch commit (RELIABILITY-21.19).
      expect(calls.filter((call) => call.includes('--ref ci/merge-m1'))).toEqual(
        Object.values(WORKFLOWS).map((file) => `workflow run ${file} --ref ci/merge-m1`)
      )
    })

    it('refuses the whole batch on a conflict, naming the slice and pushing nothing', async () => {
      const { work, origin, slices, before } = three()
      slices.push(addSlice(work, 'e', 'b.txt', 'conflicting'))
      const { tools } = platform(work)
      await expect(mergeSlice(batchInput(slices), tools)).rejects.toThrow(
        /ci\/slice-e: .*conflicts/
      )
      expect(sh(origin, 'rev-parse', PHASE)).toBe(before)
      expect(sh(origin, 'branch', '--list', 'ci/merge-m*')).toBe('')
    })

    it('refuses the whole batch when a tip moved, naming the slice', async () => {
      const { work, origin, slices, before } = three()
      sh(work, 'switch', '-q', slices[1].branch)
      writeFileSync(join(work, 'late.txt'), 'late')
      sh(work, 'add', '.')
      sh(work, 'commit', '-m', 'late')
      sh(work, 'push', '-q', 'origin', slices[1].branch)
      const { tools } = platform(work)
      await expect(mergeSlice(batchInput(slices), tools)).rejects.toThrow(/ci\/slice-c is not at/)
      expect(sh(origin, 'rev-parse', PHASE)).toBe(before)
    })

    it('refuses the whole batch when one slice is red, naming it and pushing nothing', async () => {
      const { work, origin, slices, before } = three()
      const { tools } = platform(work, {
        conclusion: (ref) => (ref === 'ci/slice-d' ? 'failure' : 'success')
      })
      await expect(mergeSlice(batchInput(slices), tools)).rejects.toThrow(/ci\/slice-d: Not green/)
      expect(sh(origin, 'rev-parse', PHASE)).toBe(before)
      expect(sh(origin, 'branch', '--list', 'ci/merge-m*')).toBe('')
    })

    it('leaves the phase branch alone when the batch commit goes red', async () => {
      const { work, origin, slices, before } = three()
      const { tools } = platform(work, {
        conclusion: (ref) => (ref.startsWith('ci/merge-m') ? 'failure' : 'success')
      })
      await expect(mergeSlice(batchInput(slices), tools)).rejects.toThrow(/Not green/)
      expect(sh(origin, 'rev-parse', PHASE)).toBe(before)
    })

    it('refuses a batch whose browser journeys go red, naming the run and slices to trace', async () => {
      const { work, origin, slices, before } = three()
      const { tools, calls } = platform(work, {
        conclusion: (ref) => (ref.startsWith('ci/merge-m') ? 'failure' : 'success')
      })
      const journeys = calls.length
      const refusal = await mergeSlice(batchInput(slices), tools).catch((error) => error)
      expect(refusal).toBeInstanceOf(MergeRefused)
      const dispatched = calls
        .slice(journeys)
        .filter((call) => call.startsWith('workflow run browser-journeys.yml --ref ci/merge-m1'))
      expect(dispatched).toHaveLength(1)
      expect(refusal.trace).toEqual({
        run: expect.stringMatching(/^\d+$/),
        slices: slices.map((slice) => slice.branch)
      })
      expect(refusal.message).toContain(`Browser journeys ${refusal.trace.run} failure`)
      expect(sh(origin, 'rev-parse', PHASE)).toBe(before)
    })

    it('names nothing to trace when only Tests goes red on the batch', async () => {
      const { work, slices } = three()
      const { tools } = platform(work, {
        conclusion: (ref, name) =>
          ref.startsWith('ci/merge-m') && name === 'Tests' ? 'failure' : 'success'
      })
      const refusal = await mergeSlice(batchInput(slices), tools).catch((error) => error)
      expect(refusal).toBeInstanceOf(MergeRefused)
      expect(refusal.trace).toBeNull()
    })

    it('refuses a slice named twice', async () => {
      const { work, slices } = three()
      const { tools } = platform(work)
      await expect(mergeSlice(batchInput([slices[0], slices[0]]), tools)).rejects.toThrow(
        /named twice/
      )
    })
  })

  describe('size-budget conflicts', () => {
    const BUDGET = 'scripts/fileSizeBudget.json'
    // Distinct code lines from..to-1, so deletions in different places of one module merge cleanly.
    const module = (name, from, to) =>
      Array.from({ length: to - from }, (_, i) => `export const ${name}${from + i} = 1\n`).join('')
    const budget = (caps) => `${JSON.stringify(caps, null, 2)}\n`
    const commit = (work, files, label) => {
      for (const [file, content] of Object.entries(files)) writeFileSync(join(work, file), content)
      sh(work, 'add', '.')
      sh(work, 'commit', '-q', '-m', label)
    }
    // The phase branch lists two 1700-line modules; ci/slice-a, synced with it, and then the phase
    // branch each commit one change, as two concurrently merged slices do.
    const diverge = (sliceFiles, phaseFiles) => {
      const { work, origin } = repo()
      sh(work, 'switch', '-q', '-c', 'phase-work', `origin/${PHASE}`)
      mkdirSync(join(work, 'apps'))
      mkdirSync(join(work, 'scripts'))
      commit(
        work,
        {
          'apps/a.ts': module('a', 0, 1700),
          'apps/b.ts': module('b', 0, 1700),
          'other.txt': 'base\n',
          [BUDGET]: budget({ 'apps/a.ts': 1700, 'apps/b.ts': 1700 }),
          'scripts/systemsImportAllowlist.json': '{ "compositionRoots": {}, "importers": [] }\n'
        },
        'listed modules'
      )
      sh(work, 'push', '-q', 'origin', `HEAD:${PHASE}`)
      sh(work, 'switch', '-q', 'ci/slice-a')
      sh(work, 'merge', '-q', '--no-edit', 'phase-work')
      commit(work, sliceFiles, 'slice shrinks a module')
      sh(work, 'push', '-q', 'origin', 'ci/slice-a')
      const tip = sh(work, 'rev-parse', 'HEAD')
      sh(work, 'switch', '-q', 'phase-work')
      commit(work, phaseFiles, 'phase shrinks a module')
      sh(work, 'push', '-q', 'origin', `HEAD:${PHASE}`)
      return { work, origin, tip, before: sh(origin, 'rev-parse', PHASE) }
    }
    const shrinkA = {
      'apps/a.ts': module('a', 100, 1700),
      [BUDGET]: budget({ 'apps/a.ts': 1600, 'apps/b.ts': 1700 })
    }

    it('takes the lower cap per entry and lands the merge once the merged tree passes the ratchets', async () => {
      const { work, origin, tip, before } = diverge(shrinkA, {
        'apps/b.ts': module('b', 0, 1650),
        [BUDGET]: budget({ 'apps/a.ts': 1700, 'apps/b.ts': 1650 })
      })
      const { tools } = platform(work)
      const logs = []
      await mergeSlice(input(tip), { ...tools, log: (message) => logs.push(message) })
      expect(logs).toContain(`Resolved the ${BUDGET} conflict with ${before} to the lower caps.`)
      const phase = sh(origin, 'rev-parse', PHASE)
      expect(phase).toBe(sh(origin, 'rev-parse', 'ci/merge-m1'))
      expect(sh(origin, 'log', '-1', '--format=%P', phase).split(' ')[0]).toBe(tip)
      expect(JSON.parse(sh(origin, 'show', `${phase}:${BUDGET}`))).toEqual({
        'apps/a.ts': 1600,
        'apps/b.ts': 1650
      })
    })

    it('lowers a cap to the merged size when both sides shrank the module (RELIABILITY-19.2)', async () => {
      // Both sides shrink apps/a.ts in different places: the module merges to 1550 lines, under
      // either cap, so the lower cap comes down to 1550.
      const { work, origin, tip, before } = diverge(shrinkA, {
        'apps/a.ts': module('a', 0, 1650),
        [BUDGET]: budget({ 'apps/a.ts': 1650, 'apps/b.ts': 1700 })
      })
      const { tools } = platform(work)
      const logs = []
      await mergeSlice(input(tip), { ...tools, log: (message) => logs.push(message) })
      expect(logs).toContain(
        `Resolved the ${BUDGET} conflict with ${before} to the lower caps; lowered apps/a.ts to its merged 1550 code lines.`
      )
      const phase = sh(origin, 'rev-parse', PHASE)
      expect(phase).toBe(sh(origin, 'rev-parse', 'ci/merge-m1'))
      expect(JSON.parse(sh(origin, 'show', `${phase}:${BUDGET}`))).toEqual({
        'apps/a.ts': 1550,
        'apps/b.ts': 1700
      })
    })

    it('refuses a merged module that grew past its resolved cap, pushing nothing', async () => {
      // The slice adds 50 lines to apps/a.ts (and raises its cap); the phase branch deletes 50. The
      // merge keeps 1700 lines over the lower cap of 1650, so nothing is lowered and the merge refuses.
      const { work, origin, tip, before } = diverge(
        {
          'apps/a.ts': module('x', 0, 50) + module('a', 0, 1700),
          [BUDGET]: budget({ 'apps/a.ts': 1750, 'apps/b.ts': 1700 })
        },
        {
          'apps/a.ts': module('a', 0, 1650),
          [BUDGET]: budget({ 'apps/a.ts': 1650, 'apps/b.ts': 1700 })
        }
      )
      const { tools } = platform(work)
      await expect(mergeSlice(input(tip), tools)).rejects.toThrow(
        /fails the source ratchets:\napps\/a\.ts: 1700 code lines, over its budget of 1650; split the module\.$/
      )
      expect(sh(origin, 'rev-parse', PHASE)).toBe(before)
      expect(sh(origin, 'branch', '--list', 'ci/merge-m*')).toBe('')
    })

    it('refuses any other ratchet problem in the merged tree, pushing nothing', async () => {
      // Both sides' deletions take apps/a.ts to 1450 lines, within the limit: its entry must go, which
      // lowering a cap does not do.
      const { work, origin, tip, before } = diverge(shrinkA, {
        'apps/a.ts': module('a', 0, 1550),
        [BUDGET]: budget({ 'apps/a.ts': 1550, 'apps/b.ts': 1700 })
      })
      const { tools } = platform(work)
      await expect(mergeSlice(input(tip), tools)).rejects.toThrow(
        /fails the source ratchets:\n.*apps\/a\.ts is 1450 code lines, within 1500; remove it\.$/
      )
      expect(sh(origin, 'rev-parse', PHASE)).toBe(before)
      expect(sh(origin, 'branch', '--list', 'ci/merge-m*')).toBe('')
    })

    it('refuses when another file conflicts too, naming both and pushing nothing', async () => {
      const { work, origin, tip, before } = diverge(
        { ...shrinkA, 'other.txt': 'slice\n' },
        {
          'apps/b.ts': module('b', 0, 1650),
          'other.txt': 'phase\n',
          [BUDGET]: budget({ 'apps/a.ts': 1700, 'apps/b.ts': 1650 })
        }
      )
      const { tools } = platform(work)
      const refusal = await mergeSlice(input(tip), tools).catch((error) => error)
      expect(refusal).toBeInstanceOf(MergeRefused)
      expect(refusal.message).toMatch(/conflicts:\n/)
      expect(refusal.message).toContain('other.txt')
      expect(refusal.message).toContain(BUDGET)
      expect(sh(origin, 'rev-parse', PHASE)).toBe(before)
      expect(sh(origin, 'branch', '--list', 'ci/merge-m*')).toBe('')
    })
  })

  describe('parseSlices', () => {
    const tip = 'a'.repeat(40)

    it('keeps a lone branch and sha as one slice', () => {
      expect(parseSlices({ branch: 'ci/a', sha: tip })).toEqual([{ branch: 'ci/a', sha: tip }])
    })

    it('splits branch@sha pairs on commas and whitespace, in order', () => {
      const slices = parseSlices({ slices: `ci/a@${tip}, ci/b@${tip}\nci/c@${tip}` })
      expect(slices.map((slice) => slice.branch)).toEqual(['ci/a', 'ci/b', 'ci/c'])
    })

    it.each([
      ['a bare branch', 'ci/a'],
      ['a pair with two @', `ci/a@${tip}@x`]
    ])('refuses %s', (_, slices) => {
      expect(() => parseSlices({ slices })).toThrow(MergeRefused)
    })

    it('refuses both forms at once', () => {
      expect(() => parseSlices({ branch: 'ci/a', sha: tip, slices: `ci/b@${tip}` })).toThrow(
        MergeRefused
      )
    })
  })
})
