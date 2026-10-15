// Runs `convex run <function>` against the local Docker Convex backend. The admin key is generated
// inside the container for this run and reaches the CLI only through its environment; it is never
// printed or written.
import { spawnSync } from 'node:child_process'
import { generateAdminKey, localConvex, selfHostedEnv } from '../../../scripts/convexSelfHosted.mjs'

const functionName = process.argv[2]
if (!functionName) throw new Error('Usage: convexRunLocal.mjs <module:function>')

const run = spawnSync('convex', ['run', functionName], {
  env: selfHostedEnv(localConvex.url, generateAdminKey(localConvex.container)),
  shell: process.platform === 'win32',
  stdio: 'inherit'
})
process.exit(run.status ?? 1)
