import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { readdir, readFile } from 'node:fs/promises'
import { extname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const root = resolve(import.meta.dirname, '..')
const selfPath = 'scripts/auditNativeBoundaries.mjs'

const expectedWorkspaces = new Map([
  ['apps/apis', '@artificer-toolkit/apis'],
  ['apps/session-worker', '@artificer-toolkit/session-worker'],
  ['apps/web', '@artificer-toolkit/web'],
  ['packages/authoring', '@artificer-toolkit/authoring'],
  ['packages/design-system', '@artificer-toolkit/design-system'],
  ['packages/emails', '@artificer-toolkit/emails'],
  ['packages/encounter-persistence', '@artificer-toolkit/encounter-persistence'],
  ['packages/rules-runtime', '@artificer-toolkit/rules-runtime'],
  ['packages/schema', '@artificer-toolkit/schema'],
  ['packages/shared', '@artificer-toolkit/shared'],
  ['packages/source-data', '@artificer-toolkit/source-data']
])

// Allowed workspace-to-workspace dependency directions (docs/architecture/persistence.md,
// rules-runtime.md, authoring-schema.md, ADR 0001). A package never depends on an app; no app
// depends on another app except the web app's type-only reach into the Convex API surface of
// `apps/apis`. `runtime` bounds every manifest section and every non-test source import; `test`
// adds devDependencies that only test files and test support (`tests/` paths) may import.
const packageWorkspaceDependencies = new Map([
  // Authoring's parity tests run SRD records against the System policy vocabulary.
  [
    '@artificer-toolkit/authoring',
    { runtime: ['schema', 'shared'], test: ['rules-runtime', 'source-data'] }
  ],
  ['@artificer-toolkit/design-system', { runtime: [], test: [] }],
  ['@artificer-toolkit/emails', { runtime: ['design-system', 'schema'], test: [] }],
  [
    '@artificer-toolkit/encounter-persistence',
    { runtime: ['rules-runtime', 'schema', 'shared'], test: [] }
  ],
  ['@artificer-toolkit/rules-runtime', { runtime: ['schema', 'shared', 'source-data'], test: [] }],
  ['@artificer-toolkit/schema', { runtime: ['design-system', 'shared'], test: [] }],
  ['@artificer-toolkit/shared', { runtime: ['design-system'], test: [] }],
  ['@artificer-toolkit/source-data', { runtime: ['schema', 'shared'], test: [] }]
])
const workspaceImport =
  /(?:from\s+|import\s*\(\s*|require\(\s*|^\s*import\s+)['"]@artificer-toolkit\/([a-z-]+)(?=\/|['"])/gu
const appWorkspaceNames = new Set([
  '@artificer-toolkit/apis',
  '@artificer-toolkit/session-worker',
  '@artificer-toolkit/web'
])
const allowedAppToApp = new Set(['@artificer-toolkit/web>@artificer-toolkit/apis'])
// A package source file must not import an app, by workspace name or by relative path.
const packageAppImport =
  /(?:from\s+|import\s*\(\s*|require\(\s*)['"](?:@artificer-toolkit\/(?:apis|session-worker|web)(?=\/|['"])|(?:\.{1,2}\/)+(?:[^'"]*\/)?apps\/)/u

const retiredPaths = [
  'apps/apis/src/trpc',
  'apps/session-host',
  'apps/web/src/data/rules',
  'apps/web/src/domains/rules',
  'apps/web/src/routes/_authed/admin/rules.tsx',
  'apps/web/src/server/trpc.ts',
  'apps/web/netlify.toml',
  'apps/web/src/supabase',
  'netlify',
  'packages/db',
  'packages/functions'
]

export const retiredWorkspaceNames = new Set([
  '@artificer-toolkit/db',
  '@artificer-toolkit/functions',
  '@artificer-toolkit/session-host'
])

export const forbiddenDependency =
  /^(?:@gorules\/|@netlify\/|@supabase\/|@trpc\/|@types\/pg$|kysely(?:-supabase)?$|netlify-cli$|pg$|postgres(?:-js)?$|supabase$)/iu
const sourceRules = [
  {
    name: 'removed Supabase product API',
    pattern:
      /@supabase\/|\bsupabase-js\b|\b(?:VITE_)?SUPABASE_[A-Z0-9_]+\b|\.supabase\.co\b|\/(?:auth|realtime|rest|storage)\/v1\b/iu
  },
  {
    name: 'removed Kysely/Postgres application SQL',
    pattern:
      /(?:from\s+|import\s*\(\s*)['"](?:kysely(?:-supabase)?|pg|postgres(?:-js)?)['"]|\bsql(?:<[^>]*>)?\s*\x60|\b(?:DATABASE_CONNECTION_STRING|POSTGRES(?:QL)?_URL)\b/iu
  },
  {
    name: 'removed GoRules/Rule Studio surface',
    pattern: /@gorules\/|\bgorules\b|\brule[ -]?studio\b/iu
  },
  { name: 'removed tRPC surface', pattern: /@trpc\/|\btrpc\b|\/api\/trpc\b/iu },
  {
    name: 'retired workspace path',
    pattern:
      /@artificer-toolkit\/(?:db|functions|session-host)\b|(?:apps\/session-host|packages\/(?:db|functions))(?:\/|\b)/iu
  },
  {
    name: 'removed Netlify hosting surface (ADR 0037)',
    pattern: /@netlify\/|\/\.netlify\/|\bnetlify\/(?:edge-)?functions\/|\bnetlify\.(?:app|toml)\b/iu
  }
]

const scannedExtensions = new Set([
  '.cjs',
  '.cts',
  '.js',
  '.json',
  '.jsonc',
  '.jsx',
  '.mjs',
  '.mts',
  '.sql',
  '.toml',
  '.ts',
  '.tsx',
  '.yaml',
  '.yml'
])
const excludedSegments = new Set([
  '__tests__',
  'dist',
  'node_modules',
  'previews',
  'stories',
  'test',
  'tests'
])
const roadmapToolingPath = 'scripts/phase8/'
const excludedGeneratedPaths = new Set([
  'apps/apis/convex/content/srdManifest.generated.ts',
  'apps/session-worker/src/worker-configuration.d.ts'
])
const rootConfigPaths = [
  '.env.example',
  '.oxfmtrc.jsonc',
  '.oxlintrc.jsonc',
  '.yarnrc.yml',
  'package.json',
  'tsconfig.base.json',
  'tsconfig.json',
  'turbo.json',
  'vitest.config.ts'
]

function normalizePath(path) {
  return path.replaceAll('\\', '/')
}

async function retiredPathContainsSource(path) {
  const absolutePath = resolve(root, path)
  if (!existsSync(absolutePath)) return false
  try {
    return (await readdir(absolutePath)).length > 0
  } catch {
    return true
  }
}

export function isExcluded(path) {
  if (path === selfPath || excludedGeneratedPaths.has(path)) return true
  // Roadmap tooling carries PBI titles as data, like the Markdown roadmap it generates.
  if (path.startsWith(roadmapToolingPath)) return true
  const segments = path.split('/')
  if (segments.some((segment) => excludedSegments.has(segment) || segment === '_generated')) {
    return true
  }
  return /\.(?:md|mdx)$/iu.test(path) || /\.(?:spec|stories|test)\.[^.]+$/iu.test(path)
}

// The audited source is what git would ship (tracked and unignored untracked files), never ignored
// local build or dev-server output such as apps/web/.wrangler or storybook-static.
function sourceInventory() {
  const result = spawnSync(
    'git',
    ['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
    {
      cwd: root,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024
    }
  )
  if (result.status !== 0) throw new Error('Source inventory failed.')
  return result.stdout.split('\0').filter(Boolean).map(normalizePath)
}

function collectFiles(inventory, path) {
  return inventory.filter((child) => {
    const name = child.slice(child.lastIndexOf('/') + 1)
    return (
      child.startsWith(path + '/') &&
      !isExcluded(child) &&
      existsSync(resolve(root, child)) &&
      (scannedExtensions.has(extname(name)) ||
        name === '.dev.vars.example' ||
        name === '.env.example')
    )
  })
}
export function sourceViolations(path, source) {
  const violations =
    extname(path) === '.sql'
      ? [{ line: 1, path, rule: 'removed Kysely/Postgres application SQL', source: 'SQL file' }]
      : []
  const packageName = path.startsWith('packages/')
    ? expectedWorkspaces.get(path.split('/', 2).join('/'))
    : undefined
  const runtime = packageWorkspaceDependencies.get(packageName)?.runtime
  for (const [index, line] of source.split(/\r?\n/u).entries()) {
    if (path.startsWith('packages/') && packageAppImport.test(line)) {
      violations.push({
        line: index + 1,
        path,
        rule: 'package imports an app',
        source: line.trim().slice(0, 200)
      })
    }
    for (const [, workspace] of runtime ? line.matchAll(workspaceImport) : []) {
      const name = '@artificer-toolkit/' + workspace
      if (name === packageName || appWorkspaceNames.has(name) || runtime.includes(workspace)) {
        continue
      }
      violations.push({
        line: index + 1,
        path,
        rule: packageName + ' runtime source imports ' + name,
        source: line.trim().slice(0, 200)
      })
    }
    for (const rule of sourceRules) {
      if (!rule.pattern.test(line)) continue
      violations.push({
        line: index + 1,
        path,
        rule: rule.name,
        source: line.trim().slice(0, 200)
      })
    }
  }
  return violations
}

async function workspaceAudit() {
  const violations = []
  const actualWorkspaces = new Map()
  for (const parent of ['apps', 'packages']) {
    for (const entry of await readdir(resolve(root, parent), { withFileTypes: true })) {
      if (!entry.isDirectory()) continue
      const path = parent + '/' + entry.name
      const manifestPath = resolve(root, path, 'package.json')
      if (!existsSync(manifestPath)) continue
      const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
      actualWorkspaces.set(path, manifest.name)
    }
  }

  for (const [path, name] of expectedWorkspaces) {
    if (actualWorkspaces.get(path) !== name) {
      violations.push({ path: path + '/package.json', rule: 'expected workspace ' + name })
    }
  }
  for (const [path, name] of actualWorkspaces) {
    if (!expectedWorkspaces.has(path)) {
      violations.push({ path: path + '/package.json', rule: 'unexpected workspace ' + name })
    }
    if (retiredWorkspaceNames.has(name)) {
      violations.push({ path: path + '/package.json', rule: 'retired workspace ' + name })
    }
  }

  return { actualWorkspaces, violations }
}

export function workspaceDependencyViolations(path, manifest) {
  const dependencies = [
    'dependencies',
    'devDependencies',
    'optionalDependencies',
    'peerDependencies'
  ]
    .flatMap((section) => Object.keys(manifest[section] ?? {}).map((name) => ({ name, section })))
    .filter(({ name }) => name.startsWith('@artificer-toolkit/'))
  const allowed = packageWorkspaceDependencies.get(manifest.name)
  return dependencies.flatMap(({ name, section }) => {
    if (allowed) {
      const workspace = name.slice('@artificer-toolkit/'.length)
      if (allowed.runtime.includes(workspace)) return []
      if (section === 'devDependencies' && allowed.test.includes(workspace)) return []
      return [{ path, rule: manifest.name + ' must not depend on ' + name + ' in ' + section }]
    }
    return appWorkspaceNames.has(name) && !allowedAppToApp.has(manifest.name + '>' + name)
      ? [{ path, rule: manifest.name + ' must not depend on app ' + name }]
      : []
  })
}

async function dependencyAudit(manifestPaths) {
  const violations = []
  for (const path of manifestPaths) {
    const manifest = JSON.parse(await readFile(resolve(root, path), 'utf8'))
    if (path !== 'package.json') violations.push(...workspaceDependencyViolations(path, manifest))
    for (const section of [
      'dependencies',
      'devDependencies',
      'optionalDependencies',
      'peerDependencies'
    ]) {
      for (const name of Object.keys(manifest[section] ?? {})) {
        if (retiredWorkspaceNames.has(name) || forbiddenDependency.test(name)) {
          violations.push({ path, rule: 'forbidden direct dependency ' + name })
        }
      }
    }
  }
  return violations
}

async function audit() {
  const { actualWorkspaces, violations } = await workspaceAudit()
  for (const path of retiredPaths) {
    if (await retiredPathContainsSource(path)) {
      violations.push({ path, rule: 'retired source path still exists' })
    }
  }

  const workspaceManifests = [...actualWorkspaces.keys()].map((path) => path + '/package.json')
  violations.push(...(await dependencyAudit(['package.json', ...workspaceManifests])))

  if (/^\s*"?@netlify\//mu.test(await readFile(resolve(root, 'yarn.lock'), 'utf8'))) {
    violations.push({ path: 'yarn.lock', rule: 'removed Netlify hosting surface (ADR 0037)' })
  }

  const inventory = sourceInventory()
  const files = [
    ...rootConfigPaths.filter((path) => existsSync(resolve(root, path))),
    ...['apps', 'packages', 'scripts'].flatMap((path) => collectFiles(inventory, path))
  ]
  const uniqueFiles = [...new Set(files)].sort()
  for (const path of uniqueFiles) {
    violations.push(...sourceViolations(path, await readFile(resolve(root, path), 'utf8')))
  }

  if (violations.length > 0) {
    for (const violation of violations) console.error(JSON.stringify(violation))
    throw new Error('Native boundary audit found ' + violations.length + ' violation(s).')
  }

  console.log(
    'Native boundary audit passed: ' +
      actualWorkspaces.size +
      ' workspaces, ' +
      uniqueFiles.length +
      ' runtime/config files.'
  )
  console.log('Workspaces: ' + [...actualWorkspaces.values()].sort().join(', '))
  console.log(
    'Allowlisted: Markdown, roadmap tooling and test/spec/story/preview paths; generated Convex/SRD/Worker declarations; yarn.lock transitive dependencies.'
  )
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) await audit()
