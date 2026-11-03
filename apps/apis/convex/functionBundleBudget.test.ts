// @vitest-environment node
import { buildSync } from 'esbuild'
import { globSync, readFileSync } from 'node:fs'
import { basename, join, sep } from 'node:path'
import { expect, it } from 'vitest'

// Convex evaluates a function's whole module graph on every call (D59), so each function pays for
// every module its file reaches (PERF-1). Full `zod` and the `z` namespace object of `zod/mini` keep
// all ~40 zod locales (194 KiB minified) alive, so Convex code builds schemas with
// `@artificer-toolkit/schema/zod`. The entry points and bundle options are the Convex bundler's.
const convexConfig: { node: { externalPackages: string[] } } = JSON.parse(
  readFileSync(join(import.meta.dirname, '../convex.json'), 'utf8')
)
const functionEntries = globSync('**/*.ts', { cwd: import.meta.dirname })
  .map((file) => file.replaceAll(sep, '/'))
  .filter((file) => {
    const base = basename(file)
    return !file.startsWith('_generated/') && base !== 'schema.ts' && base.split('.').length === 2
  })

function zodInputs(entry: string) {
  const usesNode = /^(['"])use node\1/m.test(readFileSync(join(import.meta.dirname, entry), 'utf8'))
  const bundle = buildSync({
    absWorkingDir: import.meta.dirname,
    entryPoints: [`./${entry}`],
    bundle: true,
    platform: usesNode ? 'node' : 'browser',
    external: usesNode ? convexConfig.node.externalPackages : [],
    format: 'esm',
    minifySyntax: true,
    minifyIdentifiers: true,
    conditions: ['source'],
    write: false,
    metafile: true,
    logLevel: 'silent'
  })
  return Object.entries(Object.values(bundle.metafile.outputs)[0].inputs)
    .map(([input, { bytesInOutput }]) => ({
      path: `/${input.replaceAll('\\', '/')}`,
      bytesInOutput
    }))
    .filter(({ path, bytesInOutput }) => bytesInOutput > 0 && path.includes('/node_modules/zod/'))
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
