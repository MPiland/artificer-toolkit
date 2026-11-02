// Builds the user's review data on the LOCAL Docker Convex deployment through product commands:
// named review Campaigns with members, Scenes with tokens and played-through Encounters. It
// starts the documented Session Worker (127.0.0.1:8787), runs apps/apis/tests/developmentReviewDataCli.ts
// with the same secret handling as scripts/runLocalBrowserProof.mjs, then stops only the Worker it
// started. It never resets, deploys or reseeds the container; run it after the backend is deployed
// and seeded. Re-running skips every finished Campaign, so it is safe after a reset too.
//
//   node scripts/seedReviewData.mjs [--name=<evidence-name>]
import { mkdir, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { localConvex } from './convexSelfHosted.mjs'
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

await loadLocalEnvironment()
await useGeneratedLocalAdminKey()
assertLocalLifecycleTarget()

const root = resolve(import.meta.dirname, '..')
const artifactDirectory = resolve(root, 'local-validation/review-data', name)
await mkdir(artifactDirectory, { recursive: true })
await ensureLocalConvexFixtures(artifactDirectory)

const logPath = resolve(artifactDirectory, 'seed.log')
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
