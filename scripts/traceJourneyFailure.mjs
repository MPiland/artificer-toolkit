// Traces a browser journey that failed on a merge batch to the slice that broke it (RELIABILITY-21.19,
// docs/architecture/ci-validation.md#merge-batches). It reads the gating proofs that failed in the batch's
// Browser journeys run, dispatches exactly those proofs on each slice merged into the batch, and names the
// slices where they fail again; when every slice passes them alone, the combination broke them.
// merge-slice.yml runs it after a batch refusal; run it by hand for a red fast-path backstop.
//   node scripts/traceJourneyFailure.mjs --run <Browser journeys run id> --slices "ci/<a> ci/<b>"
import { pathToFileURL } from 'node:url'
import {
  dispatchRun,
  findDispatchedId,
  ghRead,
  POLL_MS,
  realTools,
  RUN_FIELDS
} from './mergeSlice.mjs'

// The slice runs take one shard each, about 25 minutes at most (docs/architecture/ci-validation.md#shards).
const WAIT_MS = 45 * 60_000

/** The gating proofs a run's failed-job log reports FAILED; known-bug proofs never gate. */
export function failedProofs(log) {
  const failed = [...log.matchAll(/\b([a-z0-9-]+-browser) FAILED in \d+ s(.*)$/gm)]
    .filter(([, , label]) => !label.includes('KNOWN-BUG'))
    .map(([, proof]) => proof)
  return [...new Set(failed)]
}

/** Names the slices whose runs failed the proofs, or the combination when each passed alone. */
export function traceVerdict(proofs, results) {
  const runs = (list) => list.map(({ branch, id }) => `${branch} (run ${id})`).join(', ')
  const unfinished = results.filter(({ conclusion }) => !conclusion)
  if (unfinished.length > 0)
    return `Trace incomplete: ${runs(unfinished)} did not finish within ${WAIT_MS / 60_000} minutes.`
  const broke = results.filter(({ conclusion }) => conclusion !== 'success')
  return broke.length > 0
    ? `${proofs.join(', ')} fail on ${runs(broke)}: that slice broke them.`
    : `${proofs.join(', ')} pass on every slice alone (${runs(results)}): the combination broke them.`
}

export async function traceJourneyFailure(tools, { run, slices }) {
  const proofs = failedProofs(await ghRead(tools, 'run', 'view', run, '--log-failed'))
  if (proofs.length === 0) return `Run ${run} failed no gating proof; nothing to trace.`
  const fields = ['-f', `proof=${proofs.join(' ')}`]
  const dispatched = slices.map((branch) => ({
    branch,
    ...dispatchRun(tools, branch, 'Browser journeys', fields)
  }))
  const deadline = tools.now() + WAIT_MS
  for (;;) {
    for (const entry of dispatched)
      entry.id ??= await findDispatchedId(tools, entry.branch, 'Browser journeys', entry.startedAt)
    const results = await Promise.all(
      dispatched.map(async ({ branch, id }) => {
        if (!id) return { branch, id: 'not found', conclusion: '' }
        const view = JSON.parse(await ghRead(tools, 'run', 'view', id, '--json', RUN_FIELDS))
        return { branch, id, conclusion: view.status === 'completed' ? view.conclusion : '' }
      })
    )
    if (results.every(({ conclusion }) => conclusion) || tools.now() > deadline)
      return traceVerdict(proofs, results)
    await tools.sleep(POLL_MS)
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2)
  const option = (name) => {
    const index = args.indexOf(name)
    return index >= 0 ? (args[index + 1] ?? '') : ''
  }
  const run = option('--run')
  const slices = option('--slices')
    .split(/[\s,]+/)
    .filter(Boolean)
  if (
    !/^\d+$/.test(run) ||
    slices.length === 0 ||
    !slices.every((slice) => /^ci\/[\w./-]+$/.test(slice))
  )
    throw new Error('Usage: --run <run id> --slices "ci/<a> ci/<b>"')
  traceJourneyFailure(realTools, { run, slices }).then(
    (verdict) => console.log(verdict),
    (error) => {
      console.error(error)
      process.exitCode = 1
    }
  )
}
