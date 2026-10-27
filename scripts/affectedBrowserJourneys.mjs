// Browser journey selection for .github/workflows/browser-journeys.yml (RELIABILITY-20.T2,
// docs/architecture/ci-validation.md#browser-journeys). A journey drives the served web app, the Session
// Worker and Convex through the proof driver, so a push runs the CI proofs when its changes reach one of
// those entries through the Tests workflow's import graph (scripts/affectedTests.mjs) or change the stack
// the job starts. A dispatch runs the proof it names, or every CI proof.
//   node scripts/affectedBrowserJourneys.mjs --base <ref> --proofs "<CI proofs>" [--event <name>] [--proof <name>]
// Writes `proofs`, a JSON array that is empty when nothing is reached, to $GITHUB_OUTPUT when set.
import { execFileSync } from 'node:child_process'
import { appendFileSync } from 'node:fs'
import { resolve } from 'node:path'
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

/** Splits the CI proof list and checks a dispatched proof name; runLocalConvexProof.ps1 owns which names exist. */
export function proofNames(text) {
  const names = text.split(/[\s,]+/).filter(Boolean)
  const invalid = names.find((name) => !PROOF_NAME.test(name))
  if (invalid) throw new Error(`${invalid} is not a proof name.`)
  return names
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
  const ciProofs = proofNames(option('--proofs'))
  const [dispatched, ...extra] = proofNames(option('--proof'))
  if (extra.length > 0) throw new Error('--proof takes one proof name.')

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
  console.log(summary)
  if (process.env.GITHUB_OUTPUT)
    appendFileSync(process.env.GITHUB_OUTPUT, `proofs=${JSON.stringify(proofs)}\n`)
  if (process.env.GITHUB_STEP_SUMMARY)
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### Browser journeys\n\n${summary}\n`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main()
