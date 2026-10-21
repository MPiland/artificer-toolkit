// Merges an approved, green ci/<slice> tip into the phase branch (.github/workflows/merge-slice.yml,
// docs/architecture/ci-validation.md#approved-merges). Everything it pushes is a plain push, so a branch
// that moved meanwhile rejects it; it never force-pushes and never pushes main.
//   node scripts/mergeSlice.mjs --branch ci/<slice> --sha <tip> --title "<title>"
//     [--target <phase branch>] [--batch-prefix ci/merge-m]
// Fast path: when the phase branch changed nothing outside docs/ since the slice's merge base, the slice
// merges --no-ff onto the phase tip, the merge must differ from the slice tree in docs/ only (not at all
// when the slice contains the phase tip), and after the phase push the merge commit goes to
// <batch-prefix><N> as the full-run backstop. Otherwise the phase tip merges into the slice, goes to
// <batch-prefix><N>, and reaches the phase branch only once Tests and Live are green there: a fast-forward,
// or a --no-ff merge when the phase branch has moved by docs/ only meanwhile.
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

export const WORKFLOWS = { Tests: 'tests.yml', 'Live backend': 'live-backend.yml' }
const TRAILER = 'Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>'
const POLL_MS = 60_000
// A dispatched run can take a while to be listed; past this it is missing, not pending.
const APPEAR_MS = 5 * 60_000

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

const run = (command, args) => {
  const result = spawnSync(command, args, { encoding: 'utf8', shell: false, windowsHide: true })
  if (result.error) throw result.error
  return result
}

const git = (...args) => {
  const result = run('git', args)
  if (result.status !== 0) throw new Error(`git ${args.join(' ')} failed:\n${result.stderr}`)
  return result.stdout.trim()
}

const gh = (...args) => {
  const result = run('gh', args)
  if (result.status !== 0) throw new Error(`gh ${args.join(' ')} failed:\n${result.stderr}`)
  return result.stdout.trim()
}

const lines = (text) => text.split('\n').filter(Boolean)
const log = (message) => console.log(message)
const sleep = (ms) => new Promise((done) => setTimeout(done, ms))

const remoteSha = (branch) =>
  git('ls-remote', 'origin', `refs/heads/${branch}`).split('\t')[0] || null

const runsOn = (sha) =>
  JSON.parse(
    gh(
      'run',
      'list',
      '--commit',
      sha,
      '--limit',
      '50',
      '--json',
      'databaseId,workflowName,status,conclusion,createdAt'
    )
  )

const dispatch = (branch, names) => {
  for (const name of names) {
    gh('workflow', 'run', WORKFLOWS[name], '--ref', branch)
    log(`Dispatched ${name} on ${branch}.`)
  }
}

// Waits for Tests and Live to finish on `sha`. A workflow with no run is dispatched on `branch` once
// (Live is path-filtered, and a GITHUB_TOKEN push triggers nothing); the caller has checked that
// `branch` points at `sha`.
async function waitForGreen(sha, branch) {
  const dispatched = new Map()
  for (;;) {
    const verdict = runsVerdict(runsOn(sha))
    if (verdict.state === 'green') return log(`Green on ${sha}: ${verdict.detail}.`)
    if (verdict.state === 'red') throw new MergeRefused(`Not green on ${sha}: ${verdict.detail}.`)
    if (verdict.state === 'missing') {
      const toDispatch = verdict.missing.filter((name) => !dispatched.has(name))
      const late = verdict.missing.filter((name) => Date.now() - dispatched.get(name) > APPEAR_MS)
      if (late.length > 0) throw new MergeRefused(`No ${late.join(' or ')} run appeared on ${sha}.`)
      if (toDispatch.length > 0) {
        if (remoteSha(branch) !== sha) throw new MergeRefused(`${branch} moved off ${sha}.`)
        dispatch(branch, toDispatch)
        for (const name of toDispatch) dispatched.set(name, Date.now())
      }
    }
    await sleep(POLL_MS)
  }
}

