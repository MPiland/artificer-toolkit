// QUALITY-3: production code never casts through `unknown` (`value as unknown as T`). Type the value
// instead: a schema-derived type, a narrowing guard, or a generic. Test files and test helpers
// (`isTestPath`) and generated modules are exempt. `ALLOWED` lists the casts no local typing can
// remove yet, by file with an exact count; entries only ever shrink.
//
// RELIABILITY-9.8: web code never narrows untrusted data with `value as T` (route params, select
// values, query results, storage, JSON). Parse it with a `packages/schema` contract, a type guard, or
// a lookup helper (`findOption`, `isRecord`). `WEB_NARROWING_ALLOWED` lists the remaining casts of a
// read value in `apps/web/src` by file with an exact count; entries only ever shrink.
//
//   node scripts/doubleCasts.mjs   fails on any double cast or web narrowing cast (`yarn lint:casts`, part of `yarn lint`)
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

const narrowedOperandTypes = new Set([
  'Identifier',
  'MemberExpression',
  'CallExpression',
  'ChainExpression',
  'TSNonNullExpression',
  'ConditionalExpression',
  'LogicalExpression',
  'TemplateLiteral'
])

const isConstAssertion = (node) =>
  node.typeAnnotation.type === 'TSTypeReference' && node.typeAnnotation.typeName?.name === 'const'

/** Byte offsets of every `value as T` that narrows a read value; `as const` and `as unknown` are safe. */
export const findNarrowingCasts = (filename, source) => {
  const offsets = []
  const visit = (node) => {
    if (Array.isArray(node)) return node.forEach(visit)
    if (!node || typeof node.type !== 'string') return
    if (
      (node.type === 'TSAsExpression' || node.type === 'TSTypeAssertion') &&
      !isConstAssertion(node) &&
      !isUnknownAssertion(node) &&
      narrowedOperandTypes.has(unwrapParentheses(node.expression).type)
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
    count: 8,
    reason: 'the outcome map is reused as a typed child map and builder API of other documents'
  }
}

/** Remaining narrowing casts in `apps/web/src`, with why typing cannot remove them yet (RELIABILITY-9.8). */
export const WEB_NARROWING_ALLOWED = {
  'apps/web/src/css/foundations.css.ts': {
    count: 5,
    reason: 'Object.fromEntries widens the mapped token scale the foundations define'
  },
  'apps/web/src/data/characters/queries.ts': {
    count: 1,
    reason: 'the slice map is correlated to the generic Slice key of already-typed Convex data'
  },
  'apps/web/src/data/contentSnapshots/contentSnapshotStore.ts': {
    count: 1,
    reason:
      'bytes are bound by the manifest sha256 check; a full parse of every document costs more'
  },
  'apps/web/src/data/contentSnapshots/manifestObjects.ts': {
    count: 1,
    reason: 'Object.entries widens the key of a map keyed by the kind enum'
  },
  'apps/web/src/data/imports/importClient.ts': {
    count: 1,
    reason: 'Convex storage ids cross the transport as plain strings'
  },
  'apps/web/src/domains/campaigns/vtt/vttSceneRenderer.ts': {
    count: 2,
    reason: 'Object.keys widens the keys of a typed input record'
  },
  'apps/web/src/domains/characters/builder/evaluation/builderEvaluator.ts': {
    count: 2,
    reason: 'validated Character DTOs use literal starting-equipment sources for the authored enum'
  },
  'apps/web/src/forms/factories/authoredFormSessionFactory.ts': {
    count: 4,
    reason: 'TanStack Form values and payloads are generic over the domain the factory serves'
  },
  'apps/web/src/forms/node-map/nodeFormUtils.ts': {
    count: 4,
    reason: 'node-map paths are strings that TanStack Form types as DeepKeys of the form values'
  },
  'apps/web/src/forms/rendering/FormRenderer.tsx': {
    count: 1,
    reason: 'TanStack Form types field meta by DeepKeys; the renderer reads it by node path'
  },
  'apps/web/src/forms/rendering/ResolvedArrayGroup.factory.tsx': {
    count: 4,
    reason: 'TanStack Form field APIs are generic over the domain values the factory is bound to'
  },
  'apps/web/src/forms/rendering/ResolvedCollectionOverview.factory.tsx': {
    count: 6,
    reason: 'TanStack Form field APIs are generic over the domain values the factory is bound to'
  },
  'apps/web/src/forms/rendering/ResolvedObjectGroup.factory.tsx': {
    count: 2,
    reason: 'TanStack Form field APIs are generic over the domain values the factory is bound to'
  },
  'apps/web/src/forms/rendering/authoringNodeDefaultRegistry.ts': {
    count: 1,
    reason: 'Object.entries widens the key of the default-kind map'
  },
  'apps/web/src/forms/utils/pathUtils.ts': {
    count: 3,
    reason: 'field-name strings are typed as TanStack Form DeepKeys of the generic form values'
  },
  'apps/web/src/lib/richText.tsx': {
    count: 4,
    reason: 'html-react-parser DOM nodes are loosely typed by the library'
  }
}

const doubleCastLabels = { noun: 'double casts', problem: 'cast through unknown' }
const narrowingCastLabels = { noun: 'narrowing casts', problem: 'cast narrows a read value' }

/** Problems with the findings (`{ file, line }`) against the allowlist; empty when they match exactly. */
export const allowlistProblems = (
  findings,
  allowed = ALLOWED,
  { noun, problem: what } = doubleCastLabels
) => {
  const counts = new Map()
  for (const { file } of findings) counts.set(file, (counts.get(file) ?? 0) + 1)
  const problems = findings
    .filter(({ file }) => !Object.hasOwn(allowed, file))
    .map(({ file, line }) => `${file}:${line}: ${what}; type the value instead.`)
  for (const [file, { count }] of Object.entries(allowed)) {
    const found = counts.get(file) ?? 0
    if (found !== count)
      problems.push(
        `${file}: ${found} ${noun}, allowlist says ${count}; ${found < count ? 'lower the allowlist count' : 'type the new cast instead'}.`
      )
  }
  return problems
}

const checkedFile = (file) =>
  /\.[cm]?tsx?$/.test(file) &&
  !file.endsWith('.d.ts') &&
  !file.split('/').includes('_generated') &&
  !isTestPath(file)

const isWebProductionFile = (file) =>
  file.startsWith('apps/web/src/') && !/\.gen\.|\.stories\.|fixture|\.play\./.test(file)

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const root = path.resolve(import.meta.dirname, '..')
  const files = execFileSync('git', ['ls-files', '--', 'apps', 'packages', 'scripts'], {
    cwd: root,
    encoding: 'utf8'
  })
    .split('\n')
    .filter(checkedFile)
  const locate = (find) => (file) => {
    const source = readFileSync(path.join(root, file), 'utf8')
    return find(file, source).map((offset) => ({
      file,
      line: source.slice(0, offset).split('\n').length
    }))
  }
  const findings = files.flatMap(locate(findDoubleCasts))
  const narrowing = files.filter(isWebProductionFile).flatMap(locate(findNarrowingCasts))
  const problems = [
    ...allowlistProblems(findings),
    ...allowlistProblems(narrowing, WEB_NARROWING_ALLOWED, narrowingCastLabels)
  ]
  for (const problem of problems) console.error(problem)
  console.log(
    `Checked ${files.length} modules: ${findings.length} double casts, ${narrowing.length} web narrowing casts, ${problems.length} problems.`
  )
  if (problems.length) process.exit(1)
}
