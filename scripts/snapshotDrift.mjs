// Snapshot drift in CI: which test files failed on a snapshot mismatch (from Vitest JSON reports), and
// which snapshot files a `-u` rerun changed, so the Tests workflow can hand them back as an artifact.
//   node scripts/snapshotDrift.mjs failed <report.json>...   prints the failing files, root-relative
//   node scripts/snapshotDrift.mjs collect <outDir>          copies the changed snapshot files into outDir
import { spawnSync } from 'node:child_process'
import { copyFileSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const SNAPSHOT_MISMATCH = /Snapshot .*mismatched/

/** Root-relative test files whose assertions or collection failed on a snapshot mismatch. */
export function failedSnapshotFiles(reports, root) {
  const files = new Set()
  for (const report of reports)
    for (const file of report.testResults) {
      const messages = [file.message, ...file.assertionResults.flatMap((a) => a.failureMessages)]
      if (messages.some((message) => SNAPSHOT_MISMATCH.test(message ?? '')))
        files.add(relative(root, file.name).replaceAll('\\', '/'))
    }
  return [...files].sort()
}

/** Snapshot files, and test files holding inline snapshots, that differ from the commit. */
export function changedSnapshotFiles(root) {
  const result = spawnSync(
    'git',
    [
      'status',
      '--porcelain=v1',
      '--untracked-files=all',
      '-z',
      '--',
      '*/__snapshots__/*',
      '*.test.ts',
      '*.test.tsx'
    ],
    { cwd: root, encoding: 'utf8', shell: false, windowsHide: true }
  )
  if (result.status !== 0) throw new Error(`git status failed: ${result.stderr}`)
  return result.stdout
    .split('\0')
    .filter(Boolean)
    .filter((entry) => !entry.startsWith(' D') && !entry.startsWith('D '))
    .map((entry) => entry.slice(3))
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const root = resolve(import.meta.dirname, '..')
  const [command, ...args] = process.argv.slice(2)
  if (command === 'failed') {
    const reports = args.map((path) => JSON.parse(readFileSync(path, 'utf8')))
    for (const file of failedSnapshotFiles(reports, root)) console.log(file)
  } else if (command === 'collect') {
    const [outDir] = args
    for (const file of changedSnapshotFiles(root)) {
      mkdirSync(join(outDir, dirname(file)), { recursive: true })
      copyFileSync(join(root, file), join(outDir, file))
      console.log(file)
    }
  } else {
    console.error('Usage: snapshotDrift.mjs failed <report.json>... | collect <outDir>')
    process.exitCode = 1
  }
}
