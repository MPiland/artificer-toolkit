// Builds the user's review data on the LOCAL Docker Convex deployment through product commands:
// named review Campaigns with members, Scenes with tokens and played-through Encounters. It
// starts the documented Session Worker (127.0.0.1:8787), runs apps/apis/tests/developmentReviewDataCli.ts
// with the same secret handling as scripts/runLocalBrowserProof.mjs, then stops only the Worker it
// started. It never resets, deploys or reseeds the container; run it after the backend is deployed
// and seeded. Re-running skips every finished Campaign, so it is safe after a reset too.
//
// With --managed it instead builds on a managed (staging) deployment named by CONVEX_URL and
// CONVEX_SITE_URL, binding the invited tester accounts of --role-map=<json file> (no accounts are
// created, no shared password, no fixtures, no admin key, no email sink). Needs
// REVIEW_MANAGED_CONFIRM=<deployment name>, REVIEW_WORKER_CONTROL_SECRET and REVIEW_WEB_ORIGIN in
// the environment. Run it only with the owner's approval for that run (ADR 0035).
//
//   node scripts/seedReviewData.mjs [--name=<evidence-name>] [--managed --role-map=<file>]
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
  const roleMap = process.argv
    .find((argument) => argument.startsWith('--role-map='))
    ?.slice('--role-map='.length)
  if (!roleMap) throw new Error('--managed requires --role-map=<json file>.')
  await runManaged(resolve(roleMap))
} else {
  await runLocal()
}

async function runManaged(roleMapPath) {
  // The local lifecycle helpers (`run`, fixtures, admin key) refuse a remote target by design, so
  // the managed path spawns the driver directly with only the variables it needs.
  const names = [
    'CONVEX_URL',
    'CONVEX_SITE_URL',
    'REVIEW_MANAGED_CONFIRM',
    'REVIEW_WORKER_CONTROL_SECRET',
    'REVIEW_WEB_ORIGIN'
  ]
  const environment = {
    ...Object.fromEntries(
      ['PATH', 'Path', 'SystemRoot', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'TEMP', 'HOME']
        .map((key) => [key, process.env[key]])
        .filter(([, value]) => value)
    ),
    ...Object.fromEntries(names.map((key) => [key, process.env[key]]).filter(([, value]) => value)),
    REVIEW_ROLE_MAP_PATH: roleMapPath
  }
  const [executable, args] = yarnSpawn(['tsx', 'apps/apis/tests/developmentReviewDataCli.ts'])
  const log = createWriteStream(logPath)
  const child = spawn(executable, args, { cwd: root, env: environment, shell: false })
  child.stdout.pipe(log, { end: false })
  child.stderr.pipe(log, { end: false })
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
