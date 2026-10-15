import assert from 'node:assert/strict'
import { EventEmitter, on } from 'node:events'
import { createServer } from 'node:http'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '../convex/_generated/api.js'
import { generateValidUsername } from './fixtures/generatedUsername'

function localUrl(value: string | undefined): URL {
  assert.ok(value, 'Load the isolated local Convex environment.')
  const url = new URL(value)
  assert.equal(url.protocol, 'http:')
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(url.hostname), 'Local endpoints only.')
  return url
}

const deployment = localUrl(process.env.CONVEX_URL)
const site = localUrl(process.env.CONVEX_SITE_URL)
const appOrigin = 'http://localhost:3000'
const messages: Array<{ to: string; subject: string; text: string; html: string }> = []
const mailbox = new EventEmitter()
const server = createServer(async (request, response) => {
  try {
    assert.equal(request.method, 'POST')
    assert.equal(request.url, '/email')
    const chunks: Buffer[] = []
    let size = 0
    for await (const chunk of request) {
      const buffer = Buffer.from(chunk)
      size += buffer.length
      assert.ok(size <= 256 * 1024, 'Email exceeds local sink limit.')
      chunks.push(buffer)
    }
    const value: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'))
    assert.ok(value && typeof value === 'object')
    assert.ok('to' in value && typeof value.to === 'string')
    assert.ok('subject' in value && typeof value.subject === 'string')
    assert.ok('text' in value && typeof value.text === 'string')
    assert.ok('html' in value && typeof value.html === 'string')
    assert.ok(messages.length < 20, 'Unexpected email volume.')
    const message = { to: value.to, subject: value.subject, text: value.text, html: value.html }
    messages.push(message)
    mailbox.emit('message', message)
    response.writeHead(204).end()
  } catch {
    response.writeHead(400).end()
  }
})

async function waitForEmail(to: string, subject: string, fromIndex = 0) {
  const existing = messages
    .slice(fromIndex)
    .find((message) => message.to === to && message.subject.includes(subject))
  if (existing) return existing
  for await (const [message] of on(mailbox, 'message', { signal: AbortSignal.timeout(30_000) })) {
    // The sink validates every message before emitting it; search that validated collection.
    const found = messages
      .slice(fromIndex)
      .find((entry) => entry === message && entry.to === to && entry.subject.includes(subject))
    if (found) return found
  }
  throw new Error('Expected local email was not delivered.')
}

