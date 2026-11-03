// @vitest-environment node
import { buildSync } from 'esbuild'
import { expect, it } from 'vitest'

// Convex evaluates a function's whole module graph on every call (D59), so each query that a
// Campaign inventory page opens pays for every module its file reaches (PERF-1). The `z` namespace
// object of `zod/mini` keeps all ~40 zod locales (194 KiB minified) alive. The bundle options are
// the Convex bundler's.
it.each([
  '../account.ts',
  './contentShares.ts',
  './currencySystems.ts',
  './inventoryAudit.ts',
  './inventoryCleanup.ts',
  './inventoryOwners.ts',
  './partyInventory.ts',
  './vehicleInventory.ts',
  './vehicles.ts'
])('keeps the %s graph within its module budget', (entry) => {
  const bundle = buildSync({
    absWorkingDir: import.meta.dirname,
    entryPoints: [entry],
    bundle: true,
    platform: 'browser',
    format: 'esm',
    minifySyntax: true,
    minifyIdentifiers: true,
    conditions: ['source'],
    write: false,
    metafile: true,
    logLevel: 'silent'
  })
  const inputs = Object.entries(Object.values(bundle.metafile.outputs)[0].inputs).map(
    ([path, { bytesInOutput }]) => ({ path: `/${path.replaceAll('\\', '/')}`, bytesInOutput })
  )
  const zodBytes = inputs
    .filter(({ path }) => path.includes('/node_modules/zod/'))
    .reduce((total, { bytesInOutput }) => total + bytesInOutput, 0)

  expect(
    inputs
      .filter(
        ({ path, bytesInOutput }) =>
          bytesInOutput > 0 && /\/zod\/v4\/locales\/(?!en\.js$)/.test(path)
      )
      .map(({ path }) => path)
  ).toEqual([])
  expect(zodBytes).toBeLessThan(120 * 1024)
})
