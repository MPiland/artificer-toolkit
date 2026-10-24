// Red proof in CI: the Tests workflow's `red` job runs a slice's new and changed test files against the
// phase branch's production code, so one run proves fail-before (here) and pass-after (the other jobs).
//   RED_SUITES=<json> node redProof.mjs run <file>...
// runs each suite's test files, prints and summarizes each file's outcome. The build job's
// scripts/affectedTests.mjs chooses the files (every test and helper the slice adds or modifies) and the
// suites from Vitest's own config resolution. The workflow copies this script out of the checkout before
// restoring production code to base, so it takes the repository root from the working directory and
// imports nothing from the repository.
import { spawnSync } from 'node:child_process'
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs'
import { join, posix, relative } from 'node:path'
import { pathToFileURL } from 'node:url'

const TEST_DIRECTORIES = new Set([
  'test',
  'tests',
  '__tests__',
  'testing',
  'fixtures',
  '__snapshots__'
])

const TEST_FILE = /\.test\.[cm]?[jt]sx?$/

/**
 * Test files and test-only helpers: a `.test.`, `.testUtils.` or `.fixtures.` file, or anything under a
 * test directory.
 */
export const isTestPath = (path) =>
  TEST_FILE.test(path) ||
  /\.(testUtils|fixtures?)\.[cm]?[jt]sx?$/.test(path) ||
  path
    .split('/')
    .slice(0, -1)
    .some((part) => TEST_DIRECTORIES.has(part))

/**
 * Packages whose build output carries a changed test helper (such as rules-runtime's `src/testing`),
 * which other suites import from `dist`; they are rebuilt once the tip's helpers are in place.
 */
export const packagesToRebuild = (files) => [
  ...new Set(
    files
      .filter((file) => !TEST_FILE.test(file) && !/\/(__tests__|__snapshots__)\//.test(file))
      .map((file) => /^packages\/([^/]+)\/src\//.exec(file)?.[1])
      .filter(Boolean)
  )
]

/**
 * Each file's outcome from the Vitest JSON reports: RED when a test fails, RED-IMPORT when the file
 * fails before any test runs (a weaker proof: it shows only that the code is missing), ALREADY-PASSING
 * when it passes against the phase branch, and NOT-RUN when no report holds it.
 */
export function classify(files, reports, root) {
  const results = new Map(
    reports
      .flatMap((report) => report.testResults)
      .map((result) => [relative(root, result.name).replaceAll('\\', '/'), result])
  )
  return files.map((file) => {
    const result = results.get(file)
    if (!result) return { file, outcome: 'NOT-RUN', detail: 'No Vitest report holds this file.' }
    if (result.status !== 'failed') return { file, outcome: 'ALREADY-PASSING', detail: '' }
    const failed = result.assertionResults.filter((assertion) => assertion.status === 'failed')
    if (failed.length)
      return {
        file,
        outcome: 'RED',
        detail: `${failed.length} of ${result.assertionResults.length} failing: ${failed
          .map((assertion) => `"${assertion.fullName}"`)
          .join(', ')}. First: ${firstLine(failed[0].failureMessages[0])}`
      }
    return { file, outcome: 'RED-IMPORT', detail: firstLine(result.message) }
  })
}

// Well under the job's 30-minute cap: against old code a workerd test can hang instead of failing.
const SUITE_TIMEOUT_MS = 8 * 60 * 1000

const firstLine = (message) => (message ?? '').trim().split('\n')[0].slice(0, 200)

/**
 * One suite's rows. A suite killed at its time budget, or one that wrote no report, proves only that the
 * old code does not finish (RED-TIMEOUT, weaker than RED), so its files are labelled instead of failing the job.
 */
export function suiteRows(suite, root, { killed, report }) {
  if (killed || !existsSync(report))
    return suite.tests.map((file) => ({
      file,
      outcome: 'RED-TIMEOUT',
      detail: killed
        ? `The ${suite.name} run was killed after ${SUITE_TIMEOUT_MS / 60000} minutes.`
        : `The ${suite.name} run wrote no report.`
    }))
  return classify(suite.tests, [JSON.parse(readFileSync(report, 'utf8'))], root)
}

/** The job summary: one row per file, with how to read each outcome. */
export function summary(rows) {
  const cell = (text) => text.replaceAll('|', '\\|')
  return [
    '## Red proof against the phase branch',
    '',
    'RED: a test fails without the slice. RED-IMPORT: the file fails to load without the slice (weaker: it',
    'proves only that the code is missing). RED-TIMEOUT: the suite was killed at its time budget or wrote no',
    'report without the slice (weaker: it proves only that the old code does not finish). ALREADY-PASSING: the test passes without the slice (expected for',
    'a test-only change). NOT-RUN: no report holds the file.',
    '',
    '| File | Outcome | Detail |',
    '| --- | --- | --- |',
    ...rows.map((row) => `| \`${row.file}\` | ${row.outcome} | ${cell(row.detail)} |`),
    ''
  ].join('\n')
}

/**
 * Runs each suite's test files one at a time, as the Worker's source tests need; returns the rows, labelling a suite
 * that timed out or left no report RED-TIMEOUT. `suites` holds `{ name, config, root, project, tests }`, paths root-relative.
 */
function runSuites(root, files, suites) {
  // tsc still emits when the phase branch's code fails to type the tip's helper; the tests then report it.
  for (const name of packagesToRebuild(files))
    run(root, ['workspace', `@artificer-toolkit/${name}`, 'build'])
  mkdirSync(join(root, 'local-validation'), { recursive: true })
  const rows = []
  for (const suite of suites) {
    const cwd = join(root, suite.root)
    const report = join(root, 'local-validation', `red-${suite.name}.json`)
    if (suite.name === 'worker')
      run(root, ['workspace', '@artificer-toolkit/session-worker', 'types'])
    const { error } = run(cwd, [
      'vitest',
      'run',
      `--config=${posix.relative(suite.root, suite.config)}`,
      ...(suite.project ? [`--project=${suite.project}`] : []),
      '--maxWorkers=1',
      // As the Worker's own test script runs its workerd suite.
      ...(suite.name === 'worker' ? ['--no-isolate'] : []),
      '--reporter=default',
      '--reporter=json',
      `--outputFile.json=${report}`,
      ...suite.tests.map((file) => posix.relative(suite.root, file))
    ])
    rows.push(...suiteRows(suite, root, { killed: error?.code === 'ETIMEDOUT', report }))
  }
  return rows.sort((a, b) => a.file.localeCompare(b.file))
}

// A failing or hung test is the expected outcome here, so neither fails the job.
const run = (cwd, args) =>
  spawnSync('yarn', args, {
    cwd,
    stdio: 'inherit',
    shell: false,
    timeout: SUITE_TIMEOUT_MS,
    killSignal: 'SIGKILL'
  })

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const root = process.cwd()
  const [command, ...args] = process.argv.slice(2)
  if (command === 'run' && process.env.RED_SUITES) {
    const rows = runSuites(root, args, JSON.parse(process.env.RED_SUITES))
    const text = summary(rows)
    console.log(text)
    if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, text)
  } else {
    console.error('Usage: RED_SUITES=<json> redProof.mjs run <file>...')
    process.exitCode = 1
  }
}
