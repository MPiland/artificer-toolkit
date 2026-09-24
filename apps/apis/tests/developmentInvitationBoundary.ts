import assert from 'node:assert/strict'
import { ConvexHttpClient } from 'convex/browser'
import { makeFunctionReference } from 'convex/server'
import { developmentTarget } from './developmentTarget'

const target = developmentTarget(process.env)
const client = new ConvexHttpClient(target.deploymentUrl.origin)
const input = {
  email: 'unissued-invitation@example.invalid',
  token: '0'.repeat(64),
  username: 'UnissuedInvite',
  password: 'unissued-invitation-password'
}
await assert.rejects(
  client.action(makeFunctionReference<'action'>('authInvitationsCli:invite'), {
    email: input.email
  }),
  /public function/i
)
for (const name of ['issue', 'redeem']) {
  await assert.rejects(
    client.mutation(makeFunctionReference<'mutation'>(`authInvitations:${name}`), input),
    /public function/i
  )
}
const endpoint = new URL('/api/auth/invitation/redeem', target.siteUrl)
for (const cookie of [false, true]) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: 'https://untrusted.example.invalid',
      'sec-fetch-site': 'cross-site',
      'sec-fetch-mode': 'cors',
      ...(cookie ? { cookie: 'unrelated=browser-cookie' } : {})
    },
    body: JSON.stringify(input)
  })
  assert.equal(response.status, 403, `Foreign browser origin (cookie=${cookie})`)
  assert.equal(response.headers.get('set-cookie'), null)
}
const invalid = await fetch(endpoint, {
  method: 'POST',
  headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' },
  body: JSON.stringify(input)
})
assert.equal(invalid.status, 400)
assert.equal(invalid.headers.get('set-cookie'), null)
assert.deepEqual(await invalid.json(), {
  message: 'Invitation is invalid or expired, or the username is unavailable.'
})
console.log(
  JSON.stringify({
    target: target.selector,
    internalOnly: 'PASS',
    foreignBrowserOrigins: 'PASS',
    invalidRedemption: 'PASS',
    noSessionCookie: 'PASS'
  })
)
