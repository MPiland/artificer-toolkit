// `yarn dev:session-worker`: runs the Session Worker against the local Docker Convex backend with its
// secrets read in memory (localSessionWorker.mjs). Room state persists in the Worker's .wrangler/state.
import { spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import {
  assertConvexInstance,
  convexCliEnvironment,
  generateAdminKey,
  localConvex,
  yarnSpawn
} from './convexSelfHosted.mjs'
import { localSessionWorker, localSessionWorkerBindings } from './localSessionWorker.mjs'

await assertConvexInstance(localConvex.url, localConvex.instance)
process.env.CONVEX_SELF_HOSTED_URL = localConvex.url
process.env.CONVEX_SELF_HOSTED_ADMIN_KEY = generateAdminKey(localConvex.container)
const bindings = await localSessionWorkerBindings(localConvex.siteUrl)

// The empty env file keeps the ignored .dev.vars out, so its stale values cannot override these.
const environmentFile = resolve(import.meta.dirname, '../local-validation/dev-session-worker.env')
await mkdir(resolve(environmentFile, '..'), { recursive: true })
await writeFile(environmentFile, '')
const environment = { ...convexCliEnvironment(), ...bindings }
delete environment.CONVEX_SELF_HOSTED_ADMIN_KEY

const { host, port } = localSessionWorker
const [command, args] = yarnSpawn([
  'workspace',
  '@artificer-toolkit/session-worker',
  'dev',
  '--env-file',
  environmentFile,
  '--ip',
  host,
  '--port',
  String(port)
])
const worker = spawn(command, args, { env: environment, stdio: 'inherit', windowsHide: true })
worker.on('exit', (code) => {
  process.exitCode = code ?? 1
})
