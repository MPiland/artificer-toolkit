// Browser journey selection for .github/workflows/browser-journeys.yml (RELIABILITY-20.T2,
// docs/architecture/ci-validation.md#browser-journeys). A journey drives the served web app, the Session
// Worker and Convex through the proof driver, so a push runs the CI proofs when its changes reach one of
// those entries through the Tests workflow's import graph (scripts/affectedTests.mjs) or change the stack
// the job starts. A dispatch runs the proof it names, or every CI proof. The CI proofs are the *-browser
// proofs of scripts/runLocalConvexProof.ps1; a KNOWN_BUG_PROOFS entry runs without gating.
//   node scripts/affectedBrowserJourneys.mjs --base <ref> [--event <name>] [--proof <name>]
// Writes `proofs`, a JSON matrix of { proof, knownBug } that is empty when nothing is reached, to
// $GITHUB_OUTPUT when set.
import { execFileSync } from 'node:child_process'
import { appendFileSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { affectedFiles, buildImportGraph, changesSince, fullRunReason } from './affectedTests.mjs'
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
  'campaign-custody-browser': 'RELIABILITY-21.T2',
  'builder-browser': 'RELIABILITY-21.T3',
  'character-sheet-browser': 'RELIABILITY-21.T3',
  'character-sheet-spells-browser': 'RELIABILITY-21.T3',
  'vtt-browser': 'RELIABILITY-21.T9'
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
  console.log(summary)
  const matrix = proofs.map((proof) => ({ proof, knownBug: KNOWN_BUG_PROOFS[proof] ?? '' }))
  if (process.env.GITHUB_OUTPUT)
    appendFileSync(process.env.GITHUB_OUTPUT, `proofs=${JSON.stringify(matrix)}\n`)
  if (process.env.GITHUB_STEP_SUMMARY)
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### Browser journeys\n\n${summary}\n`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main()
