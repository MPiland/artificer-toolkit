// Affected-test selection for the Tests workflow (PLATFORM-23, docs/architecture/ci-validation.md).
// A slice runs only the Vitest files whose static import graph reaches a file it changed since the
// phase branch; merge batches, pushes already on the phase branch and config changes run every file.
//   node scripts/affectedTests.mjs --base <ref> [--branch <name>] [--full]
// Writes `full`, `run-<suite>`, `<suite>-files` and `convex-shards`, and the red job's `merge-base`,
// `red-files` and `red-suites`, to $GITHUB_OUTPUT when set.
import { execFileSync } from 'node:child_process'
import { appendFileSync, readFileSync, statSync } from 'node:fs'
import { posix, relative, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { isTestPath } from './redProof.mjs'

/** Every Vitest run CI makes; each test file must belong to one of them or to LOCAL_ONLY. */
export const SUITES = [
  { name: 'packages', config: 'vitest.config.ts', root: '.' },
  { name: 'convex', config: 'apps/apis/vitest.config.ts', root: '.' },
  { name: 'worker', config: 'apps/session-worker/vitest.config.ts', root: 'apps/session-worker' },
  { name: 'web', config: 'apps/web/vitest.config.ts', root: 'apps/web', project: 'unit' }
]

/** Playwright specs run locally against a served app (AGENTS.md Validation), not in this workflow. */
export const LOCAL_ONLY = /^apps\/web\/tests\//

const TEST_FILE = /\.(test|spec)\.[cm]?[jt]sx?$/

/** Changes no import graph sees: dependencies, toolchain and test-runner configuration, this selector. */
const FULL_RUN = [
  /(^|\/)package\.json$/,
  /^yarn\.lock$/,
  /^\.yarnrc\.yml$/,
  /^\.yarn\//,
  /^\.(nvmrc|node-version)$/,
  /^turbo\.json$/,
  /(^|\/)tsconfig[^/]*\.json$/,
  /(^|\/)vite(st)?\.config\.[cm]?[jt]s$/,
  /(^|\/)wrangler\.jsonc?$/,
  /^\.github\/(workflows\/tests\.yml|actions\/)/,
  /^scripts\/(affectedTests|redProof)\.mjs$/
]

const CODE_FILE = /\.[cm]?[jt]sx?$/
const SOURCE_ROOT = /^(apps|packages|scripts)\//
const RESOLVE_EXTENSIONS = [
  '.ts',
  '.d.ts',
  '.tsx',
  '.mts',
  '.cts',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.json'
]
const FS_MODULES = new Set(['fs', 'node:fs', 'fs/promises', 'node:fs/promises'])

/** Uncommitted generated modules and the generator each is built from (AGENTS.md Validation). */
const GENERATED = {
  'apps/apis/convex/content/srdManifest.generated.ts': 'apps/apis/scripts/generateSrdManifest.ts'
}

// Over-matching (a specifier in a comment or string) only adds tests, never drops one.
const IMPORT_PATTERNS = [
  /\bfrom\s*['"]([^'"\n]+)['"]/g,
  /\bimport\s*['"]([^'"\n]+)['"]/g,
  /\bimport\s*\(\s*['"]([^'"\n]+)['"]\s*[,)]/g,
  /\brequire\s*\(\s*['"]([^'"\n]+)['"]\s*\)/g,
  /\bvi\.(?:mock|doMock|importActual)\s*(?:<[^>]*>)?\s*\(\s*['"]([^'"\n]+)['"]/g
]
const URL_PATTERN = /\bnew URL\(\s*['"]([^'"\n]+)['"]\s*,\s*import\.meta\.url/g
const GLOB_PATTERN = /\bimport\.meta\.glob(?:<[^>]*>)?\(\s*(\[[^\]]*\]|'[^']*'|"[^"]*")/g

function matchAll(text, pattern) {
  return [...text.matchAll(pattern)].map((match) => match[1])
}

function globToRegExp(glob) {
  let source = ''
  for (let index = 0; index < glob.length; index += 1) {
    const char = glob[index]
    if (glob.startsWith('**/', index)) {
      source += '(?:.*/)?'
      index += 2
    } else if (glob.startsWith('**', index)) {
      source += '.*'
      index += 1
    } else if (char === '*') source += '[^/]*'
    else if (char === '?') source += '[^/]'
    else if (char === '{') source += '(?:'
    else if (char === '}') source += ')'
    else if (char === ',') source += '|'
    else source += char.replace(/[.+^$()|[\]\\]/g, '\\$&')
  }
  return new RegExp(`^${source}$`)
}

/**
 * Parses tsconfig JSONC (TypeScript 7 ships no JS API). Each pass matches a whole string literal first
 * and keeps it, so only comments and trailing commas outside strings are removed.
 */
function readJsonc(path) {
  const string = /("(?:[^"\\]|\\.)*")/.source
  const text = readFileSync(path, 'utf8').replace(
    new RegExp(`${string}|//[^\\n]*|/\\*[\\s\\S]*?\\*/`, 'g'),
    (_, literal) => literal ?? ''
  )
  return JSON.parse(
    text.replace(
      new RegExp(`${string}|,(\\s*[}\\]])`, 'g'),
      (_, literal, close) => literal ?? close
    )
  )
}

/** The string a package.json `exports`/`imports` entry points at for `subpath`. */
function packageTarget(map, subpath) {
  const pick = (value) =>
    typeof value === 'string'
      ? value
      : value && typeof value === 'object'
        ? (pick(value.types) ?? pick(value.import) ?? pick(value.default) ?? null)
        : null
  if (typeof map === 'string') return subpath === '.' ? map : null
  if (!map) return null
  if (map[subpath] !== undefined) return pick(map[subpath])
  for (const [key, value] of Object.entries(map)) {
    const star = key.indexOf('*')
    if (star < 0) continue
    const [prefix, suffix] = [key.slice(0, star), key.slice(star + 1)]
    if (subpath.startsWith(prefix) && subpath.endsWith(suffix) && subpath.length >= key.length - 1)
      return pick(value)?.replaceAll(
        '*',
        subpath.slice(prefix.length, subpath.length - suffix.length)
      )
  }
  return null
}

/**
 * The repository's static import graph over tracked source files. Workspace packages resolve to their
 * source, not their built `dist`, so a test reaches a package file it imports through another package.
 */
export function buildImportGraph(root, tracked) {
  const trackedSet = new Set(tracked)
  const statCache = new Map()
  const kind = (path) => {
    if (!statCache.has(path)) {
      let value = trackedSet.has(path) || GENERATED[path] ? 'file' : null
      if (!value) {
        try {
          const stat = statSync(resolve(root, path))
          value = stat.isFile() ? 'file' : stat.isDirectory() ? 'dir' : null
        } catch {
          value = null
        }
      }
      statCache.set(path, value)
    }
    return statCache.get(path)
  }
  const resolveFile = (base) => {
    const stem = base.replace(/\.d\.ts$|\.[cm]?jsx?$/, '')
    const candidates = [
      base,
      ...RESOLVE_EXTENSIONS.map((extension) => stem + extension),
      ...RESOLVE_EXTENSIONS.map((extension) => `${base}/index${extension}`)
    ]
    return candidates.find((candidate) => kind(candidate) === 'file') ?? null
  }

  const workspaces = tracked
    .filter((path) => /^(apps|packages)\/[^/]+\/package\.json$/.test(path))
    .map((path) => {
      const manifest = JSON.parse(readFileSync(resolve(root, path), 'utf8'))
      return { dir: posix.dirname(path), name: manifest.name, manifest }
    })
  const workspaceOf = (path) => workspaces.find(({ dir }) => path.startsWith(`${dir}/`))
  // A built `dist/x.js` target maps to the `src/x.ts` it is compiled from; if it cannot, the whole
  // package is the dependency.
  const resolvePackageTarget = (workspace, target) => {
    if (!target) return { dir: workspace.dir }
    const path = posix.join(workspace.dir, target.replace(/^\.\/dist\//, './src/'))
    return resolveFile(path) ?? { dir: workspace.dir }
  }

  const tsconfigPaths = new Map()
  const pathsFor = (dir) => {
    if (tsconfigPaths.has(dir)) return tsconfigPaths.get(dir)
    let value = null
    if (kind(`${dir}/tsconfig.json`) === 'file') {
      let configPath = `${dir}/tsconfig.json`
      while (configPath && !value) {
        const config = readJsonc(resolve(root, configPath))
        const configDir = posix.dirname(configPath)
        if (config.compilerOptions?.paths) {
          const base = posix.join(configDir, config.compilerOptions.baseUrl ?? '.')
          value = { base, paths: config.compilerOptions.paths }
        }
        configPath =
          typeof config.extends === 'string' && config.extends.startsWith('.')
            ? posix.join(configDir, config.extends)
            : null
      }
    } else if (dir !== '.') value = pathsFor(posix.dirname(dir))
    tsconfigPaths.set(dir, value)
    return value
  }
  const resolveTsconfigPath = (specifier, importer) => {
    const config = pathsFor(posix.dirname(importer))
    if (!config) return null
    const target = packageTarget(
      Object.fromEntries(Object.entries(config.paths).map(([key, [first]]) => [key, first])),
      specifier
    )
    return target ? resolveFile(posix.join(config.base, target)) : null
  }

  const resolveSpecifier = (specifier, importer) => {
    const clean = specifier.replace(/[?#].*$/, '') || specifier
    if (clean.startsWith('.')) return resolveFile(posix.join(posix.dirname(importer), clean))
    if (specifier.startsWith('#')) {
      const workspace = workspaceOf(importer)
      const target = workspace && packageTarget(workspace.manifest.imports, specifier)
      if (target) return resolvePackageTarget(workspace, target)
      return resolveTsconfigPath(specifier, importer)
    }
    const workspace = workspaces.find(
      ({ name }) => specifier === name || specifier.startsWith(`${name}/`)
    )
    if (workspace) {
      const subpath = `.${specifier.slice(workspace.name.length)}`
      return resolvePackageTarget(workspace, packageTarget(workspace.manifest.exports, subpath))
    }
    return resolveTsconfigPath(specifier, importer)
  }

  /** importers.get(file): the files that import `file`. */
  const importers = new Map()
  /** Dependencies on a set of paths (a glob, a directory, a whole package), checked by predicate. */
  const predicates = []
  const addEdge = (importer, dependency) => {
    if (typeof dependency === 'string') {
      if (!importers.has(dependency)) importers.set(dependency, new Set())
      importers.get(dependency).add(importer)
    } else predicates.push({ importer, matches: (path) => path.startsWith(`${dependency.dir}/`) })
  }

  for (const importer of tracked.filter((path) => SOURCE_ROOT.test(path) && CODE_FILE.test(path))) {
    const text = readFileSync(resolve(root, importer), 'utf8')
    const specifiers = IMPORT_PATTERNS.flatMap((pattern) => matchAll(text, pattern))
    for (const specifier of specifiers) {
      if (FS_MODULES.has(specifier) && isTestPath(importer)) {
        // A test or test helper that reads source files itself (an architecture or boundary scan, the
        // generated route tree) can depend on any of them, so every source change selects its tests.
        predicates.push({ importer, readsSource: true, matches: (path) => SOURCE_ROOT.test(path) })
        continue
      }
      const dependency = resolveSpecifier(specifier, importer)
      if (dependency) {
        addEdge(importer, dependency)
        if (GENERATED[dependency]) addEdge(dependency, GENERATED[dependency])
      } else if (specifier.startsWith('.')) {
        // A file this change deleted no longer resolves; its importers still depend on it.
        const stem = posix.join(posix.dirname(importer), specifier).replace(/\.[cm]?[jt]sx?$/, '')
        predicates.push({
          importer,
          matches: (path) =>
            [/(\.d)?\.[cm]?[jt]sx?$/, /\/index(\.d)?\.[cm]?[jt]sx?$/].some(
              (extension) => path.replace(extension, '') === stem
            )
        })
      }
    }
    // A file URL is read or loaded (a Worker module, a corpus text); a directory URL is a working
    // directory, and a test that scans one imports node:fs above.
    for (const specifier of matchAll(text, URL_PATTERN)) {
      const path = posix.join(posix.dirname(importer), specifier)
      if (kind(path) === 'file') addEdge(importer, path)
    }
    // convex-test loads globbed modules on demand, so every module a glob matches is a dependency.
    // The test files it also matches are never loaded as modules.
    for (const argument of matchAll(text, GLOB_PATTERN))
      for (const glob of matchAll(argument, /['"]([^'"]+)['"]/g).filter(
        (g) => !g.startsWith('!')
      )) {
        const pattern = globToRegExp(
          glob.startsWith('/') ? glob.slice(1) : posix.join(posix.dirname(importer), glob)
        )
        predicates.push({
          importer,
          matches: (path) => pattern.test(path) && !TEST_FILE.test(path)
        })
      }
  }
  return { importers, predicates }
}

/** Every file that imports, directly or transitively, one of `changed` (including `changed`). */
export function affectedFiles(graph, changed) {
  const affected = new Set(changed)
  const queue = [...changed]
  let pending = graph.predicates
  while (queue.length > 0) {
    while (queue.length > 0)
      for (const importer of graph.importers.get(queue.pop()) ?? [])
        if (!affected.has(importer)) {
          affected.add(importer)
          queue.push(importer)
        }
    const affectedPaths = [...affected]
    pending = pending.filter(({ importer, matches }) => {
      if (affected.has(importer)) return false
      if (!affectedPaths.some(matches)) return true
      affected.add(importer)
      queue.push(importer)
      return false
    })
  }
  return affected
}

/** The test file a changed snapshot belongs to stands in for it. */
function snapshotOwner(path) {
  const match = /^(.*\/)__snapshots__\/(.+)\.snap$/.exec(path)
  return match ? `${match[1]}${match[2]}` : path
}

/**
 * Root-relative test files per suite that `changed` can affect. A suite whose setup files are
 * affected runs every test file.
 */
export function selectTests(graph, suites, changed) {
  const affected = affectedFiles(graph, changed.map(snapshotOwner))
  return Object.fromEntries(
    suites.map(({ name, tests, setupFiles }) => [
      name,
      setupFiles.some((file) => affected.has(file))
        ? tests
        : tests.filter((test) => affected.has(test))
    ])
  )
}

/** Why `changed` needs the full run, or null. */
export function fullRunReason(changed, suites) {
  const setupFiles = new Set(suites.flatMap(({ setupFiles }) => setupFiles))
  const trigger = changed.find(
    (path) => setupFiles.has(path) || FULL_RUN.some((pattern) => pattern.test(path))
  )
  return trigger ? `${trigger} changed` : null
}

/**
 * The Convex shard matrix. Shards are parallel runners, and one Convex file can take as long as a
 * hundred others, so any selection spreads over as many shards as it has files, up to four.
 */
export function convexShards(selectedCount, full) {
  return Array.from({ length: full ? 4 : Math.min(4, selectedCount) }, (_, index) => index + 1)
}

/**
 * What the red job proves (scripts/redProof.mjs): the test files and helpers the slice adds or modifies,
 * and per suite the test files among them, which run against the merge base's production code.
 */
export function redProof(suites, addedOrModified) {
  const files = addedOrModified.filter(isTestPath)
  return {
    files,
    suites: suites
      .map(({ name, config, root, project, tests }) => ({
        name,
        config,
        root,
        project,
        tests: tests.filter((test) => files.includes(test))
      }))
      .filter(({ tests }) => tests.length > 0)
  }
}

/** Throws when a tracked test file belongs to no CI suite, so no test can silently stop running. */
export function assertEveryTestRuns(tracked, suites) {
  const inSuite = new Set(suites.flatMap(({ tests }) => tests))
  const missing = tracked.filter(
    (path) => TEST_FILE.test(path) && !LOCAL_ONLY.test(path) && !inSuite.has(path)
  )
  if (missing.length > 0)
    throw new Error(`Test files outside every CI suite:\n${missing.join('\n')}`)
}

/**
 * Each suite's test files and setup files, root-relative, from Vitest's own config resolution. Files a
 * config names (a Worker entry, a setup file) count as setup files: every test in the suite loads them.
 */
export async function listSuites(root) {
  const { createVitest } = await import('vitest/node')
  const toRoot = (path) => relative(root, path).replaceAll('\\', '/')
  const suites = []
  for (const suite of SUITES) {
    const vitest = await createVitest('test', {
      config: resolve(root, suite.config),
      root: resolve(root, suite.root),
      run: true,
      watch: false,
      ...(suite.project ? { project: suite.project } : {})
    })
    try {
      const tests = (await vitest.globTestSpecifications()).map(({ moduleId }) => toRoot(moduleId))
      const configText = readFileSync(resolve(root, suite.config), 'utf8')
      const named = matchAll(configText, /['"](\.{1,2}\/[^'"]+\.[cm]?[jt]sx?)['"]/g).map((path) =>
        posix.join(suite.root, path)
      )
      const setupFiles = vitest.projects.flatMap(({ config }) => config.setupFiles.map(toRoot))
      suites.push({
        ...suite,
        tests: [...new Set(tests)].sort(),
        setupFiles: [...new Set([...setupFiles, ...named])]
      })
    } finally {
      await vitest.close()
    }
  }
  return suites
}

const git = (root, ...args) =>
  execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
    .split('\n')
    .filter(Boolean)

/** Every path HEAD changes against `base`, and those it adds or modifies; a rename is a delete and an add. */
export function changesSince(root, base) {
  const diff = git(root, 'diff', '--name-status', '--no-renames', base, 'HEAD').map((line) =>
    line.split('\t')
  )
  return {
    changed: diff.map(([, path]) => path),
    addedOrModified: diff
      .filter(([status]) => status === 'A' || status === 'M')
      .map(([, path]) => path)
  }
}

async function main() {
  const root = resolve(import.meta.dirname, '..')
  const args = process.argv.slice(2)
  const option = (name) => {
    const index = args.indexOf(name)
    return index >= 0 ? args[index + 1] : undefined
  }
  const base = option('--base')
  if (!base) throw new Error('--base <ref> is required')
  const branch = option('--branch') ?? ''

  const tracked = git(root, 'ls-files')
  const suites = await listSuites(root)
  assertEveryTestRuns(tracked, suites)
  const [mergeBase] = git(root, 'merge-base', 'HEAD', base)
  const { changed, addedOrModified } = changesSince(root, mergeBase)
  const red = redProof(suites, addedOrModified)

  let fullReason = args.includes('--full') ? 'a full run was requested' : null
  fullReason ??= branch.startsWith('ci/merge-') ? `${branch} is a merge batch` : null
  fullReason ??= changed.length === 0 ? `HEAD is already on ${base}` : null
  fullReason ??= fullRunReason(changed, suites)
  const selected = fullReason
    ? Object.fromEntries(suites.map(({ name, tests }) => [name, tests]))
    : selectTests(buildImportGraph(root, tracked), suites, changed)

  const lines = [
    fullReason
      ? `Full run: ${fullReason}.`
      : `${changed.length} files changed since ${base} (${mergeBase.slice(0, 9)}).`,
    ...suites.map(
      ({ name, tests }) => `${name}: ${selected[name].length} of ${tests.length} test files`
    )
  ]
  console.log(lines.join('\n'))
  if (!fullReason)
    for (const [name, files] of Object.entries(selected))
      for (const file of files) console.log(`  ${name} ${file}`)

  const output = process.env.GITHUB_OUTPUT
  if (output) {
    // The jobs split the space-separated file lists unquoted.
    const spaced = [...Object.values(selected).flat(), ...red.files].find((file) => /\s/.test(file))
    if (spaced) throw new Error(`Test file paths cannot contain whitespace: ${spaced}`)
    const suiteRoot = Object.fromEntries(
      suites.map(({ name, root: suiteRootDir }) => [name, suiteRootDir])
    )
    appendFileSync(
      output,
      [
        `full=${fullReason ? 'true' : 'false'}`,
        `merge-base=${mergeBase}`,
        `red-files=${red.files.join(' ')}`,
        `red-suites=${JSON.stringify(red.suites)}`,
        `convex-shards=${JSON.stringify(convexShards(selected.convex.length, Boolean(fullReason)))}`,
        ...Object.entries(selected).flatMap(([name, files]) => [
          `run-${name}=${files.length > 0}`,
          // Paths relative to the directory the suite's Vitest runs from; empty on a full run.
          `${name}-files=${fullReason ? '' : files.map((file) => posix.relative(suiteRoot[name], file)).join(' ')}`
        ])
      ].join('\n') + '\n'
    )
  }
  if (process.env.GITHUB_STEP_SUMMARY)
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### Affected tests\n\n${lines.join('\n\n')}\n`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main()
