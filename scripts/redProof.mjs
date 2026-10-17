// Red proof in CI: the Tests workflow's `red` job runs a slice's new and changed test files against the
// phase branch's production code, so one run proves fail-before (here) and pass-after (the other jobs).
//   node redProof.mjs changed <base>   prints the test files HEAD adds or modifies against base
//   node redProof.mjs run <file>...    runs the runnable ones, prints and summarizes each file's outcome
// The workflow copies this script out of the checkout before restoring production code to base, so it
// takes the repository root from the working directory and imports nothing from the repository.
import { spawnSync } from 'node:child_process'
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { pathToFileURL } from 'node:url'

const TEST_DIRECTORIES = new Set(['test', 'tests', '__tests__', 'testing', 'fixtures', '__snapshots__'])

const TEST_FILE = /\.test\.[cm]?[jt]sx?$/

/** Test files and test-only helpers: a `.test.` or `.fixtures.` file, or anything under a test directory. */
export const isTestPath = (path) =>
  TEST_FILE.test(path) ||
  /\.fixtures?\.[cm]?[jt]sx?$/.test(path) ||
  path.split('/').slice(0, -1).some((part) => TEST_DIRECTORIES.has(part))

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

/** The Vitest invocation that owns a test file, or undefined when no suite runs it. */
export function runnerFor(path) {
  if (/^apps\/apis\/convex\/.+\.test\.ts$/.test(path))
    return { name: 'convex', cwd: '.', args: ['--config', 'apps/apis/vitest.config.ts'] }
  if (/^apps\/session-worker\/test\/native[^/]*\.test\.ts$/.test(path))
    return {
      name: 'worker',
      cwd: 'apps/session-worker',
      args: ['--config', 'vitest.config.ts', '--maxWorkers=1', '--no-isolate']
    }
  if (/^apps\/web\/src\/.+\.test\.tsx?$/.test(path) && !path.endsWith('.browser.test.tsx'))
    return { name: 'web', cwd: 'apps/web', args: ['--config', 'vitest.config.ts', '--project=unit'] }
  // The root config's include list.
  if (
    /^packages\/(design-system|shared|schema)\/src\/__tests__\/.+\.test\.ts$/.test(path) ||
    /^packages\/emails\/src\/__tests__\/.+\.test\.tsx?$/.test(path) ||
    /^(packages\/(authoring|source-data|rules-runtime|encounter-persistence)\/src|apps\/apis\/src|apps\/session-worker\/src)\/.+\.test\.ts$/.test(path) ||
    /^scripts\/.+\.test\.mjs$/.test(path)
  )
    return { name: 'root', cwd: '.', args: ['--config', 'vitest.config.ts'] }
  return undefined
}

/**
 * Each file's outcome from the Vitest JSON reports: RED when a test fails, RED-IMPORT when the file
 * fails before any test runs (a weaker proof: it shows only that the code is missing), ALREADY-PASSING
 * when it passes against the phase branch, and NOT-RUN when no report holds it.
 */
export function classify(files, reports, root) {
  const results = new Map(
    reports.flatMap((report) => report.testResults).map((result) => [relative(root, result.name).replaceAll('\\', '/'), result])
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

const firstLine = (message) => (message ?? '').trim().split('\n')[0].slice(0, 200)

/** The job summary: one row per file, with how to read each outcome. */
export function summary(rows) {
  const cell = (text) => text.replaceAll('|', '\\|')
  return [
    '## Red proof against the phase branch',
    '',
    'RED: a test fails without the slice. RED-IMPORT: the file fails to load without the slice (weaker: it',
    'proves only that the code is missing). ALREADY-PASSING: the test passes without the slice (expected for',
    'a test-only change). NO-RUNNER and NOT-RUN: no suite ran the file.',
    '',
    '| File | Outcome | Detail |',
    '| --- | --- | --- |',
    ...rows.map((row) => `| \`${row.file}\` | ${row.outcome} | ${cell(row.detail)} |`),
    ''
  ].join('\n')
}

function git(root, args) {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8', shell: false, windowsHide: true })
  if (result.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${result.stderr}`)
  return result.stdout
}

/** Test files and helpers that HEAD adds or modifies against base; a rename counts as an added file. */
export const changedTestFiles = (root, base) =>
  git(root, ['diff', '--name-only', '--no-renames', '--diff-filter=AM', '-z', base, 'HEAD'])
    .split('\0')
    .filter(Boolean)
    .filter(isTestPath)
    .sort()

/** Runs each runner's files once; returns the rows, or throws when a runner left no report. */
function runFiles(root, files) {
  // tsc still emits when the phase branch's code fails to type the tip's helper; the tests then report it.
  for (const name of packagesToRebuild(files)) run(root, ['workspace', `@artificer-toolkit/${name}`, 'build'])
  const groups = Map.groupBy(
    files.filter((file) => TEST_FILE.test(file)),
    (file) => runnerFor(file)?.name
  )
  const rows = (groups.get(undefined) ?? []).map((file) => ({
    file,
    outcome: 'NO-RUNNER',
    detail: 'No Vitest suite includes this file.'
  }))
  mkdirSync(join(root, 'local-validation'), { recursive: true })
  for (const [name, group] of groups) {
    if (name === undefined) continue
    const runner = runnerFor(group[0])
    const cwd = join(root, runner.cwd)
    const report = join(root, 'local-validation', `red-${name}.json`)
    if (name === 'worker') run(root, ['workspace', '@artificer-toolkit/session-worker', 'types'])
    run(cwd, [
      'vitest',
      'run',
      ...runner.args,
      '--reporter=default',
      '--reporter=json',
      `--outputFile.json=${report}`,
      ...group.map((file) => relative(cwd, join(root, file)).replaceAll('\\', '/'))
    ])
    if (!existsSync(report)) throw new Error(`The ${name} run wrote no report; see its output above.`)
    rows.push(...classify(group, [JSON.parse(readFileSync(report, 'utf8'))], root))
  }
  return rows.sort((a, b) => a.file.localeCompare(b.file))
}

// A failing test is the expected outcome here, so only a missing report fails the job.
const run = (cwd, args) => spawnSync('yarn', args, { cwd, stdio: 'inherit', shell: false })

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const root = process.cwd()
  const [command, ...args] = process.argv.slice(2)
  if (command === 'changed') {
    for (const file of changedTestFiles(root, args[0])) console.log(file)
  } else if (command === 'run') {
    const rows = runFiles(root, args)
    const text = summary(rows)
    console.log(text)
    if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, text)
  } else {
    console.error('Usage: redProof.mjs changed <base> | run <file>...')
    process.exitCode = 1
  }
}
