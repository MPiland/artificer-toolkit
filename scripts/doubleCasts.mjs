// QUALITY-3: production code never casts through `unknown` (`value as unknown as T`). Type the value
// instead: a schema-derived type, a narrowing guard, or a generic. Test files and test helpers
// (`isTestPath`) and generated modules are exempt. `ALLOWED` lists the casts no local typing can
// remove yet, by file with an exact count; entries only ever shrink.
//
//   node scripts/doubleCasts.mjs   fails on any double cast (`yarn lint:casts`, part of `yarn lint`)
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { parseSync } from 'oxc-parser'
import { isTestPath } from './redProof.mjs'

const isUnknownAssertion = (node) =>
  (node?.type === 'TSAsExpression' || node?.type === 'TSTypeAssertion') &&
  node.typeAnnotation.type === 'TSUnknownKeyword'

const unwrapParentheses = (node) =>
  node?.type === 'ParenthesizedExpression' ? unwrapParentheses(node.expression) : node

/** Byte offsets of every assertion whose operand is itself an assertion to `unknown`. */
export const findDoubleCasts = (filename, source) => {
  const offsets = []
  const visit = (node) => {
    if (Array.isArray(node)) return node.forEach(visit)
    if (!node || typeof node.type !== 'string') return
    if (
      (node.type === 'TSAsExpression' || node.type === 'TSTypeAssertion') &&
      isUnknownAssertion(unwrapParentheses(node.expression))
    )
      offsets.push(node.start)
    for (const [key, value] of Object.entries(node))
      if (key !== 'parent' && value && typeof value === 'object') visit(value)
  }
  visit(parseSync(filename, source).program)
  return offsets
}

/** Each file's double casts, with why typing cannot remove them yet (QUALITY-3 workbook findings). */
export const ALLOWED = {
  'apps/apis/convex/characters/stateDocuments.ts': {
    count: 1,
    reason: "Convex widens a generic table's query rows; the row is from the given table"
  },
  'apps/apis/convex/lib/convexEncounterStore.ts': {
    count: 2,
    reason: 'Convex handles over a runtime-selected table cannot carry the generic Table'
  },
  'apps/apis/convex/lib/domainRejectionTransport.ts': {
    count: 2,
    reason: "one wrapper serves every generic Convex builder and keeps the builder's signature"
  },
  'apps/apis/convex/lib/receiptLedgers.ts': {
    count: 1,
    reason: "a table-selected schema's parse result cannot carry the generic Table"
  },
  'packages/encounter-persistence/src/memoryEncounterStore.ts': {
    count: 1,
    reason: 'one Map-backed generic store implements the per-table overload intersection'
  },
  'packages/shared/src/domains/effects/maps/path.ts': {
    count: 9,
    reason: 'the outcome map is reused as a typed child map and builder API of other documents'
  }
}

/** Problems with the findings (`{ file, line }`) against the allowlist; empty when they match exactly. */
export const allowlistProblems = (findings, allowed = ALLOWED) => {
  const counts = new Map()
  for (const { file } of findings) counts.set(file, (counts.get(file) ?? 0) + 1)
  const problems = findings
    .filter(({ file }) => !Object.hasOwn(allowed, file))
    .map(({ file, line }) => `${file}:${line}: cast through unknown; type the value instead.`)
  for (const [file, { count }] of Object.entries(allowed)) {
    const found = counts.get(file) ?? 0
    if (found !== count)
      problems.push(
        `${file}: ${found} double casts, allowlist says ${count}; ${found < count ? 'lower the allowlist count' : 'type the new cast instead'}.`
      )
  }
  return problems
}

const checkedFile = (file) =>
  /\.[cm]?tsx?$/.test(file) &&
  !file.endsWith('.d.ts') &&
  !file.split('/').includes('_generated') &&
  !isTestPath(file)

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const root = path.resolve(import.meta.dirname, '..')
  const files = execFileSync('git', ['ls-files', '--', 'apps', 'packages', 'scripts'], {
    cwd: root,
    encoding: 'utf8'
  })
    .split('\n')
    .filter(checkedFile)
  const findings = files.flatMap((file) => {
    const source = readFileSync(path.join(root, file), 'utf8')
    return findDoubleCasts(file, source).map((offset) => ({
      file,
      line: source.slice(0, offset).split('\n').length
    }))
  })
  const problems = allowlistProblems(findings)
  for (const problem of problems) console.error(problem)
  console.log(
    `Checked ${files.length} modules: ${findings.length} double casts, ${problems.length} problems.`
  )
  if (problems.length) process.exit(1)
}
