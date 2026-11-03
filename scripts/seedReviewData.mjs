// Builds the user's review data on the LOCAL Docker Convex deployment through product commands:
// named review Campaigns with members, Scenes with tokens and played-through Encounters. It
// starts the documented Session Worker (127.0.0.1:8787), runs apps/apis/tests/developmentReviewDataCli.ts
// with the same secret handling as scripts/runLocalBrowserProof.mjs, then stops only the Worker it
// started. It never resets, deploys or reseeds the container; run it after the backend is deployed
// and seeded. Re-running skips every finished Campaign, so it is safe after a reset too.
//
// With --managed --set=<N> it instead builds tester set N on a managed (staging) deployment named by
// CONVEX_URL and CONVEX_SITE_URL: five accounts on REVIEW_MAILBOX (name+tN-role@domain) with a
// password generated for the set and printed once to this terminal only (never to the log), and the
// set's own review Campaigns, named "... (set N)". Re-running a set skips what it built and needs
// REVIEW_SET_PASSWORD; --rebuild deletes the set's Campaigns, resets its password and builds again.
// No fixtures, container admin key, Worker or email sink run there. The environment must hold
// REVIEW_MANAGED_CONFIRM=<deployment name>, REVIEW_MANAGED_ADMIN_KEY, REVIEW_WORKER_CONTROL_SECRET and
// REVIEW_WEB_ORIGIN. Run it only with the owner's approval for that run (ADR 0035).
//
//   node scripts/seedReviewData.mjs [--name=<evidence-name>] [--managed --set=<N> [--rebuild]]
import { spawn } from 'node:child_process'
import { createWriteStream } from 'node:fs'
import { mkdir, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { localConvex, yarnSpawn } from './convexSelfHosted.mjs'
import {
  assertLocalLifecycleTarget,
  ensureLocalConvexFixtures,
  loadLocalEnvironment,
  run,
  startLocalSessionWorker,
  useGeneratedLocalAdminKey
} from './validatePreStagingLocal.mjs'

const name =
  process.argv.find((argument) => argument.startsWith('--name='))?.slice('--name='.length) ??
  `review-data-${new Date().toISOString().replaceAll(/[:.]/gu, '-')}`

const root = resolve(import.meta.dirname, '..')
const artifactDirectory = resolve(root, 'local-validation/review-data', name)
await mkdir(artifactDirectory, { recursive: true })
const logPath = resolve(artifactDirectory, 'seed.log')

if (process.argv.includes('--managed')) {
  const set = process.argv.find((argument) => argument.startsWith('--set='))?.slice('--set='.length)
  if (!set) throw new Error('--managed requires --set=<N>.')
  await runManaged(set, process.argv.includes('--rebuild'))
} else {
  await runLocal()
}

async function runManaged(set, rebuild) {
  // The local lifecycle helpers (`run`, fixtures, admin key) refuse a remote target by design, so
  // the managed path spawns the driver directly with only the variables it needs. File descriptor 3
  // carries the generated password to this terminal, bypassing the log.
  const names = [
    'PATH',
    'Path',
    'SystemRoot',
    'USERPROFILE',
    'APPDATA',
    'LOCALAPPDATA',
    'TEMP',
    'HOME',
    'CONVEX_URL',
    'CONVEX_SITE_URL',
    'REVIEW_MANAGED_CONFIRM',
    'REVIEW_MANAGED_ADMIN_KEY',
    'REVIEW_WORKER_CONTROL_SECRET',
    'REVIEW_WEB_ORIGIN',
    'REVIEW_MAILBOX',
    'REVIEW_SET_PASSWORD'
  ]
  const environment = {
    ...Object.fromEntries(
      names.filter((key) => process.env[key]).map((key) => [key, process.env[key]])
    ),
    REVIEW_SET: set,
    ...(rebuild ? { REVIEW_REBUILD: '1' } : {})
  }
  const [executable, args] = yarnSpawn(['tsx', 'apps/apis/tests/developmentReviewDataCli.ts'])
  const log = createWriteStream(logPath)
  const child = spawn(executable, args, {
    cwd: root,
    env: environment,
    shell: false,
    stdio: ['ignore', 'pipe', 'pipe', 'pipe']
  })
  child.stdout.pipe(log, { end: false })
  child.stderr.pipe(log, { end: false })
  child.stdio[3].pipe(process.stdout, { end: false })
  const code = await new Promise((resolveExit, reject) => {
    child.once('error', reject)
    child.once('close', resolveExit)
  })
  log.end()
  process.stdout.write(`${(await readFile(logPath, 'utf8')).slice(-4000)}
`)
  process.exitCode = code === 0 ? 0 : 1
}

async function runLocal() {
  await loadLocalEnvironment()
  await useGeneratedLocalAdminKey()
  assertLocalLifecycleTarget()
  await ensureLocalConvexFixtures(artifactDirectory)

  const worker = await startLocalSessionWorker(artifactDirectory)
  try {
    await run('yarn', ['tsx', 'apps/apis/tests/developmentReviewDataCli.ts'], {
      logPath,
      environment: {
        YARN_INJECT_ENVIRONMENT_FILES: resolve(
          root,
          'local-validation/local-convex/local.application.env'
        ),
        CONVEX_DEPLOYMENT: `local:${localConvex.instance}`,
        CONVEX_URL: localConvex.url,
        CONVEX_SITE_URL: localConvex.siteUrl,
        CONVEX_SELF_HOSTED_URL: process.env.CONVEX_SELF_HOSTED_URL,
        CONVEX_SELF_HOSTED_ADMIN_KEY: process.env.CONVEX_SELF_HOSTED_ADMIN_KEY
      }
    })
  } finally {
    await worker.stop()
    const log = await readFile(logPath, 'utf8').catch(() => '')
    process.stdout.write(`${log.slice(-4000)}\n`)
  }
}
