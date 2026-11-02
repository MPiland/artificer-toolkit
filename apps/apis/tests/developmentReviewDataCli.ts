// Entry for scripts/seedReviewData.mjs: provisions the review accounts on the selected LOCAL
// deployment and builds the review data through product commands.
import assert from 'node:assert/strict'
import { api } from '../convex/_generated/api.js'
import { retryRateLimitedAuth } from './developmentAuthRequest'
import { awaitCampaignCheckpoint } from './developmentCheckpoint'
import { developmentCli as cli } from './developmentCli'
import { DevelopmentHttpClient } from './developmentHttpClient'
import { reviewAccountSession, tokenOf } from './developmentReviewAccounts'
import { seedReviewData, type ReviewAccount } from './developmentReviewData'
import {
  REVIEW_ADMIN,
  REVIEW_GM,
  REVIEW_PLAYERS,
  REVIEW_SPARES,
  type ReviewAccountSpec
} from './developmentReviewDataScenarios'
import { developmentTarget } from './developmentTarget'

const target = developmentTarget(process.env)
assert.equal(target.mode, 'local', 'Review data is built only on the local Docker backend.')
assert.equal(process.env.CONVEX_DEPLOY_KEY, undefined)

// Better Auth allows three sign-ins per ten seconds per client IP, and every review account signs in.
const auth = retryRateLimitedAuth((path, body, session) =>
  fetch(new URL(`/api/auth${path}`, target.siteUrl), {
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
)

async function connect(
  spec: ReviewAccountSpec
): Promise<ReviewAccount & { client: DevelopmentHttpClient }> {
  const session = await reviewAccountSession(spec, auth, (data) =>
    cli('adapter:create', { input: { model: 'verification', data } })
  )
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
const players: ReviewAccount[] = []
for (const spec of REVIEW_PLAYERS) players.push(await connect(spec))
const admin = await connect(REVIEW_ADMIN)
const spares: ReviewAccount[] = []
for (const spec of REVIEW_SPARES) spares.push(await connect(spec))
const result = await seedReviewData({
  gm,
  players,
  admin,
  spares,
  grantGmTier: (userId) =>
    cli('accountEntitlements:setTier', { userId, tier: 'GM' }, false).then(() => {}),
  grantSuperadmin: (userId) =>
    cli('authAdmin:setRole', { userId, role: 'superadmin' }, false).then(() => {}),
  checkpoint: (campaignId) => awaitCampaignCheckpoint(gm.client, campaignId),
  log: (message) => console.log(message)
})
console.log(
  `Review data: ${result.created.length} Campaign(s) created, ${result.skipped.length} already finished.`
)
process.exit(0)
