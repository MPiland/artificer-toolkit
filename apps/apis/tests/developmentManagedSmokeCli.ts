// Entry for scripts/managedSmoke.mjs `run`: the bounded managed (staging) smoke. It creates one
// disposable account through the product's invitation redemption, signs in through the web Worker,
// walks the signed-in pages for the requested rounds recording each response's cf-ray (the key that
// joins it to Workers Logs CPU rows), and removes the account through the product's own account
// deletion. It never resets, reseeds or patches the deployment. The password lives in memory only.
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { resolveSmokeTarget } from '../../../scripts/managedSmokePolicy.mjs'
import { signedInPaths } from '../../web/tests/live-backend/signedInRequestAudit'
import { retryRateLimitedAuth } from './developmentAuthRequest'
import { reviewAccountSession } from './developmentReviewAccounts'
import { managedAdminCall } from './developmentReviewTarget'

const requestsPath = process.env.SMOKE_REQUESTS_PATH
assert.ok(requestsPath, 'SMOKE_REQUESTS_PATH is required.')
const target = resolveSmokeTarget(
  {
    webOrigin: process.env.SMOKE_WEB_ORIGIN,
    rounds: Number(process.env.SMOKE_ROUNDS),
    idleMinutes: Number(process.env.SMOKE_IDLE_MINUTES)
  },
  process.env
)
const systemId = process.env.SMOKE_SYSTEM_ID
const deploymentUrl = new URL(process.env.CONVEX_URL!)
const siteUrl = new URL(process.env.CONVEX_SITE_URL!)
const adminCall = managedAdminCall({
  deploymentUrl,
  adminKey: process.env.REVIEW_MANAGED_ADMIN_KEY!
})

const runId = Date.now().toString(36)
const [mailboxName, mailboxDomain] = process.env.REVIEW_MAILBOX!.split('@')
const email = `${mailboxName}+smoke-${runId}@${mailboxDomain}`
const username = `smoke_${runId}`
const password = randomBytes(18).toString('base64url')

const authAt = (origin: string) =>
  retryRateLimitedAuth((path, body, session) =>
    fetch(new URL(`/api/auth${path}`, origin), {
      method: body ? 'POST' : 'GET',
      headers: {
        origin: target.webOrigin,
        'content-type': 'application/json',
        ...(session ? { authorization: `Bearer ${session}` } : {})
      },
      body: body ? JSON.stringify(body) : undefined,
      redirect: 'manual',
      signal: AbortSignal.timeout(30_000)
    })
  )

async function userExists() {
  const user = await adminCall(
    'adapter:findOne',
    { model: 'user', where: [{ field: 'email', value: email }] },
    true
  )
  return typeof user === 'object' && user !== null
}

const requests: unknown[] = []
let cookie = ''
let created = false
let failure: unknown
try {
  await reviewAccountSession(
    { key: 'smoke', username, email },
    authAt(siteUrl.origin),
    (data) => adminCall('adapter:create', { input: { model: 'verification', data } }, true),
    password
  )
  created = true

  const signIn = await authAt(target.webOrigin)('/sign-in/email', { email, password })
  assert.equal(signIn.status, 200, `Web sign-in answered ${signIn.status}.`)
  cookie = signIn.headers
    .getSetCookie()
    .map((entry) => entry.split(';')[0])
    .join('; ')
  assert.ok(cookie, 'Web sign-in set no session cookie.')

  const paths = signedInPaths(systemId ?? '').filter((path) => systemId || path !== '/systems/')
  for (let round = 0; round < target.rounds; round++) {
    if (round > 0) await delay(target.idleMinutes * 60_000)
    for (const [index, path] of paths.entries()) {
      const startedAt = Date.now()
      const response = await fetch(new URL(path, target.webOrigin), {
        headers: { accept: 'text/html', cookie },
        redirect: 'manual',
        signal: AbortSignal.timeout(30_000)
      })
      await response.arrayBuffer()
      const cfRay = response.headers.get('cf-ray')
      assert.ok(cfRay, `${path} answered without a cf-ray; this is not a Cloudflare response.`)
      requests.push({
        path,
        round,
        // Only the first request after a deploy (round 0) or an idle gap can find a cold isolate.
        cold: index === 0,
        status: response.status,
        cacheControl: response.headers.get('cache-control'),
        cfRay,
        wallMs: Date.now() - startedAt,
        at: new Date(startedAt).toISOString()
      })
    }
  }
} catch (error) {
  failure = error
} finally {
  let cleanup = 'not-needed'
  if (created) {
    cleanup = 'unverified'
    try {
      const response = await fetch(new URL('/api/auth/account/delete', target.webOrigin), {
        method: 'POST',
        headers: { origin: target.webOrigin, 'content-type': 'application/json', cookie },
        body: JSON.stringify({ email, currentPassword: password }),
        signal: AbortSignal.timeout(30_000)
      })
      if (response.status === 200) {
        for (let attempt = 0; attempt < 30; attempt++) {
          if (!(await userExists())) {
            cleanup = 'deleted'
            break
          }
          await delay(2000)
        }
      }
    } catch {
      cleanup = 'unverified'
    }
  }
  await mkdir(dirname(requestsPath), { recursive: true })
  await writeFile(
    requestsPath,
    `${JSON.stringify({ runId, webOrigin: target.webOrigin, convex: target.convexSlug, fixtureEmail: email, cleanup, requests }, null, 2)}\n`
  )
  console.log(`Smoke ${runId}: ${requests.length} request(s), fixture cleanup ${cleanup}.`)
  if (cleanup === 'unverified')
    console.error(`Remove fixture ${email} through accountDeletion:schedule before finishing.`)
  if (failure || cleanup === 'unverified') {
    console.error(failure instanceof Error ? failure.message : 'Fixture cleanup is unverified.')
    process.exitCode = 1
  }
}
