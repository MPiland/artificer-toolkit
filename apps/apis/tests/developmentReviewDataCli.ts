// Entry for scripts/seedReviewData.mjs: builds the review data through product commands. On the
// local Docker deployment it provisions the review accounts; on a managed (staging) target it binds
// the invited accounts of REVIEW_ROLE_MAP_PATH and creates nothing.
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { api } from '../convex/_generated/api.js'
import { retryRateLimitedAuth } from './developmentAuthRequest'
import { awaitCampaignCheckpoint } from './developmentCheckpoint'
import { developmentCli as cli } from './developmentCli'
import { DevelopmentHttpClient } from './developmentHttpClient'
import { tokenOf } from './developmentReviewAccounts'
import { seedReviewData, type ReviewAccount } from './developmentReviewData'
import {
  REVIEW_ADMIN,
  REVIEW_GM,
  REVIEW_PLAYERS,
  REVIEW_SPARES,
  type ReviewAccountSpec
} from './developmentReviewDataScenarios'
import { assertLocalOnlyStep, reviewTarget, reviewTargetSteps } from './developmentReviewTarget'

const roleMapPath = process.env.REVIEW_ROLE_MAP_PATH
const target = reviewTarget(
  process.env,
  roleMapPath ? { roleMap: JSON.parse(await readFile(roleMapPath, 'utf8')) as unknown } : undefined
)

// Better Auth allows three sign-ins per ten seconds per client IP, and every review account signs in.
const auth = retryRateLimitedAuth((path, body, session) =>
  fetch(new URL(`/api/auth${path}`, target.siteUrl), {
    method: body ? 'POST' : 'GET',
    headers: {
      origin: process.env.REVIEW_WEB_ORIGIN ?? 'http://localhost:3000',
      'content-type': 'application/json',
      ...(session ? { authorization: `Bearer ${session}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined,
    redirect: 'manual',
    signal: AbortSignal.timeout(30_000)
  })
)

const clients = new Map<string, DevelopmentHttpClient>()
const steps = reviewTargetSteps(target, {
  auth,
  issueInvitation: (data) => {
    assertLocalOnlyStep(target, 'Issuing an invitation')
    return cli('adapter:create', { input: { model: 'verification', data } })
  },
  adminCall: (name, args) => {
    assertLocalOnlyStep(target, 'A deployment-admin call')
    return cli(name, args, false)
  },
  verify: {
    tier: async (spec) => {
      const entitlements = await clients.get(spec.key)!.query(api.accountEntitlements.get, {})
      return entitlements.tier
    },
    role: async (spec) => (await clients.get(spec.key)!.query(api.account.identity, {})).role
  }
})

async function connect(
  spec: ReviewAccountSpec
): Promise<ReviewAccount & { client: DevelopmentHttpClient }> {
  const session = await steps.session(spec)
  const mintToken = async () => {
    const token = await tokenOf(await auth('/convex/token', undefined, session))
    assert.ok(token, `Review account ${spec.key} could not mint a token.`)
    return token
  }
  const client = new DevelopmentHttpClient(target.deploymentUrl.origin, { logger: false })
  client.setAuth(await mintToken(), mintToken)
  clients.set(spec.key, client)
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
  grantGmTier: (userId) => steps.grantGmTier(userId, REVIEW_GM),
  grantSuperadmin: (userId) => steps.grantSuperadmin(userId, REVIEW_ADMIN),
  checkpoint: (campaignId) =>
    awaitCampaignCheckpoint(
      gm.client,
      campaignId,
      target.mode === 'managed' ? target.workerControlSecret : undefined
    ),
  log: (message) => console.log(message)
})
console.log(
  `Review data: ${result.created.length} Campaign(s) created, ${result.skipped.length} already finished.`
)
process.exit(0)
