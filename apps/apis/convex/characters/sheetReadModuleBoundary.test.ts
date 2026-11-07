// @vitest-environment node
import { buildSync } from 'esbuild'
import { expect, it } from 'vitest'

// Self-hosted Convex evaluates a query's whole module graph on every run, so the Character Sheet
// read pays CPU for every module its file reaches; 19 concurrent reads hit the 1 s query limit while
// it reached the Encounter turn machinery through the effect store's write path (RELIABILITY-21.T33).
it('keeps the characters.sheet.get graph free of effect write modules and under its byte ceiling', () => {
  const bundle = buildSync({
    absWorkingDir: import.meta.dirname,
    entryPoints: ['./sheet.ts'],
    bundle: true,
    platform: 'browser',
    conditions: ['source'],
    write: false,
    metafile: true,
    logLevel: 'silent'
  })
  const writeImports = Object.keys(bundle.metafile.inputs).filter((path) =>
    /\/(effectStore|encounterTurnEffectState|effectActionCompiler)\.ts$/.test(
      `/${path.replaceAll('\\', '/')}`
    )
  )
  expect(writeImports).toEqual([])
  const bytes = Object.values(bundle.metafile.outputs).reduce(
    (total, { bytes }) => total + bytes,
    0
  )
  expect(bytes).toBeLessThan(3_300_000)
})
