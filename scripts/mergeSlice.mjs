// Merges an approved, green ci/<slice> tip into the phase branch (.github/workflows/merge-slice.yml,
// docs/architecture/ci-validation.md#approved-merges). Everything it pushes is a plain push, so a branch
// that moved meanwhile rejects it; it never force-pushes and never pushes main.
//   node scripts/mergeSlice.mjs --branch ci/<slice> --sha <tip> --title "<title>"
//     (or --slices "ci/<a>@<tip>,ci/<b>@<tip>" for one batch) [--target <phase branch>] [--batch-prefix ci/merge-m]
// Fast path: when the phase branch changed nothing outside docs/ since the slice's merge base, the slice
// merges --no-ff onto the phase tip, the merge must differ from the slice tree in docs/ only (not at all
// when the slice contains the phase tip), and after the phase push the merge commit goes to
// <batch-prefix><N> as the full-run backstop. Otherwise the phase tip merges into the slice, goes to
// <batch-prefix><N>, and reaches the phase branch only once Tests and Live are green there: a fast-forward,
// or a --no-ff merge when the phase branch has moved by docs/ only meanwhile.
// A merge whose only conflict is scripts/fileSizeBudget.json takes the lower cap per entry, lowers a cap
// further to a module's merged size when the merge left it smaller, and commits once the merged tree
// passes the source ratchets.
import { spawnSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { ratchetProblems, shrunkCaps, SIZE_BUDGET } from './sourceRatchets.mjs'

export const WORKFLOWS = { Tests: 'tests.yml', 'Live backend': 'live-backend.yml' }
const TRAILER = 'Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>'
const POLL_MS = 60_000
// Overall wait for one set of runs; the workflow's own timeout is 120 minutes.
const WAIT_MS = 90 * 60_000
const DISPATCH_SKEW_MS = 60_000
const LISTING_TRIES = 4
const LISTING_RETRY_MS = 5_000

export class MergeRefused extends Error {}

// One more than the highest <prefix><N> branch; refs are full `refs/heads/…` names.
export function nextMergeNumber(refs, prefix) {
  const head = `refs/heads/${prefix}`
  const numbers = refs
    .filter((ref) => ref.startsWith(head) && /^\d+$/.test(ref.slice(head.length)))
    .map((ref) => Number(ref.slice(head.length)))
  return Math.max(0, ...numbers) + 1
}

// The newest run per required workflow on one commit (a re-dispatch supersedes an older run).
// 'green' needs every workflow completed with success; any other completed conclusion is 'red'.
// A cancelled run is a duplicate superseded by a push or dispatch, so it only counts when the
// workflow has no other run on the commit.
export function runsVerdict(runs, workflows = Object.keys(WORKFLOWS)) {
  const latest = workflows.map((name) => {
    const byNewest = runs
      .filter((run) => run.workflowName === name)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    return byNewest.find((run) => run.conclusion !== 'cancelled') ?? byNewest[0]
  })
  const missing = workflows.filter((_, index) => !latest[index])
  const red = latest.filter((run) => run?.status === 'completed' && run.conclusion !== 'success')
  if (red.length > 0)
    return {
      state: 'red',
      detail: red.map((run) => `${run.workflowName} ${run.databaseId} ${run.conclusion}`).join(', ')
    }
  const pending = latest.filter((run) => run && run.status !== 'completed')
  if (missing.length > 0) return { state: 'missing', missing }
  if (pending.length > 0)
    return { state: 'pending', detail: pending.map((run) => run.workflowName).join(', ') }
  return {
    state: 'green',
    detail: latest.map((run) => `${run.workflowName} ${run.databaseId}`).join(', ')
  }
}

// Tests select nothing outside the source roots, and no test reads docs/, so a docs-only phase move
// cannot change what a green run proved.
export const docsOnly = (paths) => paths.every((path) => path.startsWith('docs/'))

// One dispatch names `--slices "ci/a@<sha>,ci/b@<sha>"` (comma or whitespace separated); a lone
// --branch/--sha pair is the single-slice form.
export function parseSlices({ branch = '', sha = '', slices = '' }) {
  const listed = slices.split(/[\s,]+/).filter(Boolean)
  if (listed.length === 0) return [{ branch, sha }]
  if (branch || sha) throw new MergeRefused('Name either branch and sha or slices, not both.')
  return listed.map((pair) => {
    const [name = '', tip = '', ...rest] = pair.split('@')
    if (!tip || rest.length > 0) throw new MergeRefused(`${pair} is not <branch>@<sha>.`)
    return { branch: name, sha: tip }
  })
}

export function validateInputs({ branch, sha, title, target, batchPrefix }) {
  if (
    !/^ci\/[\w./-]+$/.test(branch) ||
    branch.startsWith('ci/merge-') ||
    branch.startsWith(batchPrefix)
  )
    throw new MergeRefused(`${branch} is not a ci/<slice> branch.`)
  if (!/^[0-9a-f]{40}$/.test(sha))
    throw new MergeRefused('The tip must be a full 40-character SHA.')
  if (!title.trim()) throw new MergeRefused('A merge title is required.')
  if (!target || target === 'main' || target.startsWith('ci/'))
    throw new MergeRefused(`${target || '(empty)'} cannot be the target branch.`)
  if (!/^ci\/[\w./-]*[^\d/]$/.test(batchPrefix))
    throw new MergeRefused(`${batchPrefix} is not a ci/ batch prefix.`)
}

const realRun = (command, args) => {
  const result = spawnSync(command, args, { encoding: 'utf8', shell: false, windowsHide: true })
  if (result.error) throw result.error
  return result
}

// Everything that touches git, gh or the clock goes through `tools`, so tests fake the platform and run
// this logic for real.
export const realTools = {
  run: realRun,
  sleep: (ms) => new Promise((done) => setTimeout(done, ms)),
  now: () => Date.now(),
  log: (message) => console.log(message)
}

const git = (tools, ...args) => {
  const result = tools.run('git', args)
  if (result.status !== 0) throw new Error(`git ${args.join(' ')} failed:\n${result.stderr}`)
  return result.stdout.trim()
}

const gh = (tools, ...args) => {
  const result = tools.run('gh', args)
  if (result.status !== 0) throw new Error(`gh ${args.join(' ')} failed:\n${result.stderr}`)
  return result.stdout.trim()
}

const lines = (text) => text.split('\n').filter(Boolean)

const remoteSha = (tools, branch) =>
  git(tools, 'ls-remote', 'origin', `refs/heads/${branch}`).split('\t')[0] || null

const RUN_FIELDS = 'databaseId,workflowName,status,conclusion,createdAt'

// GitHub's filtered run listings (`--commit`, `--branch`) intermittently return nothing for runs that
// exist (3 of 10 back-to-back calls in a measurement), so an empty listing is unknown, not missing:
// it is retried, and only a listing that stays empty counts as empty.
async function listRuns(tools, ...args) {
  for (let attempt = 1; ; attempt += 1) {
    const listed = JSON.parse(gh(tools, 'run', 'list', ...args, '--json', RUN_FIELDS))
    if (listed.length > 0 || attempt === LISTING_TRIES) return listed
    await tools.sleep(LISTING_RETRY_MS)
  }
}

const runsOn = (tools, sha) => listRuns(tools, '--commit', sha, '--limit', '50')

// `gh workflow run` prints the created run's URL when GitHub returns it. Without a URL, the run is
// found by a branch-and-workflow listing (not the commit filter, which lagged past 5 minutes) among
// runs created after the dispatch.
const dispatchRun = (tools, branch, name) => {
  const startedAt = tools.now()
  const output = gh(tools, 'workflow', 'run', WORKFLOWS[name], '--ref', branch)
  tools.log(`Dispatched ${name} on ${branch}.`)
  return { startedAt, id: output.match(/\/actions\/runs\/(\d+)/)?.[1] ?? null }
}

async function findDispatchedId(tools, branch, name, startedAt) {
  const listed = await listRuns(
    tools,
    '--workflow',
    WORKFLOWS[name],
    '--branch',
    branch,
    '--event',
    'workflow_dispatch',
    '--limit',
    '20'
  )
  // GitHub timestamps have second resolution and the runner's clock may differ slightly.
  const created = listed
    .filter((run) => Date.parse(run.createdAt) >= startedAt - DISPATCH_SKEW_MS)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  return created[0] ? String(created[0].databaseId) : null
}

// Waits for Tests and Live to finish on `sha`. A workflow with no run is dispatched on `branch` once
// (Live is path-filtered, and a GITHUB_TOKEN push triggers nothing) and that run is then polled by its
// id; workflows the script did not dispatch are read from the commit listing. The caller has checked
// that `branch` points at `sha`.
async function waitForGreen(tools, sha, branch) {
  const dispatched = new Map()
  const deadline = tools.now() + WAIT_MS
  for (;;) {
    for (const [name, entry] of dispatched)
      entry.id ??= await findDispatchedId(tools, branch, name, entry.startedAt)
    const dispatchedRuns = [...dispatched.values()]
      .filter((entry) => entry.id)
      .map((entry) => JSON.parse(gh(tools, 'run', 'view', entry.id, '--json', RUN_FIELDS)))
    const listedRuns = (await runsOn(tools, sha)).filter((run) => !dispatched.has(run.workflowName))
    const verdict = runsVerdict([...listedRuns, ...dispatchedRuns])
    if (verdict.state === 'green') return tools.log(`Green on ${sha}: ${verdict.detail}.`)
    if (verdict.state === 'red') throw new MergeRefused(`Not green on ${sha}: ${verdict.detail}.`)
    if (tools.now() > deadline)
      throw new MergeRefused(
        `Tests and Live did not finish on ${sha} within ${WAIT_MS / 60_000} minutes.`
      )
    const toDispatch = (verdict.missing ?? []).filter((name) => !dispatched.has(name))
    if (toDispatch.length > 0) {
      if (remoteSha(tools, branch) !== sha) throw new MergeRefused(`${branch} moved off ${sha}.`)
      for (const name of toDispatch) dispatched.set(name, dispatchRun(tools, branch, name))
    }
    await tools.sleep(POLL_MS)
  }
}

// Three-way merge of two size budgets (ADR 0039 decision 6). A cap only shrinks, so each entry takes the
// lower cap of the two sides, and an entry either side removed stays removed.
export function mergeSizeBudgets(base, ours, theirs) {
  const files = new Set([...Object.keys(ours), ...Object.keys(theirs)])
  const kept = [...files].filter(
    (file) =>
      !Object.hasOwn(base, file) || (Object.hasOwn(ours, file) && Object.hasOwn(theirs, file))
  )
  return Object.fromEntries(
    kept.map((file) => [file, Math.min(ours[file] ?? Infinity, theirs[file] ?? Infinity)])
  )
}

// Every slice that shrinks a listed file lowers its cap line, so concurrent slices conflict there.
// Only that conflict resolves, and only into a tree that passes the ratchets: growth past a resolved
// cap, or any other ratchet problem, refuses.
function resolveBudgetConflict(tools, other, message) {
  const conflicts = lines(git(tools, 'diff', '--name-only', '--diff-filter=U'))
  if (conflicts.length !== 1 || conflicts[0] !== SIZE_BUDGET)
    throw new MergeRefused(`Merging ${other} conflicts:\n${conflicts.join('\n')}`)
  const [base = {}, ours, theirs] = [1, 2, 3].map((stage) => {
    const result = tools.run('git', ['show', `:${stage}:${SIZE_BUDGET}`])
    return result.status === 0 ? JSON.parse(result.stdout) : undefined
  })
  if (!ours || !theirs)
    throw new MergeRefused(`Merging ${other} deletes ${SIZE_BUDGET} on one side.`)
  const root = git(tools, 'rev-parse', '--show-toplevel')
  const lowerCaps = mergeSizeBudgets(base, ours, theirs)
  // Both sides' deletions can leave a module under both caps; its cap comes down to the merged size.
  const lowered = shrunkCaps(root, lowerCaps)
  writeFileSync(
    join(root, SIZE_BUDGET),
    `${JSON.stringify({ ...lowerCaps, ...lowered }, null, 2)}\n`
  )
  git(tools, 'add', SIZE_BUDGET)
  const problems = ratchetProblems(root)
  if (problems.length > 0)
    throw new MergeRefused(
      `Merging ${other} took the lower ${SIZE_BUDGET} caps, but the merged tree fails the source ratchets:\n${problems.join('\n')}`
    )
  git(tools, 'commit', '-m', message, '-m', TRAILER)
  const loweredNote = Object.entries(lowered)
    .map(([file, size]) => `; lowered ${file} to its merged ${size} code lines`)
    .join('')
  tools.log(`Resolved the ${SIZE_BUDGET} conflict with ${other} to the lower caps${loweredNote}.`)
}

function commitMerge(tools, other, message) {
  const result = tools.run('git', [
    'merge',
    '--no-ff',
    '--no-edit',
    '-m',
    message,
    '-m',
    TRAILER,
    other
  ])
  if (result.status !== 0) resolveBudgetConflict(tools, other, message)
  return git(tools, 'rev-parse', 'HEAD')
}

const push = (tools, sha, branch) => {
  git(tools, 'push', 'origin', `${sha}:refs/heads/${branch}`)
  tools.log(`Pushed ${sha} to ${branch}.`)
}

function nextBatchNumber(tools, batchPrefix) {
  const refs = lines(git(tools, 'ls-remote', '--heads', 'origin', `${batchPrefix}*`))
  return nextMergeNumber(
    refs.map((line) => line.split('\t')[1]),
    batchPrefix
  )
}

// The batch is green: the phase branch fast-forwards to it, or takes one more --no-ff merge when it
// moved meanwhile by docs/ only.
function landBatch(tools, { merge, batch, phaseTip, target, number }) {
  git(tools, 'fetch', '--quiet', 'origin', `+refs/heads/${target}:refs/remotes/origin/${target}`)
  const phaseNow = git(tools, 'rev-parse', `origin/${target}`)
  if (phaseNow === phaseTip) {
    push(tools, merge, target)
    return tools.log(`Batch ${batch} green; ${target} fast-forwarded to ${merge}.`)
  }
  const moved = lines(git(tools, 'diff', '--name-only', '--no-renames', phaseTip, phaseNow))
  if (!docsOnly(moved))
    throw new MergeRefused(`${target} moved outside docs/ while ${batch} ran: ${moved.join(', ')}.`)
  const docsMerge = commitMerge(tools, phaseNow, `Merge ${target} docs into m${number}`)
  push(tools, docsMerge, target)
  tools.log(`Batch ${batch} green; merged into ${target} as ${docsMerge} over its docs-only move.`)
}

// `slices` is a list of { branch, sha }; a lone `branch` and `sha` is the single-slice form. Every tip
// must be unchanged and green on its own runs first. Several slices merge in order onto the phase tip
// into one batch commit that Tests and Live run on once; any refusal pushes nothing to the phase branch.
export async function mergeSlice(
  { branch, sha, slices = parseSlices({ branch, sha }), title, target, batchPrefix },
  tools = realTools
) {
  const names = slices.map((slice) => slice.branch)
  if (new Set(names).size !== names.length)
    throw new MergeRefused(`A slice is named twice: ${names.join(', ')}.`)
  for (const slice of slices) validateInputs({ ...slice, title, target, batchPrefix })
  for (const slice of slices)
    if (remoteSha(tools, slice.branch) !== slice.sha)
      throw new MergeRefused(`${slice.branch} is not at ${slice.sha}; the tip moved.`)
  for (const slice of slices) {
    try {
      await waitForGreen(tools, slice.sha, slice.branch)
    } catch (error) {
      if (error instanceof MergeRefused)
        throw new MergeRefused(`${slice.branch}: ${error.message}`, { cause: error })
      throw error
    }
  }

  git(
    tools,
    'fetch',
    '--quiet',
    'origin',
    ...slices.map((slice) => slice.sha),
    `+refs/heads/${target}:refs/remotes/origin/${target}`
  )
  const phaseTip = git(tools, 'rev-parse', `origin/${target}`)
  const number = nextBatchNumber(tools, batchPrefix)
  const batchBranch = `${batchPrefix}${number}`
  const message = `${title.trim()} (m${number})`

  if (slices.length > 1) {
    git(tools, 'checkout', '--quiet', '--detach', phaseTip)
    for (const slice of slices) {
      try {
        commitMerge(tools, slice.sha, message)
      } catch (error) {
        if (error instanceof MergeRefused) {
          git(tools, 'merge', '--abort')
          throw new MergeRefused(`${slice.branch}: ${error.message}`, { cause: error })
        }
        throw error
      }
    }
    const merge = git(tools, 'rev-parse', 'HEAD')
    push(tools, merge, batchBranch)
    await waitForGreen(tools, merge, batchBranch)
    return landBatch(tools, { merge, batch: batchBranch, phaseTip, target, number })
  }

  const [{ branch: only, sha: tip }] = slices
  const mergeBase = git(tools, 'merge-base', tip, phaseTip)
  const phaseChanges = lines(git(tools, 'diff', '--name-only', '--no-renames', mergeBase, phaseTip))

  if (docsOnly(phaseChanges)) {
    git(tools, 'checkout', '--quiet', '--detach', phaseTip)
    const merge = commitMerge(tools, tip, message)
    const outsideSlice = lines(git(tools, 'diff', '--name-only', '--no-renames', tip, merge))
    if (!docsOnly(outsideSlice))
      throw new MergeRefused(
        `The merge differs from the slice tree outside docs/: ${outsideSlice.join(', ')}.`
      )
    push(tools, merge, target)
    push(tools, merge, batchBranch)
    for (const name of Object.keys(WORKFLOWS)) dispatchRun(tools, batchBranch, name)
    return tools.log(
      `Fast path: ${only} merged into ${target} as ${merge}; full-run backstop on ${batchBranch}.`
    )
  }

  git(tools, 'checkout', '--quiet', '--detach', tip)
  const merge = commitMerge(tools, phaseTip, message)
  push(tools, merge, batchBranch)
  await waitForGreen(tools, merge, batchBranch)
  landBatch(tools, { merge, batch: batchBranch, phaseTip, target, number })
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2)
  const option = (name, fallback) => {
    const index = args.indexOf(name)
    return index >= 0 ? (args[index + 1] ?? '') : fallback
  }
  process.chdir(resolve(import.meta.dirname, '..'))
  ;(async () =>
    mergeSlice({
      slices: parseSlices({
        branch: option('--branch', ''),
        sha: option('--sha', ''),
        slices: option('--slices', '')
      }),
      title: option('--title', ''),
      target: option('--target', 'codex/phase-08-2-convex-cutover'),
      batchPrefix: option('--batch-prefix', 'ci/merge-m')
    }))().catch((error) => {
    console.error(
      error instanceof MergeRefused ? `Refused, nothing more pushed: ${error.message}` : error
    )
    process.exitCode = 1
  })
}
