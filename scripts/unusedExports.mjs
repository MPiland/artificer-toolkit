// RELIABILITY-9.4: production web code exports only what it needs. A production export is unused when no
// production module imports it and either the module never uses it itself (dead, or kept for its tests and
// stories: move it next to them or delete it) or no test or story imports it either (drop `export`). Product
// logic the module uses itself and its unit test imports directly stays. Framework entry files and default
// exports are exempt. `UNUSED_EXPORTS_ALLOWED` lists exports that cannot go yet, by file and name; it only shrinks.
//
//   node scripts/unusedExports.mjs   fails on any unused production export (`yarn lint:exports`, part of `yarn lint`)
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { parseSync } from 'oxc-parser'
import { isTestPath } from './redProof.mjs'

const WEB_SRC = 'apps/web/src/'

/** Framework entry points load by convention, not by import. */
const ENTRY_FILE =
  /^apps\/web\/src\/(routes\/|routeTree\.gen\.ts$|router\.tsx$|client\.tsx$|server\.ts$|start\.ts$|instrument\.client\.ts$)/

/** Exports that cannot be removed yet: `file -> name -> why`. Entries only ever shrink. */
export const UNUSED_EXPORTS_ALLOWED = {}

const aliasTable = [
  ['#app/', 'src/'],
  ['#css/', 'src/css/'],
  ['#lib/', 'src/lib/'],
  ['#forms/', 'src/forms/'],
  ['#components/', 'src/components/'],
  ['#ui/', 'src/ui/'],
  ['#domains/', 'src/domains/'],
  ['#routes/', 'src/routes/'],
  ['#assets/', 'src/assets/'],
  ['#test/', 'src/test/']
]
const aliasIndexes = { '#forms': 'src/forms', '#ui': 'src/ui', '#auth': 'src/auth' }
const EXTENSIONS = ['', '.ts', '.tsx', '/index.ts', '/index.tsx', '.css.ts', '.js']

const isProductionFile = (file) =>
  file.startsWith(WEB_SRC) &&
  /\.[cm]?tsx?$/.test(file) &&
  !isTestPath(file) &&
  !/\.gen\.|\.stories\.|\.assertions\.|fixture|\.play\.|\/stories\//i.test(file)

/** Repo-relative path of the file a specifier points at, or undefined for packages and assets. */
const resolveSpecifier = (from, specifier, known) => {
  let base
  if (specifier.startsWith('.')) base = path.posix.join(path.posix.dirname(from), specifier)
  else if (aliasIndexes[specifier]) base = `apps/web/${aliasIndexes[specifier]}`
  else {
    const alias = aliasTable.find(([prefix]) => specifier.startsWith(prefix))
    if (!alias) return undefined
    base = `apps/web/${alias[1]}${specifier.slice(alias[0].length)}`
  }
  return EXTENSIONS.map((extension) => base + extension).find((candidate) => known.has(candidate))
}

/** How many times `name` is referenced in a module, not counting export lists. */
const localReferenceCounts = (program) => {
  const counts = new Map()
  const visit = (node) => {
    if (Array.isArray(node)) return node.forEach(visit)
    if (!node || typeof node.type !== 'string' || node.type === 'ExportSpecifier') return
    if (node.type === 'Identifier' || node.type === 'JSXIdentifier')
      counts.set(node.name, (counts.get(node.name) ?? 0) + 1)
    for (const [key, value] of Object.entries(node))
      if (key !== 'parent' && value && typeof value === 'object') visit(value)
  }
  visit(program)
  return counts
}

/**
 * Exports of production web modules that exist only for tests and stories, or for nothing.
 * `sources` maps every web source path (tests and stories included) to its text. A production export is
 * reported when no production module imports it and either
 * - the module never uses it itself (its code is dead or exists only for its tests and stories), or
 * - no test or story imports it either (the `export` keyword is the only surplus).
 * A function the module uses itself and that its unit test imports directly is product logic and stays.
 * Returns `{ file, name }` rows.
 */
