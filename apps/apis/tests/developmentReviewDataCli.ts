// Entry for scripts/seedReviewData.mjs: builds the review data through product commands. Local
// (set 0) provisions the review accounts on the Docker deployment; a managed target (REVIEW_SET=N)
// builds tester set N on staging. A managed set's password goes only to file descriptor 3, which the
// script relays to the operator's terminal, never to the log.
import assert from 'node:assert/strict'
import { writeSync } from 'node:fs'
import { api } from '../convex/_generated/api.js'
import { retryRateLimitedAuth } from './developmentAuthRequest'
import { awaitCampaignCheckpoint } from './developmentCheckpoint'
import { developmentCli as cli } from './developmentCli'
import { DevelopmentHttpClient } from './developmentHttpClient'
import { tokenOf } from './developmentReviewAccounts'
import { seedReviewData, type ReviewAccount } from './developmentReviewData'
import { reviewScenariosForSet, type ReviewAccountSpec } from './developmentReviewDataScenarios'
import {
  managedAdminCall,
  reviewRoster,
  reviewTarget,
  reviewTargetSteps
} from './developmentReviewTarget'

const target = reviewTarget(
  process.env,
  process.env.REVIEW_SET ? { set: Number(process.env.REVIEW_SET) } : undefined
)
const roster = reviewRoster(target)

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

const steps = reviewTargetSteps(target, {
  auth,
  adminCall:
    target.mode === 'managed'
      ? managedAdminCall(target)
      : (name, args, component = false) => cli(name, args, component),
  announcePassword: (password) => {
    writeSync(3, `Set ${target.set} password (shown once): ${password}\n`)
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
  const identity = await client.query(api.account.identity, {})
  return { client, userId: identity.userId, username: spec.username }
}

await steps.prepare([
  roster.gm,
  ...roster.players,
  ...(roster.admin ? [roster.admin] : []),
  ...roster.spares
])
const gm = await connect(roster.gm)
const players: ReviewAccount[] = []
for (const spec of roster.players) players.push(await connect(spec))
const admin = roster.admin ? await connect(roster.admin) : undefined
const spares: ReviewAccount[] = []
for (const spec of roster.spares) spares.push(await connect(spec))
const result = await seedReviewData(
  {
    gm,
    players,
    admin,
    spares,
    grantGmTier: steps.grantGmTier,
    grantSuperadmin: steps.grantSuperadmin,
    checkpoint: (campaignId) =>
      awaitCampaignCheckpoint(
        gm.client,
        campaignId,
        target.mode === 'managed' ? target.workerControlSecret : undefined
      ),
    log: (message) => console.log(message)
  },
  reviewScenariosForSet(target.set)
)
console.log(
  `Review data: ${result.created.length} Campaign(s) created, ${result.skipped.length} already finished.`
)
process.exit(0)
