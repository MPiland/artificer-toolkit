// D59: every packages/schema module builds its Zod schemas lazily, because Convex re-evaluates a
// function's module graph on every call. See docs/architecture/transport.md#lazy-schema-construction.
//
//   node scripts/lazySchemas.mjs [file…]   wraps each eager module-level schema initializer in
//                                          `lazySchema(() => …)` and adds the `zod.js` import
//   node scripts/lazySchemas.mjs --check   changes nothing; fails on any schema built at module
//                                          load (`yarn lint:schemas`, part of `yarn lint`)
//
// Module scope may still reference a schema, but must not call `z.*`, call or read a schema
// binding, or call a local schema builder. Sites the rewrite cannot wrap (shared shapes and
// variant lists, which take `lazySchemaParts`) are reported for a hand edit in both modes.
// `z.json()` stays eager: it references its own instance, so a proxy would give it two identities
// and change `zodToConvex` and JSON Schema output.
import { parse } from '@babel/parser'
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const sourceRoot = path.join(root, 'packages/schema/src')
const check = process.argv.includes('--check')
const explicitFiles = process.argv.slice(2).filter((arg) => !arg.startsWith('--'))

const files = explicitFiles.length
  ? explicitFiles.map((file) => path.resolve(root, file))
  : readdirSync(sourceRoot, { recursive: true, withFileTypes: true })
      .filter(
        (entry) =>
          entry.isFile() &&
          entry.name.endsWith('.ts') &&
          !entry.name.endsWith('.d.ts') &&
          !entry.name.includes('.test.') &&
          !/[\\/]__tests__([\\/]|$)/.test(entry.parentPath)
      )
      .map((entry) => path.join(entry.parentPath, entry.name))
      .filter((file) => file !== path.join(sourceRoot, 'zod.ts'))

// packages/schema/src/zod.ts helpers whose builder argument runs later, not at module load.
const deferringHelpers = new Set(['lazySchema', 'lazySchemaParts'])
const typeAssertionTypes = new Set([
  'TSAsExpression',
  'TSSatisfiesExpression',
  'TSNonNullExpression'
])
// The identifier a call or member chain starts from, such as `z` in `z.string().check(…)`.
const chainRoot = (node) => {
  let current = node
  for (;;) {
    if (current.type === 'CallExpression') current = current.callee
    else if (current.type === 'MemberExpression') current = current.object
    else if (typeAssertionTypes.has(current.type)) current = current.expression
    else return current
  }
}
const isZodJson = (node) =>
  node.type === 'CallExpression' &&
  node.callee.type === 'MemberExpression' &&
  node.callee.object.type === 'Identifier' &&
  node.callee.object.name === 'z' &&
  node.callee.property.name === 'json'
const topLevelDeclarators = (program) =>
  program.body.flatMap((statement) => {
    const declaration =
      statement.type === 'ExportNamedDeclaration' ? statement.declaration : statement
    return declaration?.type === 'VariableDeclaration' && declaration.kind === 'const'
      ? declaration.declarations.filter((declarator) => declarator.id.type === 'Identifier')
      : []
  })

// Bindings that hold a schema: `*Schema` value imports from sibling modules and local constants
// initialized from `z` or `lazySchema`.
const schemaBindingsOf = (program) => {
  const bindings = new Set()
  for (const statement of program.body)
    if (
      statement.type === 'ImportDeclaration' &&
      statement.importKind !== 'type' &&
      statement.source.value.startsWith('.')
    )
      for (const specifier of statement.specifiers)
        if (
          specifier.importKind !== 'type' &&
          !deferringHelpers.has(specifier.local.name) &&
          /Schema$/.test(specifier.local.name)
        )
          bindings.add(specifier.local.name)
  for (const declarator of topLevelDeclarators(program)) {
    const rootNode = declarator.init && chainRoot(declarator.init)
    if (rootNode?.type === 'Identifier' && ['z', 'lazySchema'].includes(rootNode.name))
      bindings.add(declarator.id.name)
  }
  return bindings
}

// A module-level initializer the rewrite wraps whole: a `z.*` chain, a call on another schema such
// as `baseSchema.check(…)`, or a call to a module-level schema builder such as `createPathSchema(…)`.
const isWrappable = (init, { schemaBindings, localBuilders }) => {
  const rootNode = chainRoot(init)
  if (init.type === 'Identifier' || rootNode.type !== 'Identifier') return false
  if (rootNode.name === 'z') return !isZodJson(init)
  let expression = init
  while (typeAssertionTypes.has(expression.type)) expression = expression.expression
  if (expression.type !== 'CallExpression') return false
  return (
    schemaBindings.has(rootNode.name) ||
    (expression.callee.type === 'Identifier' && localBuilders.has(expression.callee.name))
  )
}

const functionTypes = new Set([
  'FunctionDeclaration',
  'FunctionExpression',
  'ArrowFunctionExpression',
  'ObjectMethod',
  'ClassMethod',
  'ClassPrivateMethod'
])
// Module-level functions, so a call made at module load can be checked through their bodies.
const localFunctionsOf = (program) => {
  const functions = new Map()
  for (const statement of program.body) {
    const declaration =
      statement.type === 'ExportNamedDeclaration' ? statement.declaration : statement
    if (declaration?.type === 'FunctionDeclaration' && declaration.id)
      functions.set(declaration.id.name, declaration)
  }
  for (const { id, init } of topLevelDeclarators(program)) {
    if (init && functionTypes.has(init.type)) functions.set(id.name, init)
    // `lazySchemaParts(build)` returns a function that runs `build` on its first call.
    if (
      init?.type === 'CallExpression' &&
      init.callee.type === 'Identifier' &&
      init.callee.name === 'lazySchemaParts' &&
      functionTypes.has(init.arguments[0]?.type)
    )
      functions.set(id.name, init.arguments[0])
  }
  return functions
}

