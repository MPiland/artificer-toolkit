import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { proofPwsh, proofYarn } from './developmentShell'

/** The fixed evidence folder of an app browser proof, under local-validation/local-convex-proofs. */
export const appBrowserEvidenceDirectory = (proof: string) =>
  fileURLToPath(
    new URL(`../../../local-validation/local-convex-proofs/phase82-${proof}`, import.meta.url)
  )

/**
 * Runs one Playwright spec of apps/web/tests/e2e/app against the web app the proof harness started
 * (localhost:3000) and writes its output, with `secrets` redacted, to `<evidenceDirectory>/playwright.log`.
 */
export async function runAppBrowserSpec(input: {
  evidenceDirectory: string
  spec: string
  environment?: Record<string, string>
  secrets?: readonly string[]
}): Promise<void> {
  await mkdir(input.evidenceDirectory, { recursive: true })
  let output = ''
  let passed = false
  try {
    const result = await promisify(execFile)(
      proofPwsh,
      [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        `${proofYarn} workspace @artificer-toolkit/web test:e2e:app tests/e2e/app/${input.spec} --workers=1 --output=$env:CONVEX_E2E_OUTPUT; exit $LASTEXITCODE`
      ],
      {
        cwd: fileURLToPath(new URL('../../..', import.meta.url)),
        env: {
          ...process.env,
          APP_E2E_BASE_URL: 'http://localhost:3000',
          ...input.environment,
          CONVEX_E2E_OUTPUT: `${input.evidenceDirectory}/playwright`
        },
        windowsHide: true,
        timeout: 50 * 60_000,
        maxBuffer: 2 * 1024 * 1024
      }
    )
    output = result.stdout + result.stderr
    passed = true
  } catch (error) {
    if (error && typeof error === 'object') {
      if ('stdout' in error && typeof error.stdout === 'string') output += error.stdout
      if ('stderr' in error && typeof error.stderr === 'string') output += error.stderr
      output += `\nBrowser process failed: ${JSON.stringify({
        code: 'code' in error ? error.code : null,
        signal: 'signal' in error ? error.signal : null,
        killed: 'killed' in error ? error.killed : null
      })}\n`
    }
  } finally {
    for (const secret of input.secrets ?? [])
      output = output.replaceAll(secret, '[fixture credential]')
    await writeFile(`${input.evidenceDirectory}/playwright.log`, output)
  }
  assert.ok(
    passed,
    `Native app browser spec ${input.spec} failed; see ${input.evidenceDirectory}/playwright.log.`
  )
  console.log(`Native app browser spec ${input.spec} passed.`)
}
