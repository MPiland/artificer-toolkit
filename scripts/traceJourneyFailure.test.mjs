import { describe, expect, it } from 'vitest'
import { WORKFLOWS } from './mergeSlice.mjs'
import { failedProofs, traceJourneyFailure, traceVerdict } from './traceJourneyFailure.mjs'

// Lines as `gh run view --log-failed` prints them for run 40753133858.
const LOG = [
  "Journeys 5 of 5 on a throwaway stack\tRun the shard's proofs\t2026-10-28T19:30:09.8908569Z character-sheet-spells-browser passed in 101 s",
  "Journeys 5 of 5 on a throwaway stack\tRun the shard's proofs\t2026-10-28T19:32:42.4863307Z effects-browser FAILED in 153 s",
  "Journeys 4 of 5 on a throwaway stack\tRun the shard's proofs\t2026-10-28T19:28:59.7976694Z disarm-browser FAILED in 94 s",
  "Known bugs, not gating on a throwaway stack\tRun the shard's proofs\t2026-10-28T19:40:00.0000000Z vtt-browser FAILED in 300 s (KNOWN-BUG RELIABILITY-21.T16, not gating)",
  'Journeys 4 of 5 on a throwaway stack\tRun the shard\'s proofs\t2026-10-28T19:28:00.0000000Z   echo "$proof $result in $((SECONDS - started)) s$label"'
].join('\r\n')

describe('failedProofs', () => {
  it('reads the gating proofs that failed, skipping passes and known bugs', () => {
    expect(failedProofs(LOG)).toEqual(['effects-browser', 'disarm-browser'])
  })

  it('reads nothing from a log with no failed proof', () => {
    expect(
      failedProofs('Select browser journeys\tSelect\tError: --base <ref> is required')
    ).toEqual([])
  })
})

describe('traceVerdict', () => {
  const proofs = ['disarm-browser']

  it('names the slice whose run fails the proofs', () => {
    expect(
      traceVerdict(proofs, [
        { branch: 'ci/a-1-t1', id: '1', conclusion: 'success' },
        { branch: 'ci/b-1-t1', id: '2', conclusion: 'failure' }
      ])
    ).toBe('disarm-browser fail on ci/b-1-t1 (run 2): that slice broke them.')
  })

  it('blames the combination when every slice passes alone', () => {
    expect(
      traceVerdict(proofs, [
        { branch: 'ci/a-1-t1', id: '1', conclusion: 'success' },
        { branch: 'ci/b-1-t1', id: '2', conclusion: 'success' }
      ])
    ).toMatch(/pass on every slice alone .*: the combination broke them\.$/)
  })

  it('reports an unfinished run instead of a verdict', () => {
    expect(
      traceVerdict(proofs, [
        { branch: 'ci/a-1-t1', id: '1', conclusion: 'failure' },
        { branch: 'ci/b-1-t1', id: '2', conclusion: '' }
      ])
    ).toMatch(/^Trace incomplete: ci\/b-1-t1 \(run 2\) did not finish/)
  })
})

// Fakes only gh and the clock; the dispatch, polling and verdict are the real code.
describe('traceJourneyFailure', () => {
  const platform = (conclusionOf) => {
    const calls = []
    const runs = new Map()
    let clock = 0
    let nextId = 500
    const gh = (args) => {
      calls.push(args.join(' '))
      if (args[0] === 'run' && args[1] === 'view' && args[3] === '--log-failed') return LOG
      if (args[0] === 'workflow') {
        const id = String(nextId++)
        expect(args[2]).toBe(WORKFLOWS['Browser journeys'])
        runs.set(id, { ref: args[args.indexOf('--ref') + 1], polls: 0 })
        return `https://github.com/o/r/actions/runs/${id}`
      }
      if (args[0] === 'run' && args[1] === 'view') {
        const run = runs.get(args[2])
        run.polls += 1
        const done = run.polls >= 2
        return JSON.stringify({
          databaseId: Number(args[2]),
          workflowName: 'Browser journeys',
          createdAt: new Date(clock).toISOString(),
          status: done ? 'completed' : 'in_progress',
          conclusion: done ? conclusionOf(run.ref) : ''
        })
      }
      throw new Error(`unexpected gh ${args.join(' ')}`)
    }
    const tools = {
      run: (command, args) => ({ status: 0, stdout: gh(args), stderr: '' }),
      sleep: async (ms) => {
        clock += ms
      },
      now: () => clock,
      log: () => {}
    }
    return { tools, calls }
  }

  it('dispatches only the failed gating proofs on each slice and names the one that fails them', async () => {
    const { tools, calls } = platform((ref) => (ref === 'ci/b-1-t1' ? 'failure' : 'success'))
    const verdict = await traceJourneyFailure(tools, {
      run: '40753133858',
      slices: ['ci/a-1-t1', 'ci/b-1-t1']
    })
    expect(calls.filter((call) => call.startsWith('workflow run'))).toEqual([
      'workflow run browser-journeys.yml --ref ci/a-1-t1 -f proof=effects-browser disarm-browser',
      'workflow run browser-journeys.yml --ref ci/b-1-t1 -f proof=effects-browser disarm-browser'
    ])
    expect(verdict).toBe(
      'effects-browser, disarm-browser fail on ci/b-1-t1 (run 501): that slice broke them.'
    )
  })
})
