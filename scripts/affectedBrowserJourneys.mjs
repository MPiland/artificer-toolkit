// Browser journey selection for .github/workflows/browser-journeys.yml (RELIABILITY-20.T2,
// docs/architecture/ci-validation.md#browser-journeys). A journey drives the served web app, the Session
// Worker and Convex through the proof driver. A slice push whose changes reach one of those entries
// through the Tests workflow's import graph (scripts/affectedTests.mjs) runs the journeys named by the
// acceptance criteria its task closes (the ledger's AC `journeys`, RELIABILITY-21.19); a change to the
// stack the job starts, and a merge batch push, run every CI proof. A dispatch runs the proofs it names,
// or every CI proof. The CI proofs are the *-browser proofs of scripts/runLocalConvexProof.ps1; a
// scripts/knownBugProofs.json entry runs without gating, and a push that removes one runs that proof. The
// selected proofs are packed onto a few shared stacks (shardProofs), since booting a stack costs more
// than most proofs.
//   node scripts/affectedBrowserJourneys.mjs --base <ref> [--branch <name>] [--event <name>]
//     [--proof "<name> ..."] [--reverse]
// Writes `shards`, a JSON matrix of { name, knownBug, proofs: [{ proof, knownBug }] } that is empty when
// nothing is reached, to $GITHUB_OUTPUT when set.
import { execFileSync } from 'node:child_process'
import { appendFileSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { affectedFiles, buildImportGraph, changesSince, fullRunReason } from './affectedTests.mjs'
// Seconds each proof's own step took in CI, which balances the shards; refresh it from a full run with the
// command in docs/architecture/ci-validation.md#browser-journeys.
import PROOF_SECONDS from './browserJourneyDurations.json' with { type: 'json' }
// CI proofs that have never passed in CI, each with the registered task that fixes it (RELIABILITY-20.3).
// They run and upload evidence but do not gate; the fix task removes its entries.
import KNOWN_BUG_PROOFS from './knownBugProofs.json' with { type: 'json' }
import { isTestPath } from './redProof.mjs'

const KNOWN_BUG_FILE = 'scripts/knownBugProofs.json'

/**
 * What a journey runs besides every deployed Convex module: the proof driver, the web app's TanStack
 * Start entries (the router is loaded by convention, not imported), the Worker and the stack scripts.
 */
export const JOURNEY_ENTRIES = [
  'apps/apis/tests/developmentDrafts.ts',
  'apps/web/src/client.tsx',
  'apps/web/src/server.ts',
  'apps/web/src/router.tsx',
  'apps/web/src/start.ts',
  'apps/session-worker/src/index.ts',
  'scripts/runLocalBrowserProof.mjs',
  'scripts/throwawayConvexStack.mjs',
  'scripts/liveBackendValidation.mjs'
]

/** Stack files no import graph sees: the workflows that pin the stack, the PowerShell proof runner, this selector. */
const JOURNEY_STACK = [
  /^\.github\/workflows\/(browser-journeys|live-backend)\.yml$/,
  /^scripts\/(runLocalConvexProof|localConvexFixtures)\.ps1$/,
  /^scripts\/affectedBrowserJourneys\.mjs$/
]
const SERVED_ROOT = /^apps\/(web\/(src|public)|session-worker\/src|apis\/convex)\//
const CODE_FILE = /\.[cm]?[jt]sx?$/

/** Convex deploys every non-test module under convex/; the generated `api` is a static spec that imports none. */
const convexModule = (path) =>
  path.startsWith('apps/apis/convex/') && CODE_FILE.test(path) && !isTestPath(path)

/** A served file the graph cannot follow (a stylesheet, an asset); snapshots belong to unit tests. */
const servedAsset = (path) =>
  SERVED_ROOT.test(path) && !CODE_FILE.test(path) && !path.includes('/__snapshots__/')

/** Why `changed` runs every CI proof (it changes the stack the job starts or the toolchain), or null. */
export function stackChange(changed) {
  const stack = changed.find((path) => JOURNEY_STACK.some((pattern) => pattern.test(path)))
  return stack ? `${stack} changed` : fullRunReason(changed, [])
}

/** Why `changed` needs the browser journeys, or null. */
export function journeyRunReason(graph, changed) {
  const stack = stackChange(changed)
  if (stack) return stack
  const asset = changed.find(servedAsset)
  if (asset) return `${asset} changed`
  // The proof driver and its helpers read fixtures and evidence, not source, so the Tests rule that a
  // file-reading test helper depends on every source file would select the journeys for any change.
  const imports = { ...graph, predicates: graph.predicates.filter((edge) => !edge.readsSource) }
  const affected = affectedFiles(imports, changed)
  const entry = [...affected].find((path) => JOURNEY_ENTRIES.includes(path) || convexModule(path))
  return entry ? `the change reaches ${entry}` : null
}

const PROOF_NAME = /^[a-z0-9]+(-[a-z0-9]+)*$/

/** Splits a proof name list and checks each name's shape. */
export function proofNames(text) {
  const names = text.split(/[\s,]+/).filter(Boolean)
  const invalid = names.find((name) => !PROOF_NAME.test(name))
  if (invalid) throw new Error(`${invalid} is not a proof name.`)
  return names
}

/** The `-Proof` ValidateSet of scripts/runLocalConvexProof.ps1, the one proof list; its *-browser proofs are the CI proofs. */
export function runnerProofs(runnerScript) {
  const set = /\[ValidateSet\(([^)]*)\)\]\[string\]\$Proof\b/.exec(runnerScript)?.[1]
  if (!set) throw new Error('runLocalConvexProof.ps1 has no -Proof ValidateSet.')
  return proofNames([...set.matchAll(/'([^']*)'/g)].map(([, name]) => name).join(' '))
}

/** The CI proofs: the runner's *-browser proofs. */
export const ciProofsOf = (runnerScript) =>
  runnerProofs(runnerScript).filter((name) => name.endsWith('-browser'))

/**
 * Why a push runs CI proofs, and which. Every one when the change touches the stack. When it reaches a
 * journey, the `named` ones: the journeys the slice's acceptance criteria name (RELIABILITY-21.19). Also
 * the proofs whose known-bug label the change removed, so they gate again. Adding or retargeting a label
 * needs no run, which is why the label file stays out of JOURNEY_STACK (RELIABILITY-21.17).
 */
export function pushProofs(graph, changed, ciProofs, baseKnownBugs, knownBugs, named) {
  const stack = stackChange(changed)
  if (stack) return { reason: stack, proofs: ciProofs }
  const reach = journeyRunReason(graph, changed)
  const gated = reach ? ciProofs.filter((proof) => named.includes(proof)) : []
  const released = ciProofs.filter((proof) => baseKnownBugs[proof] && !knownBugs[proof])
  const reasons = [
    gated.length > 0 ? `${reach}; the acceptance criteria name these journeys` : null,
    released.length > 0 ? 'known-bug labels removed' : null
  ].filter(Boolean)
  return {
    reason: reasons.length > 0 ? reasons.join('; ') : null,
    proofs: ciProofs.filter((proof) => gated.includes(proof) || released.includes(proof))
  }
}

/** Gating runners a run uses at most; known-bug proofs take one more (RELIABILITY-21.18). */
export const GATING_SHARDS = 5

/**
 * Packs proofs onto shared stacks. Known-bug proofs share one non-gating shard, so a known bug never
 * reddens or hides a gating proof. Gating proofs go longest first onto the least-loaded of GATING_SHARDS
 * shards by recorded seconds; a proof with no recording counts as the median one. Each shard runs its
 * proofs in name order, or reversed to prove they do not depend on each other.
 */
export function shardProofs(proofs, knownBugs, seconds, { reverse = false } = {}) {
  const recorded = Object.values(seconds).sort((a, b) => a - b)
  const median = recorded[Math.floor(recorded.length / 2)] ?? 0
  const cost = (proof) => seconds[proof] ?? median
  const gating = proofs.filter((proof) => !knownBugs[proof])
  const bins = Array.from({ length: Math.min(GATING_SHARDS, gating.length) }, () => ({
    load: 0,
    proofs: []
  }))
  for (const proof of [...gating].sort((a, b) => cost(b) - cost(a) || a.localeCompare(b))) {
    const bin = bins.reduce((least, next) => (next.load < least.load ? next : least))
    bin.load += cost(proof)
    bin.proofs.push(proof)
  }
  const shard = (name, members, knownBug) => {
    const ordered = [...members].sort()
    if (reverse) ordered.reverse()
    return {
      name,
      knownBug,
      proofs: ordered.map((proof) => ({ proof, knownBug: knownBugs[proof] ?? '' }))
    }
  }
  const shards = bins.map((bin, index) =>
    shard(`Journeys ${index + 1} of ${bins.length}`, bin.proofs, false)
  )
  const known = proofs.filter((proof) => knownBugs[proof])
  return known.length > 0 ? [...shards, shard('Known bugs, not gating', known, true)] : shards
}

/** Every PBI in the phase ledger, wherever its feature nests it: a node with acceptance criteria and tasks. */
export function ledgerPbis(ledger) {
  const pbis = []
  const visit = (node) => {
    if (Array.isArray(node)) node.forEach(visit)
    else if (node && typeof node === 'object') {
      if (Array.isArray(node.acs) && Array.isArray(node.tasks)) pbis.push(node)
      Object.values(node).forEach(visit)
    }
  }
  visit(ledger)
  return pbis
}

/** Every task in the phase ledger, by id. */
export function ledgerTasks(ledger) {
  return new Map(
    ledgerPbis(ledger).flatMap(({ tasks }) =>
      tasks.filter((task) => task?.id).map((task) => [task.id, task.status])
    )
  )
}

/** One problem per AC whose optional `journeys` is not a non-empty list of CI proofs. */
export function acJourneyProblems(ledger, ciProofs) {
  return ledgerPbis(ledger).flatMap(({ acs }) =>
    acs
      .filter(
        ({ journeys }) =>
          journeys !== undefined &&
          !(
            Array.isArray(journeys) &&
            journeys.length > 0 &&
            journeys.every((proof) => ciProofs.includes(proof))
          )
      )
      .map(
        ({ id, journeys }) =>
          `${id} journeys must list CI proofs (the *-browser proofs of scripts/runLocalConvexProof.ps1), not ${JSON.stringify(journeys)}.`
      )
  )
}

/**
 * The task a slice branch works on, `ci/<task id>` in lower case with `.` and `_` as `-`
 * (RELIABILITY-21.T21 is ci/reliability-21-t21), and the journeys named by the acceptance criteria it
 * closes. A branch that names no task has neither.
 */
export function sliceJourneys(ledger, branch) {
  const branchOf = (taskId) => `ci/${taskId.toLowerCase().replace(/[._]/g, '-')}`
  for (const { acs, tasks } of ledgerPbis(ledger)) {
    const task = tasks.find(({ id }) => typeof id === 'string' && branchOf(id) === branch)
    if (task) {
      const closes = task.closes ?? []
      const named = acs.filter(({ id }) => closes.includes(id)).flatMap((ac) => ac.journeys ?? [])
      return { task: task.id, journeys: [...new Set(named)] }
    }
  }
  return { task: null, journeys: [] }
}

/** Refuses a known-bug entry that is not a CI proof or does not name an open registered task. */
export function checkKnownBugs(knownBugs, ciProofs, tasks) {
  for (const [proof, task] of Object.entries(knownBugs)) {
    if (!ciProofs.includes(proof)) throw new Error(`Known-bug ${proof} is not a CI proof.`)
    if (!task || !tasks.has(task))
      throw new Error(`Known-bug ${proof} must name a registered task, not "${task ?? ''}".`)
    if (tasks.get(task) === 'DONE')
      throw new Error(`Known-bug ${proof}: ${task} is DONE; remove the entry so the proof gates.`)
  }
}

function main() {
  const root = resolve(import.meta.dirname, '..')
  const args = process.argv.slice(2)
  const option = (name) => {
    const index = args.indexOf(name)
    return index >= 0 ? (args[index + 1] ?? '') : ''
  }
  const base = option('--base')
  if (!base) throw new Error('--base <ref> is required')
  const runnerScript = readFileSync(join(root, 'scripts/runLocalConvexProof.ps1'), 'utf8')
  const allProofs = runnerProofs(runnerScript)
  const ciProofs = ciProofsOf(runnerScript)
  const ledger = JSON.parse(readFileSync(join(root, 'docs/roadmap/08-phase-ledger.json'), 'utf8'))
  checkKnownBugs(KNOWN_BUG_PROOFS, ciProofs, ledgerTasks(ledger))
  const [journeyProblem] = acJourneyProblems(ledger, ciProofs)
  if (journeyProblem) throw new Error(journeyProblem)
  const dispatched = proofNames(option('--proof'))
  const unknown = dispatched.find((proof) => !allProofs.includes(proof))
  if (unknown) throw new Error(`${unknown} is not a scripts/runLocalConvexProof.ps1 proof.`)
  const branch = option('--branch')

  let proofs = ciProofs
  let summary = `${option('--event')} run: every CI proof.`
  if (dispatched.length > 0) {
    proofs = dispatched
    summary = `Dispatched ${dispatched.join(', ')}.`
  } else if (branch.startsWith('ci/merge-')) {
    summary = `${branch} is a merge batch: every CI proof.`
  } else if (option('--event') !== 'workflow_dispatch') {
    const [mergeBase] = execFileSync('git', ['merge-base', 'HEAD', base], {
      cwd: root,
      encoding: 'utf8'
    }).split('\n')
    const { changed } = changesSince(root, mergeBase)
    const tracked = execFileSync('git', ['ls-files'], {
      cwd: root,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024
    })
      .split('\n')
      .filter(Boolean)
    const git = (...gitArgs) => execFileSync('git', gitArgs, { cwd: root, encoding: 'utf8' })
    const baseKnownBugs = git('ls-tree', '--name-only', mergeBase, KNOWN_BUG_FILE).trim()
      ? JSON.parse(git('show', `${mergeBase}:${KNOWN_BUG_FILE}`))
      : {}
    const slice = sliceJourneys(ledger, branch)
    const push = pushProofs(
      buildImportGraph(root, tracked),
      changed,
      ciProofs,
      baseKnownBugs,
      KNOWN_BUG_PROOFS,
      slice.journeys
    )
    const { reason } = push
    proofs = push.proofs
    const mapping = slice.task
      ? `${branch} works on ${slice.task}, whose acceptance criteria name ${slice.journeys.length > 0 ? slice.journeys.join(', ') : 'no journey'}.`
      : `${branch || 'This branch'} names no ledger task, so it gates on journeys only for stack changes.`
    summary = reason
      ? `${reason}: ${proofs.join(', ')}.\n\n${mapping}`
      : `${changed.length} files changed since ${base}; no browser journey runs.\n\n${mapping}`
  }
  const knownBugs = proofs.filter((proof) => KNOWN_BUG_PROOFS[proof])
  if (knownBugs.length > 0)
    summary += `\n\nNot gating: ${knownBugs.map((proof) => `${proof} KNOWN-BUG ${KNOWN_BUG_PROOFS[proof]}`).join(', ')}.`
  const shards = shardProofs(proofs, KNOWN_BUG_PROOFS, PROOF_SECONDS, {
    reverse: args.includes('--reverse')
  })
  for (const { name, proofs: members } of shards)
    summary += `\n\n${name}: ${members.map(({ proof }) => proof).join(', ')}.`
  console.log(summary)
  if (process.env.GITHUB_OUTPUT)
    appendFileSync(process.env.GITHUB_OUTPUT, `shards=${JSON.stringify(shards)}\n`)
  if (process.env.GITHUB_STEP_SUMMARY)
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### Browser journeys\n\n${summary}\n`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main()
