import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { proofPwsh, proofYarn } from './developmentShell'

export async function verifyCharacterBrowser(
  input: {
    email: string
    password: string
    session: string
    userId: string
  } & ({ journey: 'builder' } | { journey: 'sheet' | 'sheet-spells'; characterPublicId: string })
): Promise<void> {
  const evidenceDirectory = fileURLToPath(
    new URL(
      `../../../local-validation/local-convex-proofs/phase82-${input.journey === 'builder' ? 'builder-browser' : input.journey === 'sheet' ? 'sheet-browser' : 'sheet-spells-browser'}`,
      import.meta.url
    )
  )
  await mkdir(evidenceDirectory, { recursive: true })
  const builderJourneysPath = `${evidenceDirectory}/builder-journeys.json`
  if (input.journey === 'builder') await rm(builderJourneysPath, { force: true })
  let output = ''
  let passed = false
  try {
    const result = await promisify(execFile)(
      proofPwsh,
      [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        `${proofYarn} workspace @artificer-toolkit/web test:e2e:app tests/e2e/app/${input.journey === 'builder' ? 'characterBuilder.spec.ts' : input.journey === 'sheet' ? 'characterSheet.spec.ts' : 'characterSheetSpells.spec.ts'} --workers=1 --output=$env:CONVEX_E2E_OUTPUT; exit $LASTEXITCODE`
      ],
      {
        cwd: fileURLToPath(new URL('../../..', import.meta.url)),
        env: {
          ...process.env,
          APP_E2E_BASE_URL: 'http://localhost:3000',
          MVP_AUDIT_EMAIL: input.email,
          MVP_AUDIT_PASSWORD: input.password,
          MVP_AUDIT_STORAGE_STATE: '',
          CONVEX_E2E_SESSION: input.session,
          CONVEX_E2E_USER_ID: input.userId,
          ...(input.journey !== 'builder'
            ? { CONVEX_E2E_CHARACTER_ID: input.characterPublicId }
            : { CONVEX_E2E_BUILDER_JOURNEYS: builderJourneysPath }),
          CONVEX_E2E_OUTPUT: `${evidenceDirectory}/playwright`
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
    for (const secret of [input.email, input.password, input.session])
      output = output.replaceAll(secret, '[fixture credential]')
    await writeFile(`${evidenceDirectory}/playwright.log`, output)
  }
  assert.ok(
    passed,
    `Native Character browser suite failed; see ${evidenceDirectory}/playwright.log.`
  )
  console.log('Native Character browser journey passed.')
}
