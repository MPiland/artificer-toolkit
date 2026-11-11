// RULES-2.T1 (ADR 0039 decision 6) and QUALITY-10.T1: three shrink-only ratchets.
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
// d20 settlement (QUALITY-10.1): in the rules runtime, Encounter persistence, Convex and the Session Worker
// only the modules `scripts/d20SettlementAllowlist.json` names as the `settlement` build a d20 evidence
// node, roll a d20, resolve its answer, keep its face or resume its graph. `handSettled` lists the modules
// that still do one of these by hand.
//
// With `--base <ref>` the lists are also compared with the ones at the merge base: a cap may not rise and
// no list may gain an entry, so a slice cannot buy itself room.
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
export const D20_ALLOWLIST = 'scripts/d20SettlementAllowlist.json'
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

const D20_FENCED = [
  RULES_RUNTIME,
  'packages/encounter-persistence/src/',
  'apps/apis/convex/',
  'apps/session-worker/src/'
]
// A call that settles part of a d20 test, which only the settlement makes.
const D20_SETTLEMENT_CALLS = {
  resolveEncounterD20Answer: 'resolves a d20 answer',
  rollModeKeptFace: 'keeps a d20 face',
  resumeEncounterD20: 'resumes a d20 graph'
}

/**
 * What a module does to a d20 by hand, each a step the one settlement owns: the calls of
 * `D20_SETTLEMENT_CALLS`, a literal 1-to-20 evidence node, and a die rolled as `roll(20) + 1`. The
 * die a host injects as `rollD20` is the seam the settlement draws from, so it is not counted.
 */
export const handSettledD20 = (file, source) => {
  const found = new Set()
  const literal = (node, value) => node?.type === 'Literal' && node.value === value
  const property = (node, name) =>
    node?.type === 'ObjectExpression'
      ? node.properties.find((entry) => entry.type === 'Property' && entry.key?.name === name)
          ?.value
      : undefined
  const visit = (node) => {
    if (Array.isArray(node)) return node.forEach(visit)
    if (!node || typeof node.type !== 'string') return
    if (
      (node.type === 'Property' && node.key?.name === 'rollD20') ||
      (node.type === 'VariableDeclarator' && node.id?.name === 'rollD20')
    )
      return
    if (node.type === 'CallExpression' && Object.hasOwn(D20_SETTLEMENT_CALLS, node.callee?.name))
      found.add(D20_SETTLEMENT_CALLS[node.callee.name])
    if (
      literal(property(property(node, 'min'), 'value'), 1) &&
      literal(property(property(node, 'max'), 'value'), 20)
    )
      found.add('builds a d20 evidence node')
    if (
      node.type === 'BinaryExpression' &&
      node.operator === '+' &&
      [
        [node.left, node.right],
        [node.right, node.left]
      ].some(
        ([roll, one]) =>
          literal(one, 1) &&
          roll.type === 'CallExpression' &&
          roll.arguments.some((argument) => literal(argument, 20))
      )
    )
      found.add('rolls a d20')
    for (const [key, value] of Object.entries(node))
      if (key !== 'parent' && value && typeof value === 'object') visit(value)
  }
  visit(parseSync(file, source).program)
  return [...found].sort()
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

  const { settlement, handSettled } = readJson(root, D20_ALLOWLIST)
  const d20Entries = [...Object.keys(settlement), ...handSettled]
  const d20ByHand = new Map(
    files
      .filter((file) => D20_FENCED.some((prefix) => file.startsWith(prefix)))
      .map((file) => [file, handSettledD20(file, source(file))])
      .filter(([, found]) => found.length > 0)
  )
  for (const [file, found] of d20ByHand)
    if (!d20Entries.includes(file))
      problems.push(
        `${file}: ${found.join(', ')} outside the d20 settlement; settle it through settleEncounterD20Test.`
      )
  for (const file of d20Entries)
    if (!d20ByHand.has(file))
      problems.push(`${D20_ALLOWLIST}: ${file} no longer settles a d20 by hand; remove it.`)

  if (base) {
    const baseD20 = baseJson(root, base, D20_ALLOWLIST)
    if (baseD20) {
      const baseEntries = [...Object.keys(baseD20.settlement), ...baseD20.handSettled]
      for (const file of d20Entries)
        if (!baseEntries.includes(file))
          problems.push(`${D20_ALLOWLIST}: ${file} is new; the allowlist only shrinks.`)
    }
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
