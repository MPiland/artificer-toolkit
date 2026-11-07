// @vitest-environment node
import { buildSync } from 'esbuild'
import { expect, it } from 'vitest'

// Self-hosted Convex evaluates a function's whole module graph on every run, so a Character Sheet
// read or store pays CPU for every module its file reaches; concurrent reads hit the 1 s function
// limit while they reached the Encounter turn and grant machinery (RELIABILITY-21.T33).
const sheetModules = [
  {
    entry: './sheet.ts',
    excluded: /\/(effectStore|encounterTurnEffectState|effectActionCompiler)\.ts$/,
    maxBytes: 3_300_000
  },
  {
    entry: './sheetSlices.ts',
    excluded:
      /\/(effectStore|encounterTurnEffectState|encounterGrantLifetimes|platformEncounterPolicy|effectActionCompiler)\.ts$/,
    maxBytes: 3_300_000
  },
  {
    // The store compiles a Spell panel's casts the way an Encounter offers them (D190), so it keeps
    // the effect action compiler but not the Encounter movement, grant or turn modules.
    entry: './sheetSectionDerivation.ts',
    excluded:
      /\/(effectStore|encounterTurnEffectState|encounterGrantLifetimes|encounterMovementTargets)\.ts$/,
    maxBytes: 4_000_000
  }
]

it.each(sheetModules)(
  'keeps the $entry graph free of Encounter write and grant modules and under its byte ceiling',
  ({ entry, excluded, maxBytes }) => {
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
    const excludedImports = Object.keys(bundle.metafile.inputs).filter((path) =>
      excluded.test(`/${path.replaceAll('\\', '/')}`)
    )
    expect(excludedImports).toEqual([])
    const bytes = Object.values(bundle.metafile.outputs).reduce(
      (total, { bytes }) => total + bytes,
      0
    )
    expect(bytes).toBeLessThan(maxBytes)
  }
)
