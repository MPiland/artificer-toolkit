// @vitest-environment node
import { buildSync } from 'esbuild'
import { expect, it } from 'vitest'

// Self-hosted Convex evaluates a query's whole module graph on every run, so a subscription that
// re-runs on each Encounter commit pays for every module its file reaches (RELIABILITY-21).
it.each(['./activeReads.ts', './sceneBindings.ts'])(
  'keeps the %s subscription graph free of command-only modules',
  (entry) => {
    const bundle = buildSync({
      absWorkingDir: import.meta.dirname,
      entryPoints: [entry],
      bundle: true,
      platform: 'browser',
      conditions: ['source'],
      write: false,
      metafile: true,
      logLevel: 'silent'
    })
    const commandImports = Object.keys(bundle.metafile.inputs).filter((path) =>
      /\/((encounterPorts|initiativeSources|blueprintSnapshots|policySnapshots|sheetFacts|sheetCommands|currencySystemDocuments|campaignTextPolicy)\.ts$|node_modules\/obscenity\/)/.test(
        `/${path.replaceAll('\\', '/')}`
      )
    )
    expect(commandImports).toEqual([])
  }
)
