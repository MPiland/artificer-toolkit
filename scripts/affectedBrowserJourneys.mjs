// Browser journey selection for .github/workflows/browser-journeys.yml (RELIABILITY-20.T2,
// docs/architecture/ci-validation.md#browser-journeys). A journey drives the served web app, the Session
// Worker and Convex through the proof driver, so a push runs the CI proofs when its changes reach one of
// those entries through the Tests workflow's import graph (scripts/affectedTests.mjs) or change the stack
// the job starts. A dispatch runs the proof it names, or every CI proof. The CI proofs are the *-browser
// proofs of scripts/runLocalConvexProof.ps1; a KNOWN_BUG_PROOFS entry runs without gating. The selected
// proofs are packed onto a few shared stacks (shardProofs), since booting a stack costs more than most proofs.
//   node scripts/affectedBrowserJourneys.mjs --base <ref> [--event <name>] [--proof <name>] [--reverse]
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
import { isTestPath } from './redProof.mjs'

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

/** Why `changed` needs the browser journeys, or null. */
export function journeyRunReason(graph, changed) {
  const stack = changed.find(
    (path) => JOURNEY_STACK.some((pattern) => pattern.test(path)) || servedAsset(path)
  )
  if (stack) return `${stack} changed`
  const config = fullRunReason(changed, [])
  if (config) return config
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

/**
 * CI proofs that have never passed in CI, each with the registered task that fixes it (RELIABILITY-20.3).
 * They run and upload evidence but do not gate; the fix task removes its entries.
 */
export const KNOWN_BUG_PROOFS = {
  'builder-browser': 'RELIABILITY-21.T16',
  'campaign-custody-browser': 'RELIABILITY-21.T13',
  'character-sheet-browser': 'RELIABILITY-21.T16',
  'publication-class-browser': 'RELIABILITY-21.T13',
  'vtt-browser': 'RELIABILITY-21.T16'
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

/** Every task in the phase ledger, wherever its feature or PBI nests it. */
export function ledgerTasks(ledger) {
  const tasks = new Map()
  const visit = (node) => {
    if (Array.isArray(node)) node.forEach(visit)
    else if (node && typeof node === 'object')
      for (const [key, value] of Object.entries(node)) {
        if (key === 'tasks' && Array.isArray(value))
          for (const task of value) if (task?.id) tasks.set(task.id, task.status)
        visit(value)
      }
  }
  visit(ledger)
  return tasks
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
  const allProofs = runnerProofs(
    readFileSync(join(root, 'scripts/runLocalConvexProof.ps1'), 'utf8')
  )
  const ciProofs = allProofs.filter((name) => name.endsWith('-browser'))
  checkKnownBugs(
    KNOWN_BUG_PROOFS,
    ciProofs,
    ledgerTasks(JSON.parse(readFileSync(join(root, 'docs/roadmap/08-phase-ledger.json'), 'utf8')))
  )
  const [dispatched, ...extra] = proofNames(option('--proof'))
  if (extra.length > 0) throw new Error('--proof takes one proof name.')
  if (dispatched && !allProofs.includes(dispatched))
    throw new Error(`${dispatched} is not a scripts/runLocalConvexProof.ps1 proof.`)

  let proofs = ciProofs
  let summary = `${option('--event')} run: every CI proof.`
  if (dispatched) {
    proofs = [dispatched]
    summary = `Dispatched ${dispatched}.`
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
    const reason = journeyRunReason(buildImportGraph(root, tracked), changed)
    proofs = reason ? ciProofs : []
    summary = reason
      ? `${reason}: ${proofs.join(', ')}.`
      : `${changed.length} files changed since ${base}; none reaches a browser journey.`
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
