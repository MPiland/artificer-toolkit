// Runs `convex run <function>` against the local Docker Convex backend. The admin key is generated
// inside the container for this run and reaches the CLI only through its environment; it is never
// printed or written.
import { spawnSync } from 'node:child_process'

const container = 'phase82-convex-local-linux'
const url = 'http://127.0.0.1:3210'
const functionName = process.argv[2]
if (!functionName) throw new Error('Usage: convexRunLocal.mjs <module:function>')

const generated = spawnSync('docker', ['exec', container, './generate_admin_key.sh'], {
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'ignore'],
  windowsHide: true
})
const adminKey = generated.stdout?.trim().split(/\r?\n/u).at(-1)?.trim()
if (generated.status !== 0 || !adminKey) throw new Error('Could not generate the local admin key.')

const run = spawnSync('convex', ['run', functionName], {
  env: { ...process.env, CONVEX_SELF_HOSTED_URL: url, CONVEX_SELF_HOSTED_ADMIN_KEY: adminKey },
  shell: process.platform === 'win32',
  stdio: 'inherit'
})
process.exit(run.status ?? 1)
