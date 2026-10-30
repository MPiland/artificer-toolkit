import { spawnSync } from 'node:child_process'
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { delimiter, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const script = join(import.meta.dirname, 'watchCi.ps1')
const repository = join(import.meta.dirname, '..')

// A fake `gh` on PATH answers each `gh <group> <command>` from a JSON file of { stdout, stderr, status }.
const fakeGh = `import { readFileSync } from 'node:fs'
const responses = JSON.parse(readFileSync(process.env.FAKE_GH_RESPONSES, 'utf8'))
const response = responses[process.argv.slice(2, 4).join(' ')] ?? {}
process.stdout.write(response.stdout ?? '')
process.stderr.write(response.stderr ?? '')
process.exit(response.status ?? 0)
`

const run = (workflowName, status, conclusion, databaseId) => ({
  databaseId,
  workflowName,
  status,
  conclusion,
  createdAt: '2026-10-29T00:00:00Z'
})

// The fake gh is a POSIX shell shim, as CI runs on Linux: a Windows .cmd shim would let cmd.exe parse the
// `|` and quotes in gh's --jq arguments.
describe.skipIf(process.platform === 'win32')('watchCi.ps1', { timeout: 30000 }, () => {
  let directory

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'watch-ci-'))
    writeFileSync(join(directory, 'gh.mjs'), fakeGh)
    writeFileSync(join(directory, 'gh'), `#!/bin/sh\nexec node "$(dirname "$0")/gh.mjs" "$@"\n`)
    chmodSync(join(directory, 'gh'), 0o755)
  })

  afterEach(() => rmSync(directory, { recursive: true, force: true }))

  // The script polls every 120 seconds, so a watch that does not exit on the first poll times out here.
  const watch = (responses) => {
    const responsesFile = join(directory, 'responses.json')
    writeFileSync(responsesFile, JSON.stringify(responses))
    return spawnSync('pwsh', ['-NoProfile', '-File', script], {
      cwd: repository,
      encoding: 'utf8',
      timeout: 20000,
      env: {
        ...process.env,
        PATH: `${directory}${delimiter}${process.env.PATH}`,
        FAKE_GH_RESPONSES: responsesFile
      }
    })
  }

  it('exits non-zero, without reporting green, when gh cannot reach GitHub', () => {
    const result = watch({
      'run list': { stderr: 'error connecting to api.github.com\n', status: 1 }
    })

    expect(result.status).toBe(1)
    expect(result.stdout).not.toContain('GREEN')
  })

  it('exits non-zero when gh fails while reading a cancelled run', () => {
    const result = watch({
      'run list': { stdout: JSON.stringify([run('Tests', 'completed', 'cancelled', 1)]) },
      'run view': { stderr: 'error connecting to api.github.com\n', status: 1 }
    })

    expect(result.status).toBe(1)
    expect(result.stdout).not.toContain('GREEN')
  })

  it('reports a run that timed out as a failure, not green', () => {
    const result = watch({
      'run list': {
        stdout: JSON.stringify([
          run('Tests', 'completed', 'timed_out', 1),
          run('Live backend', 'completed', 'success', 2),
          run('Browser journeys', 'completed', 'success', 3)
        ])
      }
    })

    expect(result.status).toBe(1)
    expect(result.stdout).toContain('FAILED Tests 1')
    expect(result.stdout).not.toContain('GREEN')
  })

  it('reports green only when every run concluded success', () => {
    const result = watch({
      'run list': {
        stdout: JSON.stringify([
          run('Tests', 'completed', 'success', 1),
          run('Live backend', 'completed', 'success', 2),
          run('Browser journeys', 'completed', 'success', 3)
        ])
      }
    })

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('GREEN Tests 1')
    expect(result.stdout).toContain('GREEN Live backend 2')
    expect(result.stdout).toContain('GREEN Browser journeys 3')
  })
})
