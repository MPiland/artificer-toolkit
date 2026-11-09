// @vitest-environment node
import { buildSync } from 'esbuild'
import { globSync, readFileSync } from 'node:fs'
import { basename, join, sep } from 'node:path'
import vm from 'node:vm'
import { expect, it } from 'vitest'

declare module 'vitest' {
  interface TaskMeta {
    moduleFloorMs?: number
  }
}

// Convex evaluates a function's whole module graph on every call (D59), so each function pays for
// every module its file reaches (PERF-1). Full `zod` and the `z` namespace object of `zod/mini` keep
// all ~40 zod locales (194 KiB minified) alive, so Convex code builds schemas with
// `@artificer-toolkit/schema/zod`. The entry points and bundle options are the Convex bundler's.
const convexDirectory = join(import.meta.dirname, '../convex')
const convexConfig: { node: { externalPackages: string[] } } = JSON.parse(
  readFileSync(join(import.meta.dirname, '../convex.json'), 'utf8')
)
const functionEntries = globSync('**/*.ts', { cwd: convexDirectory })
  .map((file) => file.replaceAll(sep, '/'))
  .filter((file) => {
    const base = basename(file)
    return !file.startsWith('_generated/') && base !== 'schema.ts' && base.split('.').length === 2
  })

function bundleOptions(entry: string) {
  const usesNode = /^(['"])use node\1/m.test(readFileSync(join(convexDirectory, entry), 'utf8'))
  return {
    absWorkingDir: convexDirectory,
    entryPoints: [`./${entry}`],
    bundle: true,
    platform: usesNode ? ('node' as const) : ('browser' as const),
    external: usesNode ? convexConfig.node.externalPackages : [],
    format: 'esm' as const,
    minifySyntax: true,
    minifyIdentifiers: true,
    conditions: ['source'],
    write: false as const,
    logLevel: 'silent' as const
  }
}

function bundleInputs(entry: string) {
  const bundle = buildSync({ ...bundleOptions(entry), metafile: true })
  return Object.entries(Object.values(bundle.metafile.outputs)[0].inputs)
    .map(([input, { bytesInOutput }]) => ({
      path: `/${input.replaceAll('\\', '/')}`,
      bytesInOutput
    }))
    .filter(({ bytesInOutput }) => bytesInOutput > 0)
}

function zodInputs(entry: string) {
  return bundleInputs(entry).filter(({ path }) => path.includes('/node_modules/zod/'))
}

it.each(functionEntries)('keeps non-English zod locales out of the %s bundle', (entry) => {
  expect(
    zodInputs(entry)
      .filter(({ path }) => /\/zod\/v4\/locales\/(?!en\.js$)/.test(path))
      .map(({ path }) => path)
  ).toEqual([])
})

// The queries a Campaign inventory page opens together (PERF-1.T2).
it.each([
  'account.ts',
  'campaigns/contentShares.ts',
  'campaigns/currencySystems.ts',
  'campaigns/inventoryAudit.ts',
  'campaigns/inventoryCleanup.ts',
  'campaigns/inventoryOwners.ts',
  'campaigns/partyInventory.ts',
  'campaigns/vehicleInventory.ts',
  'campaigns/vehicles.ts'
])('keeps the %s bundle within its zod budget', (entry) => {
  expect(
    zodInputs(entry).reduce((total, { bytesInOutput }) => total + bytesInOutput, 0)
  ).toBeLessThan(120 * 1024)
})

// A module's floor is its top-level evaluation, which every call pays before its handler runs. An
// isolate reuses compiled code, so each run evaluates the bundle in a fresh context from a warm code
// cache, and the fastest of 12 runs is the floor (the PERF-6.T1 method).
function moduleFloorMs(entry: string) {
  const code = buildSync({ ...bundleOptions(entry), format: 'iife' }).outputFiles[0].text
  const cachedData = new vm.Script(code, { produceCachedData: true }).createCachedData()
  const runs = Array.from({ length: 12 }, () => {
    const context = vm.createContext({
      console,
      TextEncoder,
      TextDecoder,
      URL,
      URLSearchParams,
      crypto,
      structuredClone,
      atob,
      btoa,
      setTimeout,
      clearTimeout,
      queueMicrotask,
      Response,
      Request,
      Headers,
      fetch,
      performance,
      AbortController,
      Blob,
      ReadableStream,
      process: { env: {} }
    })
    const startedAt = performance.now()
    new vm.Script(code, { cachedData }).runInContext(context)
    return performance.now() - startedAt
  })
  return Math.min(...runs)
}

// The party roster subscribes one basics query per assigned Character. Inside the Sheet module it paid
// the Sheet graph's 104-144 ms floor on every run (PERF-6.T2).
it.each(['campaigns/characterBasics.ts'])('keeps the %s module floor within 20 ms', (entry) => {
  expect(moduleFloorMs(entry)).toBeLessThanOrEqual(20)
})

// Converting zod schemas to Convex validators at module top level cost these 2–3 MB modules 41–83 ms
// per call (PERF-6.T1). The function builders and the validators they share build on first export
// (PERF-6.T8). Each test records its floor as `moduleFloorMs` in the JSON report. classPublication's
// remaining floor is not zod, so its bar is a ceiling rather than a proof of the change.
it.for([
  ['campaigns/characterSheet.ts', 20],
  ['campaigns/accountDeparture.ts', 25],
  ['characters/sheetCommands.ts', 20],
  ['characters/sheetSectionDerivation.ts', 16],
  ['characters/sheetSlices.ts', 15],
  ['content/classPublication.ts', 45]
] as const)('keeps the %s module floor within %i ms', ([entry, budgetMs], { task }) => {
  const floorMs = moduleFloorMs(entry)
  task.meta.moduleFloorMs = floorMs
  expect(floorMs).toBeLessThanOrEqual(budgetMs)
})

// Evaluating the app schema costs 43–58 ms per call (PERF-6.T1), so these modules page their
// tables with index range reads instead of convex-helpers streams over it (PERF-6.T3).
it.each(['contentSnapshots/heads.ts', 'campaigns/accountDeparture.ts'])(
  'keeps the app schema out of the %s bundle',
  (entry) => {
    expect(
      bundleInputs(entry)
        .map(({ path }) => path)
        .filter((path) => path === '/schema.ts')
    ).toEqual([])
  }
)

// The Encounter read queries rerun together, cold, when a membership change invalidates a Campaign's
// subscribers; evaluation cost tracks bundle bytes (about 0.3 ms per KiB), and a departed member's
// queries pay it before they are refused (PERF-6.T11). Their read graphs import narrow subpaths of
// `@artificer-toolkit/shared`, so geometry's polygon clipper stays out.
it.for([
  ['encounters/activeReads.ts', 1960],
  ['encounters/sceneBindings.ts', 1905]
] as const)('keeps the %s bundle within %i KiB', ([entry, budgetKiB]) => {
  expect(
    bundleInputs(entry).reduce((total, { bytesInOutput }) => total + bytesInOutput, 0)
  ).toBeLessThanOrEqual(budgetKiB * 1024)
})

it.each(['encounters/activeReads.ts', 'encounters/sceneBindings.ts'])(
  'keeps the polygon clipper out of the %s bundle',
  (entry) => {
    expect(
      bundleInputs(entry)
        .map(({ path }) => path)
        .filter((path) => path.includes('/node_modules/polygon-clipping/'))
    ).toEqual([])
  }
)
