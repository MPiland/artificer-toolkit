// Runs `convex run <function>` against the local Docker Convex backend. The admin key is generated
// inside the container for this run and reaches the CLI only as an argument; it is never printed or
// written.
import { spawnSync } from 'node:child_process'
import {
  assertConvexInstance,
  convexCliArguments,
  convexCliEnvironment,
  generateAdminKey,
  localConvex,
  yarnSpawn
} from '../../../scripts/convexSelfHosted.mjs'

const functionName = process.argv[2]
if (!functionName) throw new Error('Usage: convexRunLocal.mjs <module:function>')

await assertConvexInstance(localConvex.url, localConvex.instance)
const [executable, args] = yarnSpawn([
  'exec',
  'convex',
  'run',
  functionName,
  ...convexCliArguments(localConvex.url, generateAdminKey(localConvex.container))
])
const run = spawnSync(executable, args, {
  env: convexCliEnvironment(),
  shell: false,
  stdio: 'inherit'
})
process.exit(run.status ?? 1)
