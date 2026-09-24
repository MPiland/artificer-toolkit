import assert from 'node:assert/strict'

const appOrigin = requiredHttpsOrigin('MANAGED_VTT_BASE_URL')
const workerOrigin = requiredHttpsOrigin('MANAGED_LIVE_SESSION_ENDPOINT')

const [appResponse, healthResponse] = await Promise.all([
  fetch(appOrigin),
  fetch(`${workerOrigin}/health`)
])

assert.equal(appResponse.status, 200, `Managed app returned ${appResponse.status}.`)
assert.equal(healthResponse.status, 200, `Session Worker returned ${healthResponse.status}.`)
assert.deepEqual(await healthResponse.json(), { ok: true })

const workerWebSocketOrigin = new URL(workerOrigin)
workerWebSocketOrigin.protocol = 'wss:'
const contentSecurityPolicy = appResponse.headers.get('content-security-policy') ?? ''
assert.ok(
  contentSecurityPolicy.includes(workerWebSocketOrigin.origin),
  `Application CSP does not allow ${workerWebSocketOrigin.origin}.`
)

console.info(
  JSON.stringify({
    application: appOrigin,
    applicationCsp: 'verified',
    worker: workerOrigin,
    workerHealth: 'verified'
  })
)

function requiredHttpsOrigin(name) {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} is required.`)
  const url = new URL(value)
  if (url.protocol !== 'https:' || url.origin !== value.replace(/\/$/, '')) {
    throw new Error(`${name} must be an exact HTTPS origin.`)
  }
  return url.origin
}
