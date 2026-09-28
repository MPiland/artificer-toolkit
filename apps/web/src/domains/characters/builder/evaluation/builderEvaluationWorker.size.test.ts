// @vitest-environment node
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'
import { build, type Rolldown } from 'vite'
import { describe, expect, it } from 'vitest'

// ADR 0036 S6 gate: the Builder evaluation worker, with everything it bundles, stays within
// 300 KB gzipped. It builds the worker entry alone, minified, as the app build does.
const WORKER_BUDGET_BYTES = 300 * 1024

describe('Builder evaluation worker bundle', () => {
  it('stays within 300 KB gzipped', async () => {
    const result = await build({
      configFile: false,
      logLevel: 'silent',
      mode: 'production',
      resolve: { tsconfigPaths: true },
      build: {
        write: false,
        minify: true,
        target: 'es2022',
        rolldownOptions: {
          input: fileURLToPath(new URL('./builderEvaluation.worker.ts', import.meta.url))
        }
      }
    })
    const outputs = (Array.isArray(result) ? result : [result]) as Rolldown.RolldownOutput[]
    const gzipped = outputs
      .flatMap((output) => output.output)
      .filter((file): file is Rolldown.OutputChunk => file.type === 'chunk')
      .reduce((total, chunk) => total + gzipSync(chunk.code).byteLength, 0)

    expect(gzipped, `worker is ${(gzipped / 1024).toFixed(1)} KB gzipped`).toBeLessThanOrEqual(
      WORKER_BUDGET_BYTES
    )
  }, 180_000)
})
