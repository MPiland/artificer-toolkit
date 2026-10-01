import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { promisify } from 'node:util'
import { developmentCli } from './developmentCli'
import { createHash } from 'node:crypto'

const execute = promisify(execFile)
const workspace = fileURLToPath(new URL('..', import.meta.url))
const args = {
  quoted: '"single" \'double\' backslash\\ newline\n',
  unicode: '⚒️ 你好 مرحبا',
  payload: 'x'.repeat(35_000)
}
const argvProbe = `
import { createHash } from 'node:crypto'
import { writeSync } from 'node:fs'
process.on('exit', () => {
  const input = process.argv.at(-1)
  const componentIndex = process.argv.indexOf('--component')
  const urlIndex = process.argv.indexOf('--url')
  const keyIndex = process.argv.indexOf('--admin-key')
  writeSync(1, '\\nCLI_MARKER=' + Buffer.from(JSON.stringify({
    component: componentIndex >= 0 ? process.argv[componentIndex + 1] : null,
    url: urlIndex >= 0 ? process.argv[urlIndex + 1] : null,
    hasAdminKey: keyIndex >= 0
  })).toString('base64') + '\\n')
  if (input?.trimStart().startsWith('{'))
    writeSync(1, '\\nINPUT_SHA256=' + createHash('sha256').update(JSON.stringify(JSON.parse(input))).digest('hex') + '\\n')
})`
const environment = {
  ...process.env,
  DRAFT_PROOF_FUNCTION: '--help',
  DRAFT_PROOF_COMPONENT: '',
  DRAFT_PROOF_LOCAL_URL: '',
  DRAFT_PROOF_LOCAL_ADMIN_KEY: '',
  NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ''} --import=data:text/javascript,${encodeURIComponent(argvProbe)}`
}

function marker(output: string) {
  const encoded = output.match(/CLI_MARKER=([A-Za-z0-9+/=]+)/)?.[1]
  assert.ok(encoded, 'The official CLI flag probe must run.')
  return JSON.parse(Buffer.from(encoded, 'base64').toString('utf8')) as {
    component: string | null
    url: string | null
    hasAdminKey: boolean
  }
}

async function run(input: string, env = environment) {
  const child = execute(
    'pwsh.exe',
    [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      '$ErrorActionPreference = "Stop"; $input | yarn.ps1 node tests/developmentCliEntry.mjs; if (-not $?) { exit 1 }; exit $LASTEXITCODE'
    ],
    {
      cwd: workspace,
      env,
      windowsHide: true,
      timeout: 60_000,
      maxBuffer: 256 * 1024
    }
  )
  const stdin = child.child.stdin
  assert.ok(stdin)
  const transport = pipeline(Readable.from([Buffer.from(input).toString('base64')]), stdin)
  await Promise.all([child, transport])
  return child
}

const result = await run(JSON.stringify(args))
assert.match(result.stdout, /Usage: convex run/)
const receivedHash = result.stdout.match(/INPUT_SHA256=([a-f0-9]{64})/)?.[1]
assert.ok(receivedHash, 'The official CLI argument probe must run.')
assert.equal(
  receivedHash,
  createHash('sha256').update(JSON.stringify(args)).digest('hex'),
  'The official CLI must receive the original JSON values, including Unicode.'
)
assert.deepEqual(
  marker(
    (await run(JSON.stringify(args), { ...environment, DRAFT_PROOF_COMPONENT: 'betterAuth' }))
      .stdout
  ),
  { component: 'betterAuth', url: null, hasAdminKey: false }
)
assert.deepEqual(
  marker(
    (
      await run(JSON.stringify(args), {
        ...environment,
        DRAFT_PROOF_LOCAL_URL: 'http://127.0.0.1:3220',
        DRAFT_PROOF_LOCAL_ADMIN_KEY: 'local-test-key'
      })
    ).stdout
  ),
  { component: null, url: 'http://127.0.0.1:3220', hasAdminKey: true }
)
await assert.rejects(run('{}', { ...environment, DRAFT_PROOF_LOCAL_URL: 'http://127.0.0.1:3220' }))
const originalLocalUrl = process.env.CONVEX_SELF_HOSTED_URL
try {
  process.env.CONVEX_SELF_HOSTED_URL = 'https://unapproved.example.invalid'
  await assert.rejects(developmentCli('--help', args, false), /arguments\/output withheld/)
} finally {
  if (originalLocalUrl === undefined) delete process.env.CONVEX_SELF_HOSTED_URL
  else process.env.CONVEX_SELF_HOSTED_URL = originalLocalUrl
}
await assert.rejects(run('{}', { ...environment, DRAFT_PROOF_FUNCTION: '' }))
await assert.rejects(run('{'))
await assert.rejects(developmentCli('', {}, false), /arguments\/output withheld/)
const originalPath = process.env.PATH
try {
  process.env.PATH = ''
  await assert.rejects(developmentCli('--help', args, false), /arguments\/output withheld/)
} finally {
  if (originalPath === undefined) delete process.env.PATH
  else process.env.PATH = originalPath
}
const originalFetch = globalThis.fetch
const localEnvironment = {
  CONVEX_DEPLOYMENT: 'local:transport-check',
  CONVEX_URL: 'http://127.0.0.1:3220',
  CONVEX_SITE_URL: 'http://127.0.0.1:3221',
  CONVEX_SELF_HOSTED_URL: 'http://127.0.0.1:3220',
  CONVEX_SELF_HOSTED_ADMIN_KEY: 'fake-transport-check-key'
}
const originalEnvironment = Object.fromEntries(
  Object.keys(localEnvironment).map((key) => [key, process.env[key]])
)
try {
  Object.assign(process.env, localEnvironment)
  const payload = '⚒'.repeat(Math.floor((4 * 1024 * 1024) / 3)) + 'x'
  assert.equal(Buffer.byteLength(payload), 4 * 1024 * 1024)
  let calls = 0
  let expectedComponent = true
  let response = new Response(JSON.stringify({ status: 'success', value: payload }))
  globalThis.fetch = async (input, init) => {
    calls++
    assert.equal(input, `${localEnvironment.CONVEX_URL}/api/function`)
    assert.equal(init?.method, 'POST')
    assert.equal(
      new Headers(init?.headers).get('Authorization'),
      `Convex ${localEnvironment.CONVEX_SELF_HOSTED_ADMIN_KEY}`
    )
    assert.ok(init?.signal instanceof AbortSignal)
    assert.equal(typeof init?.body, 'string')
    assert.deepEqual(JSON.parse(String(init?.body)), {
      path: 'transport:probe',
      ...(expectedComponent ? { componentPath: 'betterAuth' } : {}),
      format: 'convex_encoded_json',
      args
    })
    return response
  }
  const received = await developmentCli('transport:probe', { ...args, omitted: undefined })
  assert.equal(typeof received, 'string')
  assert.equal(Buffer.byteLength(String(received)), Buffer.byteLength(payload))
  assert.equal(
    createHash('sha256').update(String(received)).digest('hex'),
    createHash('sha256').update(payload).digest('hex')
  )
  expectedComponent = false
  response = new Response(JSON.stringify({ status: 'success', value: null }))
  assert.equal(await developmentCli('transport:probe', args, false), null)
  for (const failure of [
    new Response('private-http-detail', { status: 500 }),
    new Response(JSON.stringify({ status: 'error', errorMessage: 'private-envelope-detail' })),
    new Response(JSON.stringify({ status: 'success' }))
  ]) {
    response = failure
    await assert.rejects(developmentCli('transport:probe', args, false), (error: unknown) => {
      assert.ok(error instanceof Error)
      assert.match(error.message, /arguments\/output withheld/)
      assert.doesNotMatch(error.message, /private-|fake-transport-check-key/)
      return true
    })
  }
  const completedCalls = calls
  for (const invalid of [
    { CONVEX_SELF_HOSTED_URL: 'https://unapproved.example.invalid' },
    { CONVEX_SELF_HOSTED_ADMIN_KEY: '' },
    { CONVEX_SITE_URL: '' },
    { CONVEX_DEPLOYMENT: 'dev:transport-check' }
  ]) {
    Object.assign(process.env, localEnvironment, invalid)
    await assert.rejects(
      developmentCli('transport:probe', args, false),
      /arguments\/output withheld/
    )
    assert.equal(calls, completedCalls, 'Invalid targets must be rejected before fetch.')
  }
} finally {
  globalThis.fetch = originalFetch
  for (const [key, value] of Object.entries(originalEnvironment)) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
}
console.log(
  JSON.stringify({ argvSafePayloadChars: JSON.stringify(args).length, help: 'PASS', http: 'PASS' })
)
