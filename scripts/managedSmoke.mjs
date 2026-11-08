// The bounded managed (staging) smoke and cold-isolate signed-in SSR CPU measurement
// (RELEASE-3.T1; docs/validation/release-3-staging-promotion-packet.md). It runs only against a
// staging web origin the operator names, with the managed environment the review-data builder uses
// (names in the packet), and refuses to start without them. `run` creates one disposable account
// through the product, walks the signed-in pages and removes the account through the product.
// `evaluate` is offline: it joins the recorded requests to CPU rows exported from Workers Logs.
//
//   node scripts/managedSmoke.mjs run --web-origin=https://<staging web host> [--rounds=N]
//     [--idle-minutes=M] [--system-id=<id>] [--out=local-validation/release-3/<name>/requests.json]
//   node scripts/managedSmoke.mjs evaluate --requests=<requests.json> --cpu=<cpu-rows.json>
//     [--out=<verdict.json>]
import { spawn } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, relative, resolve } from 'node:path'
import { yarnSpawn } from './convexSelfHosted.mjs'
import { evaluateSsrCpu, parseSmokeArguments, resolveSmokeTarget } from './managedSmokePolicy.mjs'

const root = resolve(import.meta.dirname, '..')
const { command, options } = parseSmokeArguments(process.argv.slice(2))

const underEvidence = (path) => {
  const absolute = resolve(root, path)
  if (relative(resolve(root, 'local-validation'), absolute).startsWith('..'))
    throw new Error('Evidence paths must sit under local-validation/.')
  return absolute
}

if (command === 'run') await run()
else await evaluate()

async function run() {
  const target = resolveSmokeTarget(
    {
      webOrigin: options['web-origin'],
      rounds: options.rounds === undefined ? undefined : Number(options.rounds),
      idleMinutes:
        options['idle-minutes'] === undefined ? undefined : Number(options['idle-minutes'])
    },
    process.env
  )
  const requestsPath = underEvidence(
    options.out ?? 'local-validation/release-3/smoke/requests.json'
  )
  await mkdir(dirname(requestsPath), { recursive: true })
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
    'REVIEW_MAILBOX'
  ]
  const environment = {
    ...Object.fromEntries(
      names.filter((key) => process.env[key]).map((key) => [key, process.env[key]])
    ),
    SMOKE_WEB_ORIGIN: target.webOrigin,
    SMOKE_ROUNDS: String(target.rounds),
    SMOKE_IDLE_MINUTES: String(target.idleMinutes),
    SMOKE_REQUESTS_PATH: requestsPath,
    ...(options['system-id'] ? { SMOKE_SYSTEM_ID: options['system-id'] } : {})
  }
  const [executable, args] = yarnSpawn(['tsx', 'apps/apis/tests/developmentManagedSmokeCli.ts'])
  const child = spawn(executable, args, {
    cwd: root,
    env: environment,
    shell: false,
    stdio: 'inherit'
  })
  process.exitCode = await new Promise((resolveExit, reject) => {
    child.once('error', reject)
    child.once('close', (code) => resolveExit(code === 0 ? 0 : 1))
  })
}

async function evaluate() {
  if (!options.requests || !options.cpu) throw new Error('evaluate needs --requests and --cpu.')
  const recorded = JSON.parse(await readFile(underEvidence(options.requests), 'utf8'))
  const cpuRows = JSON.parse(await readFile(underEvidence(options.cpu), 'utf8'))
  const verdict = evaluateSsrCpu({
    requests: recorded.requests,
    cpuRows,
    cleanup: recorded.cleanup
  })
  const result = { ...verdict, runId: recorded.runId }
  if (options.out)
    await writeFile(underEvidence(options.out), `${JSON.stringify(result, null, 2)}\n`)
  console.log(JSON.stringify(result, null, 2))
  process.exitCode = result.pass ? 0 : 1
}