function commitMerge(other, message) {
  const result = run('git', ['merge', '--no-ff', '--no-edit', '-m', message, '-m', TRAILER, other])
  if (result.status !== 0)
    throw new MergeRefused(
      `Merging ${other} conflicts:\n${git('diff', '--name-only', '--diff-filter=U')}`
    )
  return git('rev-parse', 'HEAD')
}

const push = (sha, branch) => {
  git('push', 'origin', `${sha}:refs/heads/${branch}`)
  log(`Pushed ${sha} to ${branch}.`)
}

function nextBatchNumber(batchPrefix) {
  const refs = lines(git('ls-remote', '--heads', 'origin', `${batchPrefix}*`))
  return nextMergeNumber(
    refs.map((line) => line.split('\t')[1]),
    batchPrefix
  )
}

export async function mergeSlice({ branch, sha, title, target, batchPrefix }) {
  validateInputs({ branch, sha, title, target, batchPrefix })
  if (remoteSha(branch) !== sha)
    throw new MergeRefused(`${branch} is not at ${sha}; the tip moved.`)
  await waitForGreen(sha, branch)

  git('fetch', '--quiet', 'origin', sha, `+refs/heads/${target}:refs/remotes/origin/${target}`)
  const phaseTip = git('rev-parse', `origin/${target}`)
  const mergeBase = git('merge-base', sha, phaseTip)
  const phaseChanges = lines(git('diff', '--name-only', '--no-renames', mergeBase, phaseTip))
  const number = nextBatchNumber(batchPrefix)
  const batch = `${batchPrefix}${number}`
  const message = `${title.trim()} (m${number})`

  if (docsOnly(phaseChanges)) {
    git('checkout', '--quiet', '--detach', phaseTip)
    const merge = commitMerge(sha, message)
    const outsideSlice = lines(git('diff', '--name-only', '--no-renames', sha, merge))
    if (!docsOnly(outsideSlice))
      throw new MergeRefused(
        `The merge differs from the slice tree outside docs/: ${outsideSlice.join(', ')}.`
      )
    push(merge, target)
    push(merge, batch)
    dispatch(batch, Object.keys(WORKFLOWS))
    return log(
      `Fast path: ${branch} merged into ${target} as ${merge}; full-run backstop on ${batch}.`
    )
  }

  git('checkout', '--quiet', '--detach', sha)
  const merge = commitMerge(phaseTip, message)
  push(merge, batch)
  await waitForGreen(merge, batch)

  git('fetch', '--quiet', 'origin', `+refs/heads/${target}:refs/remotes/origin/${target}`)
  const phaseNow = git('rev-parse', `origin/${target}`)
  if (phaseNow === phaseTip) {
    push(merge, target)
    return log(`Batch ${batch} green; ${target} fast-forwarded to ${merge}.`)
  }
  const moved = lines(git('diff', '--name-only', '--no-renames', phaseTip, phaseNow))
  if (!docsOnly(moved))
    throw new MergeRefused(`${target} moved outside docs/ while ${batch} ran: ${moved.join(', ')}.`)
  const docsMerge = commitMerge(phaseNow, `Merge ${target} docs into m${number}`)
  push(docsMerge, target)
  log(`Batch ${batch} green; merged into ${target} as ${docsMerge} over its docs-only move.`)
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2)
  const option = (name, fallback) => {
    const index = args.indexOf(name)
    return index >= 0 ? (args[index + 1] ?? '') : fallback
  }
  process.chdir(resolve(import.meta.dirname, '..'))
  mergeSlice({
    branch: option('--branch', ''),
    sha: option('--sha', ''),
    title: option('--title', ''),
    target: option('--target', 'codex/phase-08-2-convex-cutover'),
    batchPrefix: option('--batch-prefix', 'ci/merge-m')
  }).catch((error) => {
    console.error(
      error instanceof MergeRefused ? `Refused, nothing more pushed: ${error.message}` : error
    )
    process.exitCode = 1
  })
}
