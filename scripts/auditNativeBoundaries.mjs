import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { readdir, readFile } from 'node:fs/promises'
import { extname, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const selfPath = 'scripts/auditNativeBoundaries.mjs'

const expectedWorkspaces = new Map([
  ['apps/apis', '@artificer-toolkit/apis'],
  ['apps/session-worker', '@artificer-toolkit/session-worker'],
  ['apps/web', '@artificer-toolkit/web'],
  ['packages/authoring', '@artificer-toolkit/authoring'],
  ['packages/design-system', '@artificer-toolkit/design-system'],
  ['packages/emails', '@artificer-toolkit/emails'],
  ['packages/rules-runtime', '@artificer-toolkit/rules-runtime'],
  ['packages/schema', '@artificer-toolkit/schema'],
  ['packages/shared', '@artificer-toolkit/shared'],
  ['packages/source-data', '@artificer-toolkit/source-data']
])

const retiredPaths = [
  'apps/apis/src/trpc',
  'apps/session-host',
  'apps/web/src/data/rules',
  'apps/web/src/domains/rules',
  'apps/web/src/routes/_authed/admin/rules.tsx',
  'apps/web/src/server/trpc.ts',
  'apps/web/src/supabase',
  'netlify/edge-functions',
  'netlify/functions',
  'packages/db',
  'packages/functions'
]

const retiredWorkspaceNames = new Set([
  '@artificer-toolkit/db',
  '@artificer-toolkit/functions',
  '@artificer-toolkit/session-host'
])

const forbiddenDependency =
  /^(?:@gorules\/|@supabase\/|@trpc\/|@types\/pg$|kysely(?:-supabase)?$|pg$|postgres(?:-js)?$|supabase$)/iu
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
    name: 'removed product Netlify function request',
    pattern: /\/\.netlify\/functions\b|\bnetlify\/(?:edge-)?functions\//iu
  },
  {
    name: 'Netlify Functions import outside retained SSR bridge',
    pattern: /@netlify\/functions\b/u
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

function isExcluded(path) {
  if (path === selfPath || excludedGeneratedPaths.has(path)) return true
  const segments = path.split('/')
  if (segments.some((segment) => excludedSegments.has(segment) || segment === '_generated')) {
    return true
  }
  return /\.(?:md|mdx)$/iu.test(path) || /\.(?:spec|stories|test)\.[^.]+$/iu.test(path)
}

// The audited source is what git would ship (tracked and unignored untracked files), never ignored
// local build or dev-server output such as apps/web/.netlify or storybook-static.
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
function sourceViolations(path, source) {
  const violations =
    extname(path) === '.sql'
      ? [{ line: 1, path, rule: 'removed Kysely/Postgres application SQL', source: 'SQL file' }]
      : []
  for (const [index, line] of source.split(/\r?\n/u).entries()) {
    for (const rule of sourceRules) {
      if (!rule.pattern.test(line)) continue
      if (
        rule.name === 'Netlify Functions import outside retained SSR bridge' &&
        ((path === 'apps/web/src/server/auth/convex.server.ts' &&
          line.trim() === "import { getContext } from '@netlify/functions'") ||
          (path === 'apps/web/package.json' &&
            /^"@netlify\/functions":\s*"[^"]+",$/.test(line.trim())))
      ) {
        continue
      }
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

async function dependencyAudit(manifestPaths) {
  const violations = []
  for (const path of manifestPaths) {
    const manifest = JSON.parse(await readFile(resolve(root, path), 'utf8'))
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
        if (name === '@netlify/functions' && path !== 'apps/web/package.json') {
          violations.push({
            path,
            rule: '@netlify/functions is allowed only for the web SSR bridge'
          })
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

  const inventory = sourceInventory()
  const files = [
    ...rootConfigPaths.filter((path) => existsSync(resolve(root, path))),
    ...['apps', 'packages', 'netlify', 'scripts'].flatMap((path) => collectFiles(inventory, path))
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
    'Allowlisted: Markdown and test/spec/story/preview paths; generated Convex/SRD/Worker declarations; yarn.lock transitive Better Auth/Netlify SSR dependencies; @netlify/functions only in the web SSR bridge.'
  )
}

function selfTest() {
  const fixtures = [
    ['supabase.ts', "import '@supabase/supabase-js'", 'removed Supabase product API'],
    ['database.ts', "import { sql } from 'kysely'", 'removed Kysely/Postgres application SQL'],
    ['schema.sql', 'select 1', 'removed Kysely/Postgres application SQL'],
    ['rules.ts', "import '@gorules/zen-engine'", 'removed GoRules/Rule Studio surface'],
    ['client.ts', "fetch('/api/trpc/campaign')", 'removed tRPC surface'],
    [
      'client.ts',
      "fetch('/.netlify/functions/cleanup-media')",
      'removed product Netlify function request'
    ],
    ['client.ts', "import '@artificer-toolkit/db'", 'retired workspace path']
  ]
  for (const [path, source, expectedRule] of fixtures) {
    assert(sourceViolations(path, source).some(({ rule }) => rule === expectedRule))
  }
  assert.equal(
    sourceViolations(
      'apps/web/src/server/auth/convex.server.ts',
      "import { getContext } from '@netlify/functions'"
    ).length,
    0
  )
  assert(forbiddenDependency.test('@trpc/server'))
  assert(retiredWorkspaceNames.has('@artificer-toolkit/functions'))
  assert(isExcluded('docs/history.md'))
  assert(isExcluded('apps/web/src/legacy.test.ts'))
  console.log('Native boundary audit self-test passed.')
}

if (process.argv.includes('--self-test')) selfTest()
else await audit()
