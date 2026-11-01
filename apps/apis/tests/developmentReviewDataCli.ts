// Entry for scripts/seedReviewData.mjs: provisions the review accounts on the selected LOCAL
// deployment and builds the review data through product commands. Public signup is closed, so an
// account is created the way an invitation is redeemed; re-runs sign in to what an earlier run made.
import assert from 'node:assert/strict'
import { createHash, randomBytes } from 'node:crypto'
import { authInvitationRedeemInputSchema } from '@artificer-toolkit/schema/api/auth'
import { api } from '../convex/_generated/api.js'
import { awaitCampaignCheckpoint } from './developmentCheckpoint'
import { developmentCli as cli } from './developmentCli'
import { DevelopmentHttpClient } from './developmentHttpClient'
import { seedReviewData, type ReviewAccount } from './developmentReviewData'
import {
  REVIEW_GM,
  REVIEW_PASSWORD,
  REVIEW_PLAYERS,
  type ReviewAccountSpec
} from './developmentReviewDataScenarios'
import { developmentTarget } from './developmentTarget'

const target = developmentTarget(process.env)
assert.equal(target.mode, 'local', 'Review data is built only on the local Docker backend.')
assert.equal(process.env.CONVEX_DEPLOY_KEY, undefined)

async function auth(path: string, body?: Record<string, unknown>, session?: string) {
  const response = await fetch(new URL(`/api/auth${path}`, target.siteUrl), {
    method: body ? 'POST' : 'GET',
    headers: {
      origin: 'http://localhost:3000',
      'content-type': 'application/json',
      ...(session ? { authorization: `Bearer ${session}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined,
    redirect: 'manual',
    signal: AbortSignal.timeout(30_000)
  })
  return response
}

async function tokenOf(response: Response): Promise<string | null> {
  if (response.status !== 200) return null
  const body: unknown = await response.json()
  const token = typeof body === 'object' && body !== null ? Reflect.get(body, 'token') : null
  return typeof token === 'string' ? token : null
}

async function signIn(spec: ReviewAccountSpec) {
  const email = `${spec.username.toLowerCase()}@example.invalid`
  return tokenOf(await auth('/sign-in/email', { email, password: REVIEW_PASSWORD }))
}

async function redeemInvitation(spec: ReviewAccountSpec) {
  const email = `${spec.username.toLowerCase()}@example.invalid`
  const token = randomBytes(32).toString('hex')
  const redemption = authInvitationRedeemInputSchema.parse({
    email,
    username: spec.username,
    token,
    password: REVIEW_PASSWORD
  })
  await cli('adapter:create', {
    input: {
      model: 'verification',
      data: {
        identifier: `account-invitation:${email}`,
        value: createHash('sha256').update(token).digest('hex'),
        expiresAt: Date.now() + 15 * 60_000,
        createdAt: Date.now(),
        updatedAt: Date.now()
      }
    }
  })
  const response = await auth('/invitation/redeem', redemption)
  assert.equal(response.status, 200, `Review account ${spec.key} could not be created.`)
}

async function connect(
  spec: ReviewAccountSpec
): Promise<ReviewAccount & { client: DevelopmentHttpClient }> {
  let session = await signIn(spec)
  if (!session) {
    await redeemInvitation(spec)
    session = await signIn(spec)
  }
  assert.ok(session, `Review account ${spec.key} could not sign in.`)
  const mintToken = async () => {
    const token = await tokenOf(await auth('/convex/token', undefined, session))
    assert.ok(token, `Review account ${spec.key} could not mint a token.`)
    return token
  }
  const client = new DevelopmentHttpClient(target.deploymentUrl.origin, { logger: false })
  client.setAuth(await mintToken(), mintToken)
  const identity = await client.query(api.account.identity, {})
  return { client, userId: identity.userId, username: spec.username }
}

const gm = await connect(REVIEW_GM)
// One at a time: the auth endpoints rate-limit bursts.
const players: ReviewAccount[] = []
for (const spec of REVIEW_PLAYERS) players.push(await connect(spec))
const result = await seedReviewData({
  gm,
  players,
  grantGmTier: (userId) =>
    cli('accountEntitlements:setTier', { userId, tier: 'GM' }, false).then(() => {}),
  checkpoint: (campaignId) => awaitCampaignCheckpoint(gm.client, campaignId),
  log: (message) => console.log(message)
})
console.log(
  `Review data: ${result.created.length} Campaign(s) created, ${result.skipped.length} already finished.`
)
process.exit(0)