export const findUnusedExports = (sources) => {
  const known = new Set(Object.keys(sources))
  const production = new Set([...known].filter(isProductionFile))
  const exportsByFile = new Map()
  const localUse = new Map()
  const importedBy = new Map(
    [...production].map((file) => [file, { prod: new Set(), other: new Set() }])
  )
  const mark = (importer, target, name) => {
    const imported = importedBy.get(target)
    if (imported) imported[production.has(importer) ? 'prod' : 'other'].add(name)
  }

  for (const file of known) {
    const source = sources[file]
    const { module, program } = parseSync(file, source)
    if (production.has(file)) {
      const exported = new Set()
      for (const { entries } of module.staticExports)
        for (const entry of entries)
          if (entry.exportName.kind === 'Name') exported.add(entry.exportName.name)
      exportsByFile.set(file, exported)
      localUse.set(file, localReferenceCounts(program))
    }
    for (const { entries } of module.staticExports)
      for (const entry of entries) {
        const request = entry.moduleRequest?.value
        const target = request && resolveSpecifier(file, request, known)
        if (!target) continue
        mark(file, target, entry.importName.kind === 'Name' ? entry.importName.name : '*')
      }
    for (const { moduleRequest, entries } of module.staticImports) {
      const target = resolveSpecifier(file, moduleRequest.value, known)
      if (!target) continue
      for (const entry of entries)
        mark(
          file,
          target,
          entry.importName.kind === 'Name'
            ? entry.importName.name
            : entry.importName.kind === 'Default'
              ? 'default'
              : '*'
        )
    }
    for (const { moduleRequest } of module.dynamicImports) {
      const literal = source.slice(moduleRequest.start, moduleRequest.end).match(/^['"`](.+)['"`]$/)
      const target = literal && resolveSpecifier(file, literal[1], known)
      if (target) mark(file, target, '*')
    }
  }

  return [...production].flatMap((file) => {
    if (ENTRY_FILE.test(file)) return []
    const { prod, other } = importedBy.get(file)
    if (prod.has('*')) return []
    return [...exportsByFile.get(file)]
      .filter((name) => name !== 'default' && !prod.has(name))
      .filter(
        (name) => (localUse.get(file).get(name) ?? 0) < 2 || !(other.has(name) || other.has('*'))
      )
      .map((name) => ({ file, name }))
  })
}

/** Problems with the findings against the allowlist; empty when they match exactly. */
export const unusedExportProblems = (findings, allowed = UNUSED_EXPORTS_ALLOWED) => {
  const problems = []
  for (const { file, name } of findings)
    if (!allowed[file]?.[name])
      problems.push(
        `${file}: export ${name} is not imported by production code; move it to its test or remove it.`
      )
  const found = new Set(findings.map(({ file, name }) => `${file}\0${name}`))
  for (const [file, names] of Object.entries(allowed))
    for (const name of Object.keys(names))
      if (!found.has(`${file}\0${name}`))
        problems.push(
          `${file}: allowlisted export ${name} is now used or gone; delete the allowlist entry.`
        )
  return problems
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const root = path.resolve(import.meta.dirname, '..')
  const files = execFileSync('git', ['ls-files', '-z', '--', WEB_SRC], {
    cwd: root,
    encoding: 'utf8'
  })
    .split('\0')
    .filter((file) => file && /\.[cm]?tsx?$/.test(file) && existsSync(path.join(root, file)))
  const sources = Object.fromEntries(
    files.map((file) => [file, readFileSync(path.join(root, file), 'utf8')])
  )
  const findings = findUnusedExports(sources)
  const problems = unusedExportProblems(findings)
  for (const problem of problems) console.error(problem)
  console.log(
    `Checked ${files.length} web modules: ${findings.length} unused exports, ${problems.length} problems.`
  )
  if (problems.length) process.exitCode = 1
}
