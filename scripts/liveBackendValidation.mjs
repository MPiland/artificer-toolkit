// Manifest, codegen push, deploy, seed and SRD audit against a self-hosted Convex backend container:
// the local Docker backend by default, or an ephemeral container on a GitHub runner (see
// .github/workflows/live-backend.yml). Stops at the first failing step; each step's log and duration
// go to --log-dir when given. The admin key never reaches a log or a file (convexSelfHosted.mjs).
//   node scripts/liveBackendValidation.mjs [--url=<loopback url>] [--container=<name>]
//     [--steps=manifest,env,codegen,deploy,seed,audit] [--log-dir=<dir>]
import { spawn } from 'node:child_process'
import { createWriteStream } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import {
  assertLoopbackUrl,
  generateAdminKey,
  localConvex,
  selfHostedEnv
} from './convexSelfHosted.mjs'

// Each step is a list of commands run in apps/apis. `env` is for a fresh backend only (the CI
// container): auth.config.ts needs JWKS before any push, and an empty value selects the database-backed
// signing keys. The local container already has its own, so `env` is not a default step.
const allSteps = {
  manifest: [['yarn', ['generate:srd:manifest']]],
  env: [['yarn', ['convex', 'env', 'set', 'JWKS', '']]],
  codegen: [['yarn', ['convex', 'codegen', '--typecheck', 'disable']]],
  deploy: [['yarn', ['convex', 'deploy', '--yes', '--typecheck', 'disable', '--codegen', 'disable']]],
  seed: [['yarn', ['convex', 'run', 'content/seed:seed']]],
  audit: [['yarn', ['convex', 'run', 'content/seed:audit']]]
}

const options = Object.fromEntries(
  process.argv.slice(2).map((argument) => {
    const [name, ...value] = argument.replace(/^--/u, '').split('=')
    return [name, value.join('=')]
  })
)
const url = options.url || localConvex.url
const container = options.container || localConvex.container
const stepNames = (options.steps || 'manifest,codegen,deploy,seed,audit').split(',')
const unknown = stepNames.filter((name) => !(name in allSteps))
if (unknown.length) throw new Error(`Unknown steps: ${unknown.join(', ')}.`)
assertLoopbackUrl(url)

const adminKey = generateAdminKey(container)
// Keeps the key out of the runner's log even if a tool were to echo it.
if (process.env.GITHUB_ACTIONS === 'true') console.log(`::add-mask::${adminKey}`)
const env = selfHostedEnv(url, adminKey)
const logDir = options['log-dir'] ? resolve(options['log-dir']) : undefined
if (logDir) await mkdir(logDir, { recursive: true })

function runCommand([command, args], log) {
  return new Promise((resolveCommand) => {
    const child = spawn(command, args, {
      cwd: 'apps/apis',
      env,
      shell: process.platform === 'win32',
      stdio: ['ignore', 'pipe', 'pipe']
    })
    const forward = (target) => (chunk) => {
      const text = chunk.toString().replaceAll(adminKey, '***')
      target.write(text)
      log?.write(text)
    }
    child.stdout.on('data', forward(process.stdout))
    child.stderr.on('data', forward(process.stderr))
    child.on('close', (status) => resolveCommand(status ?? 1))
  })
}

async function runStep(name) {
  const log = logDir ? createWriteStream(join(logDir, `${name}.log`)) : undefined
  let status = 0
  for (const command of allSteps[name]) {
    status = await runCommand(command, log)
    if (status !== 0) break
  }
  log?.end()
  return status
}

const summary = []
let failed = false
for (const name of stepNames) {
  const started = Date.now()
  const status = await runStep(name)
  const seconds = Math.round((Date.now() - started) / 1000)
  summary.push({ step: name, status, seconds })
  console.log(`step ${name} exit ${status} ${seconds}s`)
  if (status !== 0) {
    failed = true
    break
  }
}
if (logDir) await writeFile(join(logDir, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`)
process.exit(failed ? 1 : 0)
