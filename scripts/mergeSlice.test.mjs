import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  docsOnly,
  mergeSlice,
  parseSlices,
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
    { printUrl = true, conclusion = 'success', finishAfterPolls = 2 } = {}
  ) => {
    const calls = []
    const runs = new Map()
    let clock = 0
    let nextId = 1000
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
            ? conclusion(state.ref)
            : conclusion
          : ''
      }
    }
    const gh = (args) => {
      calls.push(args.join(' '))
      if (args[0] === 'run' && args[1] === 'list' && args[2] === '--commit') return '[]'
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
    const tools = {
      run: (command, args) =>
        command === 'gh'
          ? { status: 0, stdout: gh(args), stderr: '' }
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
      // Tests and Live run once on the batch commit.
      expect(calls.filter((call) => call.includes('--ref ci/merge-m1'))).toHaveLength(2)
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

    it('refuses a slice named twice', async () => {
      const { work, slices } = three()
      const { tools } = platform(work)
      await expect(mergeSlice(batchInput([slices[0], slices[0]]), tools)).rejects.toThrow(
        /named twice/
      )
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
