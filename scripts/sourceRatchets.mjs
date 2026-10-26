// RULES-2.T1 (ADR 0039 decision 6): two shrink-only ratchets.
//
// File size: a non-test source module over SIZE_LIMIT code lines (non-blank lines outside comments) fails
// unless `scripts/fileSizeBudget.json` lists it. Each entry's cap is the file's size when it was listed;
// growth past the cap fails, and an entry is lowered or removed as the file shrinks.
//
// Import fence: a neutral rules-runtime module (outside `systems/` and `character/`) never imports
// `systems/*`, and neither does a module of a rules-runtime consumer (`FENCED_CONSUMERS`) through
// `@artificer-toolkit/rules-runtime/systems/*`; both reach System behaviour through a capability registry.
// `scripts/systemsImportAllowlist.json` names the composition roots that install System adapters, each with
// its reason, and lists the `importers` that still import `systems/` directly.
//
// With `--base <ref>` both lists are also compared with the ones at the merge base: a cap may not rise and
// neither list may gain an entry, so a slice cannot buy itself room.
//
//   node scripts/sourceRatchets.mjs [--base <ref>]   (`yarn lint:ratchets`, part of `yarn lint`)
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { parseSync } from 'oxc-parser'
import { isTestPath } from './redProof.mjs'

export const SIZE_LIMIT = 1500
export const SIZE_BUDGET = 'scripts/fileSizeBudget.json'
export const FENCE_ALLOWLIST = 'scripts/systemsImportAllowlist.json'
const PLATFORM_ROOT = /^packages\/rules-runtime\/src\/platform[^/]*\.ts$/

const RULES_RUNTIME = 'packages/rules-runtime/src/'
const SYSTEMS = `${RULES_RUNTIME}systems`
const UNFENCED = [`${SYSTEMS}/`, `${RULES_RUNTIME}character/`]
const FENCED_CONSUMERS = [
  'packages/encounter-persistence/',
  'apps/session-worker/src/',
  'apps/apis/convex/',
  'apps/web/src/'
]
const SYSTEMS_PACKAGE = '@artificer-toolkit/rules-runtime/systems'

const sourceModule = (file) =>
  /\.[cm]?[jt]sx?$/.test(file) &&
  !/\.d\.[cm]?ts$/.test(file) &&
  !/\.(gen|generated)\.[cm]?[jt]sx?$/.test(file) &&
  !file.split('/').includes('_generated') &&
  !isTestPath(file)

const fencedModule = (file) =>
  (file.startsWith(RULES_RUNTIME) && !UNFENCED.some((prefix) => file.startsWith(prefix))) ||
  FENCED_CONSUMERS.some((prefix) => file.startsWith(prefix))

/** Non-blank lines once comments are blanked out. */
export const codeLines = (filename, source) => {
  let code = source
  for (const { start, end } of parseSync(filename, source).comments)
    code = code.slice(0, start) + code.slice(start, end).replace(/[^\n]/g, ' ') + code.slice(end)
  return code.split('\n').filter((line) => /\S/.test(line)).length
}

/**
 * Import, re-export and dynamic import specifiers of a module that resolve into rules-runtime `systems/`:
 * relative ones from inside the package, `@artificer-toolkit/rules-runtime/systems/*` from anywhere.
 */
export const systemsImports = (file, source) => {
  const specifiers = []
  const visit = (node) => {
    if (Array.isArray(node)) return node.forEach(visit)
    if (!node || typeof node.type !== 'string') return
    if (
      [
        'ImportDeclaration',
        'ExportNamedDeclaration',
        'ExportAllDeclaration',
        'ImportExpression'
      ].includes(node.type) &&
      typeof node.source?.value === 'string'
    )
      specifiers.push(node.source.value)
    for (const [key, value] of Object.entries(node))
      if (key !== 'parent' && value && typeof value === 'object') visit(value)
  }
  visit(parseSync(file, source).program)
  return specifiers.filter((specifier) => {
    if (specifier === SYSTEMS_PACKAGE || specifier.startsWith(`${SYSTEMS_PACKAGE}/`)) return true
    if (!specifier.startsWith('.')) return false
    const target = path.posix.join(path.posix.dirname(file), specifier)
    return target === SYSTEMS || target.startsWith(`${SYSTEMS}/`)
  })
}

const readJson = (root, file) => JSON.parse(readFileSync(path.join(root, file), 'utf8'))

// The list as committed at <base>, or undefined when <base> predates it (or its shape, for the allowlist).
const baseJson = (root, base, file) => {
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: 'pipe' })
  const mergeBase = git('merge-base', 'HEAD', base).trim()
  try {
    return JSON.parse(git('show', `${mergeBase}:${file}`))
  } catch {
    return undefined
  }
}

