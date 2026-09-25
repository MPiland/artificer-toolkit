import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { extname, isAbsolute, join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

type FixtureCredential = {
  email: string
  fetchToken: () => Promise<string>
  password: string
  session?: string
}

type DiagnosticSection =
  | 'fixture-ready'
  | 'door-convergence'
  | 'token-drag'
  | 'rule-convergence'
  | 'recovery'

const repoRoot = fileURLToPath(new URL('../../..', import.meta.url))
const textEvidenceExtensions = new Set(['.json', '.log', '.md', '.txt'])

async function redactEvidence(path: string, secrets: readonly string[]): Promise<void> {
  for (const entry of await readdir(path, { withFileTypes: true })) {
    const child = join(path, entry.name)
    if (entry.isDirectory()) {
      await redactEvidence(child, secrets)
    } else if (entry.isFile() && textEvidenceExtensions.has(extname(entry.name))) {
      let contents = await readFile(child, 'utf8')
      for (const secret of secrets) contents = contents.replaceAll(secret, '[fixture credential]')
      await writeFile(child, contents)
    }
  }
}

async function convexEnvironmentValue(
  name: 'LIVE_SESSION_TICKET_SECRET' | 'LIVE_SESSION_WORKER_SECRET'
): Promise<string> {
  const environment: NodeJS.ProcessEnv = {
    ...process.env,
    CONVEX_DEPLOYMENT: '',
    CONVEX_ENV_NAME: name
  }
  delete environment.YARN_INJECT_ENVIRONMENT_FILES
  let stdout: string
  try {
    ;({ stdout } = await promisify(execFile)(
      'pwsh.exe',
      [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        'yarn.ps1 workspace @artificer-toolkit/apis exec convex env get $env:CONVEX_ENV_NAME --url $env:CONVEX_SELF_HOSTED_URL --admin-key $env:CONVEX_SELF_HOSTED_ADMIN_KEY'
      ],
      {
        cwd: repoRoot,
        env: environment,
        windowsHide: true,
        timeout: 30_000
      }
    ))
  } catch {
    throw new Error(`${name} could not be read from the selected local Convex deployment.`)
  }
  const value = stdout.trim()
  assert.ok(Buffer.byteLength(value, 'utf8') >= 32, `${name} must contain at least 32 bytes.`)
  assert.equal(/[\r\n]/u.test(value), false, `${name} must be one line.`)
  return value
}

export async function verifyDevelopmentVttBrowser(input: {
  campaignName: string
  gm: FixtureCredential
  player: FixtureCredential
  player2: FixtureCredential
  checkpoint?: { path: string; startSection: DiagnosticSection }
}): Promise<void> {
  const startedAt = new Date().toISOString().replaceAll(':', '-')
  const evidenceDirectory = fileURLToPath(
    new URL('../../../local-validation/local-convex-proofs/phase82-vtt-browser', import.meta.url)
  )
  await mkdir(evidenceDirectory, { recursive: true })
  if (input.checkpoint) {
    assert.ok(isAbsolute(input.checkpoint.path), 'Managed VTT checkpoint path must be absolute.')
    assert.ok(
      relative(evidenceDirectory, input.checkpoint.path).startsWith(`..${sep}`),
      'Managed VTT checkpoint must stay outside recursively redacted browser evidence.'
    )
  }
  const [ticketSecret, workerSecret] = await Promise.all([
    convexEnvironmentValue('LIVE_SESSION_TICKET_SECRET'),
    convexEnvironmentValue('LIVE_SESSION_WORKER_SECRET')
  ])
  const localSiteUrl = new URL(process.env.CONVEX_SITE_URL ?? '')
  assert.equal(localSiteUrl.protocol, 'http:')
  assert.ok(['127.0.0.1', '[::1]', 'localhost'].includes(localSiteUrl.hostname))
  const capturePreflight = await fetch(new URL('/live-sessions/capture', localSiteUrl), {
    body: '{}',
    headers: {
      authorization: `Bearer ${await input.gm.fetchToken()}`,
      'content-type': 'application/json',
      'x-artificer-live-session-secret': workerSecret
    },
    method: 'POST',
    signal: AbortSignal.timeout(30_000)
  })
  assert.equal(
    capturePreflight.status,
    400,
    `Local live-session capture authentication failed with HTTP ${capturePreflight.status}.`
  )
  let output = ''
  let passed = false
  try {
    const result = await promisify(execFile)(
      'pwsh.exe',
      [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        'yarn.ps1 workspace @artificer-toolkit/web test:e2e:vtt-local --workers=1 --output=$env:CONVEX_E2E_OUTPUT; exit $LASTEXITCODE'
      ],
      {
        cwd: repoRoot,
        env: {
          ...process.env,
          MANAGED_VTT_CAMPAIGN_NAME: input.campaignName,
          MANAGED_VTT_GM_EMAIL: input.gm.email,
          MANAGED_VTT_GM_PASSWORD: input.gm.password,
          MANAGED_VTT_PLAYER_EMAIL: input.player.email,
          MANAGED_VTT_PLAYER_PASSWORD: input.player.password,
          MANAGED_VTT_PLAYER2_EMAIL: input.player2.email,
          MANAGED_VTT_PLAYER2_PASSWORD: input.player2.password,
          CONVEX_E2E_OUTPUT: `${evidenceDirectory}/playwright`,
          LIVE_SESSION_TICKET_SECRET: ticketSecret,
          LIVE_SESSION_WORKER_SECRET: workerSecret,
          ...(input.checkpoint
            ? {
                MANAGED_VTT_CHECKPOINT_PATH: input.checkpoint.path,
                MANAGED_VTT_START_SECTION: input.checkpoint.startSection
              }
            : {})
        },
        windowsHide: true,
        timeout: 30 * 60_000,
        maxBuffer: 2 * 1024 * 1024
      }
    )
    output = result.stdout + result.stderr
    passed = true
  } catch (error) {
    if (error && typeof error === 'object') {
      if ('stdout' in error && typeof error.stdout === 'string') output += error.stdout
      if ('stderr' in error && typeof error.stderr === 'string') output += error.stderr
    }
  } finally {
    const secrets = [input.gm, input.player, input.player2]
      .flatMap((credential) => [credential.email, credential.password, credential.session])
      .filter((secret): secret is string => Boolean(secret))
    for (const secret of secrets) output = output.replaceAll(secret, '[fixture credential]')
    await writeFile(`${evidenceDirectory}/playwright.log`, output)
    await writeFile(`${evidenceDirectory}/playwright-${startedAt}.log`, output)
    await redactEvidence(evidenceDirectory, secrets)
  }
  assert.ok(passed, `Native VTT browser suite failed; see ${evidenceDirectory}/playwright.log.`)
  console.log('Native VTT browser journey passed.')
}
