// oxfmt on the files a branch changed since its merge base with <base>: committed, uncommitted and
// untracked, deleted ones skipped. The phase branch is not oxfmt-clean, so CI checks (and its auto-fix
// formats) only a slice's own files; a repo-wide `yarn format` would rewrite other slices' files.
// .oxfmtrc.jsonc's ignorePatterns and oxfmt's supported file types still apply.
//   node scripts/formatChanged.mjs --base <ref> [--check]   --check changes nothing and fails on drift
import { spawnSync } from 'node:child_process'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const oxfmt = join(import.meta.dirname, '..', 'node_modules', 'oxfmt', 'bin', 'oxfmt')

const run = (root, command, args) => {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: 'utf8',
    shell: false,
    windowsHide: true
  })
  if (result.error) throw result.error
  return result
}

const git = (root, ...args) => {
  const result = run(root, 'git', args)
  if (result.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${result.stderr}`)
  return result.stdout.split('\n').filter(Boolean)
}

export function changedFiles(root, base) {
  const [mergeBase] = git(root, 'merge-base', 'HEAD', base)
  const tracked = git(root, 'diff', '--name-only', '--no-renames', '--diff-filter=d', mergeBase)
  const untracked = git(root, 'ls-files', '--others', '--exclude-standard')
  return [...new Set([...tracked, ...untracked])].sort()
}

// Returns oxfmt's exit status; 0 when nothing changed (oxfmt without paths would format the whole tree).
export function formatChanged(root, base, { check = false } = {}) {
  const files = changedFiles(root, base)
  if (files.length === 0) return 0
  const args = [oxfmt, ...(check ? ['--check'] : []), '--no-error-on-unmatched-pattern', ...files]
  const result = run(root, process.execPath, args)
  process.stdout.write(result.stdout)
  process.stderr.write(result.stderr)
  return result.status ?? 1
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2)
  const base = args[args.indexOf('--base') + 1]
  if (!args.includes('--base') || !base) throw new Error('--base <ref> is required')
  process.exitCode = formatChanged(resolve(import.meta.dirname, '..'), base, {
    check: args.includes('--check')
  })
}
