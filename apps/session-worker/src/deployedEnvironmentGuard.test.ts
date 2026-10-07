import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

import { afterAll, describe, expect, it } from 'vitest'

import {
  LOCAL_MARKER,
  defaultConfigPath,
  findLocalMarkerViolations,
  readWranglerConfig
} from '../scripts/deployedEnvironmentGuard.mjs'

const cli = join(dirname(defaultConfigPath), 'scripts', 'assertNoLocalMarker.mjs')
const directory = mkdtempSync(join(tmpdir(), 'wrangler-guard-'))
afterAll(() => rmSync(directory, { force: true, recursive: true }))

function fixture(name: string, text: string): string {
  const path = join(directory, name)
  writeFileSync(path, text)
  return path
}

function runCli(path: string) {
  return spawnSync(process.execPath, [cli, path], { encoding: 'utf8' })
}

describe('the deployed-environment local marker guard', () => {
  it('passes the committed Worker configuration (production and staging)', () => {
    const config = readWranglerConfig(defaultConfigPath)
    expect(Object.keys(config.env ?? {})).toContain('staging')
    expect(findLocalMarkerViolations(config)).toEqual([])
    expect(runCli(defaultConfigPath).status).toBe(0)
  })

  it('fails when production or any named environment sets the marker', () => {
    const path = fixture(
      'marker-vars.jsonc',
      `{
        // comments are legal in wrangler.jsonc
        "vars": { "${LOCAL_MARKER}": "http://127.0.0.1:8026" },
        "env": {
          "staging": { "vars": { "${LOCAL_MARKER}": "http://127.0.0.1:9000" } },
          "preview": { "vars": { "OTHER": "x // not a comment" }, },
        }
      }`
    )
    expect(findLocalMarkerViolations(readWranglerConfig(path))).toEqual([
      expect.stringContaining('top-level (production)'),
      expect.stringContaining('Environment "staging"')
    ])
    const result = runCli(path)
    expect(result.status).toBe(1)
    expect(result.stderr).toContain(LOCAL_MARKER)
  })

  it('fails when an environment requires the marker as a secret', () => {
    const path = fixture(
      'marker-secret.jsonc',
      `{ "env": { "staging": { "secrets": { "required": ["${LOCAL_MARKER}"] } } } }`
    )
    expect(findLocalMarkerViolations(readWranglerConfig(path))).toEqual([
      expect.stringContaining('Environment "staging" requires')
    ])
    expect(runCli(path).status).toBe(1)
  })
})
