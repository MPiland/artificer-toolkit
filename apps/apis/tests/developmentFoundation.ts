import assert from 'node:assert/strict'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '../convex/_generated/api.js'
import { developmentTarget } from './developmentTarget'

const { mode, selector, deploymentUrl, siteUrl } = developmentTarget(process.env)
const client = new ConvexHttpClient(deploymentUrl.origin)
const flags = await client.query(api.application.featureFlags, {})
assert.equal(flags.publicSignUpEnabled, false, 'This check requires signup to remain closed.')
await assert.rejects(client.query(api.account.identity, {}), /Unauthenticated/)
assert.deepEqual(await client.query(api.account.session, {}), {
  user: null,
  featureFlags: flags,
  isSuperAdmin: false
})

const response = await fetch(new URL('/api/auth/sign-up/email', siteUrl), {
  method: 'POST',
  headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' },
  body: JSON.stringify({
    name: 'Closed signup probe',
    username: 'Closed_signup_probe',
    email: 'closed-signup-probe@example.invalid',
    password: 'Local-only-closed-signup-probe'
  })
})
assert.equal(response.status, 400)
assert.deepEqual(await response.json(), {
  code: 'EMAIL_PASSWORD_SIGN_UP_DISABLED',
  message: 'Email and password sign up is not enabled'
})

console.log(
  JSON.stringify({
    target: { mode, selector },
    publicQuery: 'PASS',
    anonymousSessionProjection: 'PASS',
    anonymousIdentityDenied: 'PASS',
    httpSignupDenied: 'PASS'
  })
)
