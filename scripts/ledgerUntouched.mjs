// Fails when a slice branch changed the phase ledger since its merge base with <base>. The ledger is the
// orchestrator's, edited on the phase branch only; a slice that rewrites it (a stale copy or a reformat)
// would revert the orchestrator's edits at merge, and the tests auto-fix must not commit over it. A merge
// of the phase branch into the slice moves the merge base, so ledger edits it brings in do not count.
//   node scripts/ledgerUntouched.mjs --base <ref>
import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { changedFiles } from './formatChanged.mjs'

export const LEDGER = 'docs/roadmap/08-phase-ledger.json'

// The slice's commits since the merge base that changed the ledger, newest first; empty when it is
// unchanged (an uncommitted edit is listed as 'working tree').
export function ledgerChanges(root, base) {
  if (!changedFiles(root, base).includes(LEDGER)) return []
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' })
  const mergeBase = git('merge-base', 'HEAD', base).trim()
  const commits = git('log', '--format=%h %s', `${mergeBase}..HEAD`, '--', LEDGER)
    .split('\n')
    .filter(Boolean)
  return commits.length > 0 ? commits : ['working tree']
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2)
  const base = args[args.indexOf('--base') + 1]
  if (!args.includes('--base') || !base) throw new Error('--base <ref> is required')
  const changes = ledgerChanges(resolve(import.meta.dirname, '..'), base)
  if (changes.length > 0) {
    process.stderr.write(
      `${LEDGER} is the orchestrator's; this branch changed it. Restore it from the merge base:\n` +
        changes.map((change) => `  ${change}\n`).join('')
    )
    process.exitCode = 1
  }
}
