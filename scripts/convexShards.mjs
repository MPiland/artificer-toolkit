// Balances the Convex suite's CI shards by recorded file duration (docs/architecture/ci-validation.md).
// apps/apis/vitest.config.ts shards and orders files with these functions; vitest's own shard splits by
// path hash, which left one shard 16 minutes and another 11.
//
// Refresh the recorded durations from a full run's Convex JSON reports (the `convex-report-*` artifacts):
//   node scripts/convexShards.mjs <vitest-convex.json>...
import { readFileSync, writeFileSync } from 'node:fs'
import { relative } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

export const DURATIONS_FILE = fileURLToPath(
  new URL('../apps/apis/tests/convexFileDurations.json', import.meta.url)
)

const ROOT = fileURLToPath(new URL('..', import.meta.url))

/** A file's recorded milliseconds; a file without a record counts as the median recorded file. */
function durationOf(durations) {
  const recorded = Object.values(durations).sort((a, b) => a - b)
  const median = recorded.length ? recorded[Math.floor(recorded.length / 2)] : 1
  return (path) => durations[path] ?? median
}

/** Paths longest first, ties by path, so every shard computes the same order. */
export function longestFirst(paths, durations) {
  const duration = durationOf(durations)
  return [...paths].sort((a, b) => duration(b) - duration(a) || (a < b ? -1 : a > b ? 1 : 0))
}

/**
 * The paths shard `index` (1-based) of `count` runs: each file, longest first, goes to the shard with the
 * least recorded time so far. Every path lands on exactly one shard.
 */
export function shardPaths(paths, durations, count, index) {
  const duration = durationOf(durations)
  const loads = Array.from({ length: count }, () => 0)
  return longestFirst(paths, durations).filter((path) => {
    const shard = loads.indexOf(Math.min(...loads))
    loads[shard] += duration(path)
    return shard === index - 1
  })
}

/** Per-file milliseconds, keyed by repo-relative path, from vitest JSON reports. */
export function durationsFromReports(reports, root = ROOT) {
  return Object.fromEntries(
    reports
      .flatMap(({ testResults }) => testResults)
      .map(({ name, startTime, endTime }) => [
        relative(root, name).replaceAll('\\', '/'),
        Math.round(endTime - startTime)
      ])
      .sort(([a], [b]) => (a < b ? -1 : 1))
  )
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const reports = process.argv.slice(2).map((file) => JSON.parse(readFileSync(file, 'utf8')))
  const durations = durationsFromReports(reports)
  writeFileSync(DURATIONS_FILE, `${JSON.stringify(durations, null, 2)}\n`)
  console.log(`${Object.keys(durations).length} file durations written to ${DURATIONS_FILE}`)
}