// Finds every expression evaluated at module load that builds a schema or forces a lazy one. A
// call to a module-level function that does either (a local builder) is reported at the call.
const analyze = (program) => {
  const schemaBindings = schemaBindingsOf(program)
  const localFunctions = localFunctionsOf(program)
  const buildsSchemas = new Map()
  const functionBuildsSchemas = (fn) => {
    if (!buildsSchemas.has(fn)) {
      buildsSchemas.set(fn, false)
      const nested = []
      visit(fn.body, nested)
      buildsSchemas.set(fn, nested.length > 0)
    }
    return buildsSchemas.get(fn)
  }
  const visit = (node, sites) => {
    if (!node || typeof node.type !== 'string') return
    if (functionTypes.has(node.type) || node.type.startsWith('TS')) {
      // Type positions never run; `x as T` and `x satisfies T` still evaluate `x`.
      if (typeAssertionTypes.has(node.type)) visit(node.expression, sites)
      return
    }
    if (isZodJson(node)) return
    if (node.type === 'CallExpression') {
      // A callback or IIFE called at module load runs now; only `lazySchema` defers its builder.
      const deferred = node.callee.type === 'Identifier' && deferringHelpers.has(node.callee.name)
      for (const fn of [node.callee, ...node.arguments])
        if (!deferred && functionTypes.has(fn.type)) visit(fn.body, sites)
      const local = node.callee.type === 'Identifier' && localFunctions.get(node.callee.name)
      if (local && functionBuildsSchemas(local)) {
        sites.push(node)
        return
      }
    }
    if (node.type === 'CallExpression' || node.type === 'MemberExpression') {
      const rootNode = chainRoot(node)
      if (
        rootNode.type === 'Identifier' &&
        (rootNode.name === 'z' || schemaBindings.has(rootNode.name))
      ) {
        sites.push(node)
        return
      }
    }
    for (const key of Object.keys(node)) {
      if (['loc', 'leadingComments', 'trailingComments', 'innerComments'].includes(key)) continue
      const value = node[key]
      if (Array.isArray(value)) value.forEach((child) => visit(child, sites))
      else if (value && typeof value === 'object') visit(value, sites)
    }
  }
  const sites = []
  for (const statement of program.body)
    if (statement.type !== 'ImportDeclaration' && !statement.type.startsWith('TS'))
      visit(statement, sites)
  const localBuilders = new Set(
    [...localFunctions].filter(([, fn]) => functionBuildsSchemas(fn)).map(([name]) => name)
  )
  return { schemaBindings, localBuilders, sites }
}

const zodImportPath = (file) => {
  const relative = path.relative(path.dirname(file), path.join(sourceRoot, 'zod.js'))
  const posix = relative.replaceAll('\\', '/')
  return posix.startsWith('.') ? posix : `./${posix}`
}
const withLazySchemaImport = (source, program, file) => {
  const zodImport = program.body.find(
    (statement) =>
      statement.type === 'ImportDeclaration' &&
      statement.importKind !== 'type' &&
      /(^|\/)zod\.js$/.test(statement.source.value)
  )
  if (zodImport?.specifiers.some((specifier) => specifier.local.name === 'lazySchema'))
    return source
  if (zodImport) {
    const last = zodImport.specifiers.at(-1)
    return `${source.slice(0, last.end)}, lazySchema${source.slice(last.end)}`
  }
  const lastImport = program.body.findLast((statement) => statement.type === 'ImportDeclaration')
  const at = lastImport ? lastImport.end : 0
  const statement = `import { lazySchema } from '${zodImportPath(file)}'`
  return `${source.slice(0, at)}${at ? '\n' : ''}${statement}${at ? '' : '\n'}${source.slice(at)}`
}

const relative = (file) => path.relative(root, file).replaceAll('\\', '/')
const lineOf = (source, offset) => source.slice(0, offset).split('\n').length
const parseModule = (source) =>
  parse(source, { sourceType: 'module', plugins: ['typescript'] }).program
let wrapped = 0
const findings = []
for (const file of files) {
  let source = readFileSync(file, 'utf8')
  const program = parseModule(source)
  let analysis = analyze(program)
  const wraps = topLevelDeclarators(program)
    .map((declarator) => declarator.init)
    .filter((init) => init && isWrappable(init, analysis))
  if (!check && wraps.length) {
    for (const init of wraps.toSorted((a, b) => b.start - a.start))
      source = `${source.slice(0, init.start)}lazySchema(() => ${source.slice(init.start, init.end)})${source.slice(init.end)}`
    source = withLazySchemaImport(source, parseModule(source), file)
    writeFileSync(file, source)
    wrapped += wraps.length
    analysis = analyze(parseModule(source))
  }
  for (const site of analysis.sites)
    findings.push(
      `${relative(file)}:${lineOf(source, site.start)}  ${source.slice(site.start, Math.min(site.end, site.start + 80)).replace(/\s+/g, ' ')}`
    )
}

if (!check) console.log(`Wrapped ${wrapped} module-level schema initializers.`)
if (findings.length) {
  console.error(
    `${findings.length} schema construction(s) run at module load. Wrap each in lazySchema(() => …) or move it into a function:`
  )
  for (const finding of findings) console.error(`  ${finding}`)
  process.exit(1)
}
if (check) console.log(`Checked ${files.length} schema modules: no schema is built at module load.`)
