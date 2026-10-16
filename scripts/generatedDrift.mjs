// Drift of generated files from the commit, as `git status --porcelain` sees it: a modified, deleted or
// untracked file all count, which `git diff` misses for a file that codegen newly adds.
//   node scripts/generatedDrift.mjs <path>...   exits 1 and lists the drift
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

export function generatedStatus(root, paths) {
  const result = spawnSync(
    'git',
    ['status', '--porcelain=v1', '--untracked-files=all', '--', ...paths],
    { cwd: root, encoding: 'utf8', shell: false, windowsHide: true }
  )
  if (result.status !== 0) throw new Error(`git status failed: ${result.stderr}`)
  return result.stdout.trimEnd()
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const drift = generatedStatus(resolve(import.meta.dirname, '..'), process.argv.slice(2))
  if (drift) {
    console.error(`Generated files differ from the commit:\n${drift}`)
    process.exitCode = 1
  }
}