// A listed module that shrank below its cap while staying over SIZE_LIMIT: its cap must come down.
const shrankUnderCap = (size, cap) => size > SIZE_LIMIT && size < cap

/**
 * The entries of `budget` whose module in the tree at <root> shrank under its cap, each with its
 * code-line count: the caps the ratchet asks to lower.
 */
export const shrunkCaps = (root, budget) =>
  Object.fromEntries(
    Object.entries(budget).flatMap(([file, cap]) => {
      if (!sourceModule(file) || !existsSync(path.join(root, file))) return []
      const size = codeLines(file, readFileSync(path.join(root, file), 'utf8'))
      return shrankUnderCap(size, cap) ? [[file, size]] : []
    })
  )

/** Every ratchet problem in the tree at <root>; empty when it passes. */
export const ratchetProblems = (root, { base } = {}) => {
  const files = execFileSync('git', ['ls-files', '--', 'apps', 'packages', 'scripts'], {
    cwd: root,
    encoding: 'utf8'
  })
    .split('\n')
    .filter((file) => sourceModule(file) && existsSync(path.join(root, file)))
  const source = (file) => readFileSync(path.join(root, file), 'utf8')
  const budget = readJson(root, SIZE_BUDGET)
  const { compositionRoots, importers: allowlist } = readJson(root, FENCE_ALLOWLIST)
  const fenceEntries = [...Object.keys(compositionRoots), ...allowlist]
  const problems = []

  const sizes = new Map(files.map((file) => [file, codeLines(file, source(file))]))
  for (const [file, size] of sizes) {
    if (size <= SIZE_LIMIT) continue
    if (!Object.hasOwn(budget, file))
      problems.push(`${file}: ${size} code lines, over ${SIZE_LIMIT}; split the module.`)
    else if (size > budget[file])
      problems.push(
        `${file}: ${size} code lines, over its budget of ${budget[file]}; split the module.`
      )
  }
  for (const [file, cap] of Object.entries(budget)) {
    const size = sizes.get(file)
    if (size === undefined)
      problems.push(`${SIZE_BUDGET}: ${file} is not a source module; remove it.`)
    else if (size <= SIZE_LIMIT)
      problems.push(
        `${SIZE_BUDGET}: ${file} is ${size} code lines, within ${SIZE_LIMIT}; remove it.`
      )
    else if (shrankUnderCap(size, cap))
      problems.push(
        `${SIZE_BUDGET}: ${file} shrank to ${size} code lines; lower its cap from ${cap}.`
      )
  }

  const importers = new Set(
    files.filter((file) => fencedModule(file) && systemsImports(file, source(file)).length > 0)
  )
  for (const file of importers)
    if (!fenceEntries.includes(file))
      problems.push(`${file}: imports systems/ directly; reach it through a capability registry.`)
  for (const file of fenceEntries)
    if (!importers.has(file))
      problems.push(`${FENCE_ALLOWLIST}: ${file} no longer imports systems/; remove it.`)

  if (base) {
    const baseBudget = baseJson(root, base, SIZE_BUDGET)
    if (baseBudget)
      for (const [file, cap] of Object.entries(budget)) {
        if (!Object.hasOwn(baseBudget, file))
          problems.push(
            `${SIZE_BUDGET}: ${file} is new; a budget only shrinks, so split the module.`
          )
        else if (cap > baseBudget[file])
          problems.push(
            `${SIZE_BUDGET}: ${file} cap raised from ${baseBudget[file]} to ${cap}; a budget only shrinks.`
          )
      }
    const baseAllowlist = baseJson(root, base, FENCE_ALLOWLIST)
    if (baseAllowlist?.importers) {
      const baseEntries = [
        ...Object.keys(baseAllowlist.compositionRoots),
        ...baseAllowlist.importers
      ]
      // The importers are debt and only shrink; a new System install point may be a composition
      // root only as a platform module that states why it installs System adapters.
      const newRoot = (file) =>
        PLATFORM_ROOT.test(file) &&
        (compositionRoots[file]?.trim() ?? '') !== '' &&
        !allowlist.includes(file)
      for (const file of fenceEntries)
        if (!baseEntries.includes(file) && !newRoot(file))
          problems.push(`${FENCE_ALLOWLIST}: ${file} is new; the allowlist only shrinks.`)
    }
  }
  return problems
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2)
  const base = args.includes('--base') ? args[args.indexOf('--base') + 1] : undefined
  if (args.includes('--base') && !base) throw new Error('--base needs a ref')
  const problems = ratchetProblems(path.resolve(import.meta.dirname, '..'), { base })
  for (const problem of problems) console.error(problem)
  console.log(`Source ratchets: ${problems.length} problems.`)
  if (problems.length) process.exitCode = 1
}
