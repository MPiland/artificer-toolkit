// Runs one native browser proof against the LOCAL Docker Convex deployment without the full
// pre-staging lifecycle: optionally deploys the current source to the local container, starts the
// documented Worker (127.0.0.1:8787) and web app (localhost:3000) with the same secret handling as
// scripts/validatePreStagingLocal.mjs, runs scripts/runLocalConvexProof.ps1, then stops only the
// services it started. It never resets or reseeds the container.
//
//   node scripts/runLocalBrowserProof.mjs --name=<unique-evidence-name> --proof=<proof> [--deploy]
import { mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { convexCliArguments, convexDeployArguments } from './convexSelfHosted.mjs'
import {
  assertLocalLifecycleTarget,
  ensureLocalConvexFixtures,
  loadLocalEnvironment,
  run,
  selfManagedBrowserProof,
  startLocalSessionWorker,
  startLocalWebApp,
  useGeneratedLocalAdminKey
} from './validatePreStagingLocal.mjs'

const option = (name) =>
  process.argv.find((argument) => argument.startsWith(`--${name}=`))?.slice(name.length + 3)
const name = option('name')
const proof = option('proof')
if (!name || !proof) throw new Error('Pass --name=<evidence-name> and --proof=<proof>.')

await loadLocalEnvironment()
await useGeneratedLocalAdminKey()
assertLocalLifecycleTarget()

const artifactDirectory = resolve(import.meta.dirname, '..', 'local-validation/browser-proof', name)
await mkdir(artifactDirectory, { recursive: true })

if (process.argv.includes('--deploy'))
  await run('yarn', convexDeployArguments, {
    logPath: resolve(artifactDirectory, 'convex-deploy.log'),
    sensitiveArgs: convexCliArguments(
      process.env.CONVEX_SELF_HOSTED_URL,
      process.env.CONVEX_SELF_HOSTED_ADMIN_KEY
    )
  })
await ensureLocalConvexFixtures(artifactDirectory)

const services = []
try {
  // The self-managed proof starts its own Worker and web app on the same ports.
  if (proof !== selfManagedBrowserProof) {
    services.push(await startLocalSessionWorker(artifactDirectory))
    services.push(await startLocalWebApp(artifactDirectory))
  }
  await run(
    'pwsh',
    [
      '-NoProfile',
      '-NonInteractive',
      '-File',
      'scripts/runLocalConvexProof.ps1',
      '-Name',
      name,
      '-Proof',
      proof
    ],
    { logPath: resolve(artifactDirectory, 'proof.log') }
  )
} finally {
  for (const service of services.reverse()) await service.stop()
}
