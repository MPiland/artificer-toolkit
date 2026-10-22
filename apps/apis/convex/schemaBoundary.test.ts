// @vitest-environment node
import { buildSync } from 'esbuild'
import { fileURLToPath } from 'node:url'
import { runInNewContext } from 'node:vm'
import { expect, it } from 'vitest'
import { postgresUuidSchema } from '@artificer-toolkit/schema/shared/postgresUuid'
import { serverUuidIdentityDtoSchema } from '@artificer-toolkit/schema/shared/rulesExecution'

it('preserves server UUID acceptance and canonical output through the leaf validator', () => {
  for (const value of [
    '00000000-0000-0000-0000-000000000000',
    'ABCDEF00-1234-0000-ABCD-ABCDEF012345',
    crypto.randomUUID(),
    'not-a-uuid',
    '00000000-0000-0000-0000-00000000000Z',
    ' 00000000-0000-0000-0000-000000000000 ',
    '',
    null,
    undefined,
    12,
    {},
    []
  ]) {
    const expected = serverUuidIdentityDtoSchema.safeParse(value)
    const actual = postgresUuidSchema.safeParse(value)
    expect(actual.success).toBe(expected.success)
    if (actual.success && expected.success) expect(actual.data).toBe(expected.data)
  }
})

it('keeps UUID-only leaf contracts independent of execution schemas', () => {
  for (const source of [
    'shared/reusableDefinitions',
    'shared/optionalCombat',
    'shared/initiativePolicySnapshot',
    'features/base'
  ]) {
    const bundle = buildSync({
      entryPoints: [
        fileURLToPath(new URL(`../../../packages/schema/src/${source}.ts`, import.meta.url))
      ],
      bundle: true,
      platform: 'browser',
      write: false,
      metafile: true,
      logLevel: 'silent'
    })
    const executionImports = Object.keys(bundle.metafile!.inputs).filter((path) =>
      path.replaceAll('\\', '/').endsWith('/shared/rulesExecution.ts')
    )
    expect(executionImports, source).toEqual([])
  }
})

it('keeps typed Character persistence independent of the authored mechanics graph', () => {
  const bundle = buildSync({
    entryPoints: [fileURLToPath(new URL('./characters/schema.ts', import.meta.url))],
    bundle: true,
    platform: 'browser',
    write: false,
    metafile: true,
    logLevel: 'silent'
  })
  const mechanicsImports = Object.keys(bundle.metafile!.inputs).filter((path) =>
    /\/packages\/(rules-runtime\/|shared\/(src|dist)\/(domains\/rules\/|domains\/subjects\/(authored|compilers)\/index\.))/.test(
      `/${path.replaceAll('\\', '/')}`
    )
  )
  expect(mechanicsImports).toEqual([])
})

it('keeps the complete database schema independent of the executable rules kernel', () => {
  const bundle = buildSync({
    entryPoints: [fileURLToPath(new URL('./schema.ts', import.meta.url))],
    bundle: true,
    platform: 'browser',
    write: false,
    metafile: true,
    logLevel: 'silent'
  })
  const executionImports = Object.keys(bundle.metafile!.inputs).filter((path) =>
    /\/packages\/(rules-runtime\/|shared\/(src|dist)\/domains\/rules\/(kernel|graphCompiler|operationRegistry|operations|index)\.(ts|js)$)/.test(
      `/${path.replaceAll('\\', '/')}`
    )
  )
  expect(executionImports).toEqual([])
})

it('evaluates the complete database schema without environment-variable access', () => {
  const bundle = buildSync({
    entryPoints: [fileURLToPath(new URL('./schema.ts', import.meta.url))],
    bundle: true,
    platform: 'browser',
    format: 'iife',
    globalName: 'schemaModule',
    write: false,
    logLevel: 'silent'
  })
  const context = {
    TextEncoder,
    TextDecoder,
    process: {
      env: new Proxy(
        {},
        {
          get() {
            throw new Error('Environment variables unsupported when evaluating schema')
          }
        }
      )
    }
  }
  expect(() => runInNewContext('process.env.EXAMPLE', context)).toThrow(
    'Environment variables unsupported'
  )
  const exported: unknown = runInNewContext(
    `${bundle.outputFiles[0]!.text}; schemaModule.default.export()`,
    context,
    { timeout: 1000 }
  )
  expect(exported).toContain('"tableName":"characters"')
  expect(exported).toContain('"tableName":"characterDrafts"')
  expect(exported).toContain('"tableName":"campaigns"')
  expect(exported).toContain('"tableName":"campaignMemberships"')
  expect(exported).toContain('"tableName":"campaignPlaySettings"')
  const indexNames = [...String(exported).matchAll(/"indexDescriptor":"([^"]+)"/g)]
  expect(indexNames.length).toBeGreaterThan(0)
  for (const [, name] of indexNames) expect(name).toMatch(/^[A-Za-z][A-Za-z0-9_]{0,63}$/)
})

it('keeps authoring source reads independent of the play execution registry and schemas', () => {
  const bundle = buildSync({
    entryPoints: [fileURLToPath(new URL('./authoring/nodeRuntime.ts', import.meta.url))],
    bundle: true,
    platform: 'browser',
    write: false,
    metafile: true,
    logLevel: 'silent'
  })
  const inputs = Object.keys(bundle.metafile!.inputs).map(
    (path) => `/${path.replaceAll('\\', '/')}`
  )
  const playImports = inputs.filter((path) =>
    /\/packages\/schema\/(src|dist)\/(shared\/rulesExecution|api\/characterSheet)/.test(path)
  )
  expect(playImports).toEqual([])
  // Authoring reads System vocabulary through the pure `systemVocabulary` subpath (D176) and
  // nothing else in rules-runtime; a new import in that closure must be added here on purpose.
  const rulesRuntimeClosure = inputs
    .filter((path) => path.includes('/packages/rules-runtime/'))
    .map((path) =>
      path.replace(/^.*\/packages\/rules-runtime\/(src|dist)\//, '').replace(/\.(ts|js)$/, '')
    )
    .sort()
  expect(rulesRuntimeClosure).toEqual([
    'systemCapabilityRegistry',
    'systemVocabulary',
    'systemVocabularyCapability',
    'systems/dnd5e/identity',
    'systems/dnd5e/vocabulary'
  ])
})

it.each(['./characters/documents.ts', './content/deletion.ts'])(
  'keeps storage and deletion independent of full Sheet response and command schemas: %s',
  (source) => {
    const bundle = buildSync({
      entryPoints: [fileURLToPath(new URL(source, import.meta.url))],
      bundle: true,
      platform: 'browser',
      write: false,
      metafile: true,
      logLevel: 'silent'
    })
    const responseImports = Object.keys(bundle.metafile!.inputs).filter((path) =>
      /\/api\/characterSheet(Commands|Data|Panel)\.(ts|js)$/.test(path.replaceAll('\\', '/'))
    )
    expect(responseImports).toEqual([])
  }
)
