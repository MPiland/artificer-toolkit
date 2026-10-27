import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { extname, isAbsolute, join, relative, sep } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { convexEnvironmentValue } from './developmentConvexEnvironment'
import { proofPwsh, proofYarn } from './developmentShell'

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

/**
 * Runs `cleanup` once the browser run requests it through `signalPath`, then tells the run it is
 * done. Resolves with the cleanup failure, or null, and never rejects.
 */
async function serveCleanupRequest(
  signalPath: string,
  cleanup: () => Promise<void>,
  browserRun: Promise<unknown>
): Promise<{ failure: unknown } | null> {
  let finished = false
  const markFinished = () => {
    finished = true
  }
  void browserRun.then(markFinished, markFinished)
  while (!finished) {
    if (
      await readFile(`${signalPath}.requested`).then(
        () => true,
        () => false
      )
    ) {
      try {
        await cleanup()
        return null
      } catch (failure) {
        return { failure }
      } finally {
        await writeFile(`${signalPath}.done`, '')
      }
    }
    await delay(1_000)
  }
  return null
}

export async function verifyDevelopmentVttBrowser(input: {
  campaignName: string
  gm: FixtureCredential
  player: FixtureCredential
  player2: FixtureCredential
  checkpoint?: { path: string; startSection: DiagnosticSection }
  /**
   * Deletes the fixture Campaign while the browser run's own Session Worker is still up. The run
   * requests it only after a fully passing journey.
   */
  cleanupWhileWorkerRuns?: () => Promise<void>
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
  const [ticketSecret, workerSecret, snapshotSecret] = await Promise.all([
    convexEnvironmentValue('LIVE_SESSION_TICKET_SECRET'),
    convexEnvironmentValue('LIVE_SESSION_WORKER_SECRET'),
    convexEnvironmentValue('CONTENT_SNAPSHOT_TOKEN_SECRET')
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
  let cleanupOutcome: Awaited<ReturnType<typeof serveCleanupRequest>> = null
  const cleanupSignalPath = input.cleanupWhileWorkerRuns
    ? `${evidenceDirectory}/cleanup-${startedAt}`
    : null
  try {
    const browserRun = promisify(execFile)(
      proofPwsh,
      [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        `${proofYarn} workspace @artificer-toolkit/web test:e2e:vtt-local --workers=1 --output=$env:CONVEX_E2E_OUTPUT; exit $LASTEXITCODE`
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
          CONTENT_SNAPSHOT_TOKEN_SECRET: snapshotSecret,
          ...(input.checkpoint
            ? {
                MANAGED_VTT_CHECKPOINT_PATH: input.checkpoint.path,
                MANAGED_VTT_START_SECTION: input.checkpoint.startSection
              }
            : {}),
          ...(cleanupSignalPath ? { MANAGED_VTT_CLEANUP_SIGNAL: cleanupSignalPath } : {})
        },
        windowsHide: true,
        timeout: 30 * 60_000,
        maxBuffer: 2 * 1024 * 1024
      }
    )
    const cleanupServed =
      cleanupSignalPath && input.cleanupWhileWorkerRuns
        ? serveCleanupRequest(cleanupSignalPath, input.cleanupWhileWorkerRuns, browserRun)
        : Promise.resolve(null)
    const result = await browserRun
    cleanupOutcome = await cleanupServed
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
    if (cleanupSignalPath)
      await Promise.all(
        ['requested', 'done'].map((suffix) => rm(`${cleanupSignalPath}.${suffix}`, { force: true }))
      )
  }
  assert.ok(passed, `Native VTT browser suite failed; see ${evidenceDirectory}/playwright.log.`)
  if (cleanupOutcome) throw cleanupOutcome.failure
  console.log('Native VTT browser journey passed.')
}