async function auth(path: string, body?: Record<string, unknown>, token?: string) {
  return await fetch(new URL(`/api/auth${path}`, site), {
    method: body ? 'POST' : 'GET',
    headers: {
      origin: appOrigin,
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined,
    redirect: 'manual',
    signal: AbortSignal.timeout(30_000)
  })
}

async function sessionToken(response: Response): Promise<string> {
  assert.equal(response.status, 200, 'Authentication must succeed.')
  const value: unknown = await response.json()
  assert.ok(
    value && typeof value === 'object' && 'token' in value && typeof value.token === 'string'
  )
  return value.token
}

async function authenticatedClient(session: string) {
  const jwt = await sessionToken(await auth('/convex/token', undefined, session))
  const claims: unknown = JSON.parse(Buffer.from(jwt.split('.')[1]!, 'base64url').toString('utf8'))
  assert.ok(claims && typeof claims === 'object')
  assert.ok(
    !('email' in claims) && !('name' in claims),
    'JWTs must not carry unnecessary profile data.'
  )
  const client = new ConvexHttpClient(deployment.origin)
  client.setAuth(jwt)
  return client
}

await new Promise<void>((resolve, reject) => {
  server.once('error', reject)
  server.listen(3222, '127.0.0.1', resolve)
})

try {
  const publicClient = new ConvexHttpClient(deployment.origin)
  assert.equal(
    (await publicClient.query(api.application.featureFlags, {})).publicSignUpEnabled,
    true
  )
  const { username, suffix } = generateValidUsername('Auth_')
  const email = `auth-${suffix}@example.invalid`
  const password = 'Local-proof-password-8175!'
  const replacementPassword = 'Local-replacement-password-8296!'
  const signup = { email, name: 'Local auth proof', username: ` ${username} `, password }

  assert.equal((await auth('/sign-up/email', { ...signup, username: '_invalid' })).status, 400)
  const registration = await auth('/sign-up/email', signup)
  assert.equal(
    registration.status,
    200,
    'Verified signup registration must be available when enabled.'
  )
  const initial: unknown = await registration.json()
  assert.ok(initial && typeof initial === 'object' && 'token' in initial && initial.token === null)
  assert.equal((await auth('/sign-in/email', { email, password })).status, 403)
  assert.equal(
    (
      await auth('/sign-up/email', {
        ...signup,
        email: `duplicate-${suffix}@example.invalid`,
        username: username.toUpperCase()
      })
    ).status,
    400,
    'Username uniqueness must be case-insensitive.'
  )
  assert.equal((await auth('/sign-in/email-otp', { email, otp: '123456' })).status, 404)

  const verification = await waitForEmail(email, 'Confirm')
  assert.match(verification.html, /Artificer Toolkit/)
  const link = verification.text.match(/Confirm email: (\S+)/)?.[1]
  assert.ok(link, 'React Email text must include the verification link.')
  const verificationUrl = new URL(link)
  assert.equal(verificationUrl.origin, appOrigin)
  // Production uses the SSR proxy. This backend-only proof calls its same auth route locally.
  const verified = await fetch(new URL(verificationUrl.pathname + verificationUrl.search, site), {
    redirect: 'manual',
    signal: AbortSignal.timeout(30_000)
  })
  assert.ok(verified.status >= 200 && verified.status < 400, 'Email verification must succeed.')

  const session = await sessionToken(await auth('/sign-in/email', { email, password }))
  const client = await authenticatedClient(session)
  const identity = await client.query(api.account.identity, {})
  assert.match(
    identity.userId,
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  )
  assert.equal(identity.role, 'user')
  const snapshot = await client.query(api.account.session, {})
  assert.equal(snapshot.user?.userId, identity.userId)
  assert.equal(snapshot.user.email, email)
  assert.equal(snapshot.user.registrationCompleted, true)
  assert.equal(snapshot.user.authoringExperience, 'guided')
  assert.equal(snapshot.isSuperAdmin, false)
  await client.mutation(api.account.setAuthoringExperience, { experience: 'advanced' })
  assert.equal((await client.query(api.account.session, {})).user?.authoringExperience, 'advanced')
  const usernameSession = await sessionToken(
    await auth('/sign-in/username', {
      username: username.toUpperCase(),
      password
    })
  )
  const usernameClient = await authenticatedClient(usernameSession)
  assert.deepEqual(await usernameClient.query(api.account.identity, {}), identity)

  assert.equal((await auth('/email-otp/request-password-reset', { email })).status, 200)
  await waitForEmail(email, 'Reset')
  const beforeResend = messages.length
  assert.equal((await auth('/email-otp/request-password-reset', { email })).status, 200)
  const recovery = await waitForEmail(email, 'Reset', beforeResend)
  const otp = recovery.text.match(/Verification code: (\d{6})/)?.[1]
  assert.ok(otp, 'Recovery must deliver the existing six-digit code template.')
  const wrongOtp = `${(Number(otp[0]) + 1) % 10}${otp.slice(1)}`
  assert.equal(
    (
      await auth('/email-otp/check-verification-otp', {
        email,
        otp: wrongOtp,
        type: 'forget-password'
      })
    ).status,
    400
  )
  const concurrentResets = await Promise.all([
    auth('/email-otp/reset-password', { email, otp, password: replacementPassword }),
    auth('/email-otp/reset-password', { email, otp, password: replacementPassword })
  ])
  assert.deepEqual(
    concurrentResets.map((response) => response.status).sort(),
    [200, 400],
    'Exactly one simultaneous reset may consume the current code.'
  )
  await assert.rejects(client.query(api.account.identity, {}), /Unauthenticated/)
  await assert.rejects(usernameClient.query(api.account.identity, {}), /Unauthenticated/)
  assert.equal((await auth('/sign-in/email', { email, password })).status, 401)
  assert.equal((await auth('/email-otp/reset-password', { email, otp, password })).status, 400)

  const replacementSession = await sessionToken(
    await auth('/sign-in/username', {
      username,
      password: replacementPassword
    })
  )
  const replacementClient = await authenticatedClient(replacementSession)
  assert.deepEqual(await replacementClient.query(api.account.identity, {}), identity)
  assert.equal((await auth('/sign-out', {}, replacementSession)).status, 200)
  await assert.rejects(replacementClient.query(api.account.identity, {}), /Unauthenticated/)

  const unknownEmail = `unknown-${suffix}@example.invalid`
  const hostile = await fetch(new URL('/api/auth/email-otp/request-password-reset', site), {
    method: 'POST',
    headers: {
      origin: 'https://hostile.invalid',
      'content-type': 'application/json',
      cookie: 'better-auth.session_token=invalid-csrf-probe'
    },
    body: JSON.stringify({ email: unknownEmail }),
    signal: AbortSignal.timeout(30_000)
  })
  assert.equal(hostile.status, 403, 'Cookie-bearing recovery must reject hostile browser origins.')
  // The burst must hit the limit regardless of earlier requests or their timing.
  const rateStatuses: number[] = []
  for (let attempt = 0; attempt < 4; attempt++) {
    const response = await fetch(new URL('/api/auth/email-otp/request-password-reset', site), {
      method: 'POST',
      headers: {
        origin: appOrigin,
        'content-type': 'application/json',
        'x-forwarded-for': `198.51.100.${attempt + 1}`,
        'x-artificer-client-ip': `203.0.113.${attempt + 1}`
      },
      body: JSON.stringify({ email: unknownEmail }),
      signal: AbortSignal.timeout(30_000)
    })
    rateStatuses.push(response.status)
  }
  assert.equal(
    rateStatuses.at(-1),
    429,
    'Recovery must be throttled even when client-supplied IP headers change.'
  )
  const concurrentRequests = await Promise.all(
    Array.from({ length: 4 }, (_, index) =>
      fetch(new URL('/api/auth/email-otp/request-password-reset', site), {
        method: 'POST',
        headers: {
          origin: appOrigin,
          'content-type': 'application/json',
          'x-forwarded-for': `198.51.100.${index + 100}`
        },
        body: JSON.stringify({ email: `concurrent-${suffix}@example.invalid` }),
        signal: AbortSignal.timeout(30_000)
      })
    )
  )
  assert.deepEqual(
    concurrentRequests.map((response) => response.status).sort(),
    [200, 200, 200, 429],
    'Concurrent resends must share one atomic account quota.'
  )

  console.log(
    JSON.stringify({
      localOnly: true,
      externalEmailCalls: 0,
      verification: 'PASS',
      emailAndUsernameLogin: 'PASS',
      nativeBearerJwt: 'PASS',
      sessionProjectionAndPreference: 'PASS',
      recovery: 'PASS',
      revokedSessions: 'PASS',
      otpReplayDenied: 'PASS',
      simultaneousReset: 'PASS',
      recoveryRateLimit: 'PASS',
      concurrentResendLimit: 'PASS',
      hostileOriginDenied: 'PASS',
      signupBypassDenied: 'PASS',
      messages: messages.length
    })
  )
} finally {
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve()))
  )
}
