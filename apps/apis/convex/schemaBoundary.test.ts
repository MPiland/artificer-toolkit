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
      conditions: ['source'],
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
    conditions: ['source'],
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
    conditions: ['source'],
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
    conditions: ['source'],
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
  'platformSystemCoreCodes.ts',
  'systemCoreCodeCapability.ts',
  'systemCapabilityRegistry.ts',
  'systems/dnd5e/coreCodes.ts',
  'systems/dnd5e/identity.ts',
  'systems/dnd5e/lifecycleVocabulary.ts',
  'systems/installedGameSystems/vocabulary.ts'
].map((file) => `/packages/rules-runtime/src/${file}`)

/** Rules-runtime and play-schema files a bundle loads outside the System vocabulary seam. */
function playImportsOf(entry: { entryPoints: string[] } | { stdin: { contents: string } }) {
  const bundle = buildSync({
    ...('stdin' in entry
      ? { stdin: { ...entry.stdin, resolveDir: fileURLToPath(new URL('.', import.meta.url)) } }
      : entry),
    bundle: true,
    platform: 'browser',
    conditions: ['source'],
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
        "export * from '@artificer-toolkit/rules-runtime/platformSystemCoreCodes'",
        "export * from '@artificer-toolkit/rules-runtime/platformPolicyModules'"
      ].join('\n')
    }
  })
  expect(playImports).toContain('/packages/rules-runtime/src/platformPolicyModules.ts')
  expect(playImports.some((path) => path.endsWith('/platformSystemCoreCodes.ts'))).toBe(false)
})

it.each(['./characters/documents.ts', './content/deletion.ts'])(
  'keeps storage and deletion independent of full Sheet response and command schemas: %s',
  (source) => {
    const bundle = buildSync({
      entryPoints: [fileURLToPath(new URL(source, import.meta.url))],
      bundle: true,
      platform: 'browser',
      conditions: ['source'],
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

/** Each installed-Systems tier list (D195), lightest first, with the platform root that installs it. */
const SYSTEM_TIERS = [
  ['vocabulary', 'platformSystemCoreCodes'],
  ['policy', 'platformPolicyModules'],
  ['character', 'platformCharacterPolicy'],
  ['encounter', 'platformEncounterPolicy'],
  ['runtime', 'platformRulesRuntime']
] as const

/** The rules-runtime files a platform root loads, each with the files it imports. */
function rulesRuntimeClosure(root: string) {
  const { metafile } = buildSync({
    entryPoints: [
      fileURLToPath(new URL(`../../../packages/rules-runtime/src/${root}.ts`, import.meta.url))
    ],
    bundle: true,
    platform: 'node',
    packages: 'external',
    write: false,
    metafile: true,
    logLevel: 'silent'
  })
  const slash = (path: string) => `/${path.replaceAll('\\', '/')}`
  return new Map(
    Object.entries(metafile!.inputs).map(([path, { imports }]) => [
      slash(path),
      imports.map((imported) => slash(imported.path))
    ])
  )
}

it('keeps each installed-System tier loading only its own and lighter tiers', () => {
  const tiers = SYSTEM_TIERS.map(([tier]) => tier)
  const closures = Object.fromEntries(
    SYSTEM_TIERS.map(([tier, root]) => [tier, rulesRuntimeClosure(root)])
  )
  const isList = (path: string, tier: string) =>
    path.endsWith(`/rules-runtime/src/systems/installedGameSystems/${tier}.ts`)
  // A tier's System modules are the ones its list installs, so one reached by another path counts too.
  const systemModules = Object.fromEntries(
    tiers.map((tier) => [tier, [...closures.runtime!].find(([path]) => isList(path, tier))![1]])
  )
  const loadedTiers = (closure: Map<string, string[]>) =>
    tiers.filter((tier) =>
      [...closure.keys()].some((path) => isList(path, tier) || systemModules[tier]!.includes(path))
    )
  expect(Object.fromEntries(tiers.map((tier) => [tier, loadedTiers(closures[tier]!)]))).toEqual({
    vocabulary: ['vocabulary'],
    policy: ['vocabulary', 'policy'],
    character: ['vocabulary', 'policy', 'character'],
    encounter: ['vocabulary', 'policy', 'encounter'],
    runtime: tiers
  })
})
