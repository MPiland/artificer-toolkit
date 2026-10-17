/// <reference types="node" />
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { expect, it } from 'vitest'

// `lazy-schemas.test.ts` sees only exported schemas. The repo's lint rule (D59) also covers
// module-private ones, and CI does not run lint, so this runs the rule itself.
const repoRoot = fileURLToPath(new URL('../../../..', import.meta.url))

it('builds no schema at module load anywhere in the repo', () => {
  const result = spawnSync(process.execPath, ['scripts/lazySchemas.mjs', '--check'], {
    cwd: repoRoot,
    encoding: 'utf8'
  })
  expect(result.stdout + result.stderr).toContain('no schema is built at module load')
  expect(result.status).toBe(0)
})
