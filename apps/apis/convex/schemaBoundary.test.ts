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

/** The System vocabulary seam's closure: the only rules-runtime files authoring may load. */
const SYSTEM_VOCABULARY_SEAM = [
  'platformSystemVocabulary.js',
  'systemVocabularyCapability.js',
  'systemCapabilityRegistry.js',
  'systems/dnd5e/vocabulary.js',
  'systems/dnd5e/identity.js'
].map((file) => `/packages/rules-runtime/dist/${file}`)

/** Rules-runtime and play-schema files a bundle loads outside the System vocabulary seam. */
function playImportsOf(entry: { entryPoints: string[] } | { stdin: { contents: string } }) {
  const bundle = buildSync({
    ...('stdin' in entry
      ? { stdin: { ...entry.stdin, resolveDir: fileURLToPath(new URL('.', import.meta.url)) } }
      : entry),
    bundle: true,
    platform: 'browser',
    write: false,
    metafile: true,
    logLevel: 'silent'
  })
  return Object.keys(bundle.metafile!.inputs)
    .map((path) => `/${path.replaceAll('\\', '/')}`)
    .filter(
      (path) =>
        /\/packages\/(rules-runtime\/|schema\/(src|dist)\/(shared\/rulesExecution|api\/characterSheet))/.test(
          path
        ) && !SYSTEM_VOCABULARY_SEAM.some((file) => path.endsWith(file))
    )
}

it('keeps authoring source reads independent of the play execution registry and schemas', () => {
  expect(
    playImportsOf({
      entryPoints: [fileURLToPath(new URL('./authoring/nodeRuntime.ts', import.meta.url))]
    })
  ).toEqual([])
})

it('refuses a play module loaded beside the System vocabulary seam', () => {
  const playImports = playImportsOf({
    stdin: {
      contents: [
        "export * from '@artificer-toolkit/rules-runtime/platformSystemVocabulary'",
        "export * from '@artificer-toolkit/rules-runtime/platformPolicyModules'"
      ].join('\n')
    }
  })
  expect(playImports).toContain('/packages/rules-runtime/dist/platformPolicyModules.js')
  expect(playImports.some((path) => path.endsWith('/platformSystemVocabulary.js'))).toBe(false)
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
