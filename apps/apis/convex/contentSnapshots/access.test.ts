import { makeFunctionReference } from 'convex/server'
import { afterEach, expect, it, vi } from 'vitest'
import type {
  CampaignDetailDto,
  CreateCampaignInput
} from '@artificer-toolkit/schema/api/campaignCore'
import {
  CONTENT_SNAPSHOT_TOKEN_TTL_SECONDS,
  type ContentSnapshotAccessDto
} from '@artificer-toolkit/schema/api/contentSnapshots'
import { SRD_RULES_CATALOGUE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { verifyContentSnapshotToken } from '../../../session-worker/src/contentToken'
import { fixture } from '../../tests/fixtures/characters'
import { requireDefaultUserContentSource } from '../content/sources'

// ADR 0036 S3: the token names only the caller's own USER sources and active Campaigns.

const issueAccess = makeFunctionReference<
  'action',
  Record<string, never>,
  ContentSnapshotAccessDto
>('contentSnapshots/access:issueAccess')
const createCampaign = makeFunctionReference<'mutation', CreateCampaignInput, CampaignDetailDto>(
  'campaigns/create:create'
)
const secret = 'content-snapshot-token-secret-at-least-32-bytes'

afterEach(() => vi.unstubAllEnvs())

async function setup() {
  vi.stubEnv('CONTENT_SNAPSHOT_TOKEN_SECRET', secret)
  const base = await fixture()
  const { t, owner, other } = base
  const [ownSourceId, otherSourceId] = await Promise.all(
    [owner, other].map((actor) =>
      t.run((ctx) => requireDefaultUserContentSource(ctx, srdSystemRecord.id, actor.userId))
    )
  )
  const campaign = await other.caller.mutation(createCampaign, {
    name: 'Content access',
    format: 'ONGOING',
    toneTags: ['HEROIC'],
    contentMaturity: 'STANDARD',
    gameSystemId: srdSystemRecord.id,
    primaryRulesCatalogueId: SRD_RULES_CATALOGUE.id
  })
  const membershipId = await t.run((ctx) =>
    ctx.db.insert('campaignMemberships', {
      campaignId: campaign.id,
      userId: owner.userId,
      role: 'PLAYER',
      status: 'ACTIVE',
      accessStartedAt: campaign.createdAt,
      joinedAt: campaign.createdAt,
      leftAt: null
    })
  )
  const claimsOf = async (caller: typeof owner.caller) =>
    verifyContentSnapshotToken((await caller.action(issueAccess, {})).token, secret)
  return { ...base, ownSourceId, otherSourceId, campaign, membershipId, claimsOf }
}

it('issues a 10-minute HS256 content token naming own USER sources and active Campaigns', async () => {
  const { owner, other, ownSourceId, otherSourceId, campaign, claimsOf } = await setup()
  const issued = await owner.caller.action(issueAccess, {})
  const claims = await verifyContentSnapshotToken(issued.token, secret)
  expect(claims).toMatchObject({
    sub: owner.userId,
    userSourceIds: [ownSourceId],
    campaignIds: [campaign.id]
  })
  expect(claims.exp - claims.iat).toBe(CONTENT_SNAPSHOT_TOKEN_TTL_SECONDS)
  expect(issued.expiresAt).toBe(new Date(claims.exp * 1_000).toISOString())
  // Another user's USER source is never named; the owner's Campaign is.
  expect(claims.userSourceIds).not.toContain(otherSourceId)
  expect(await claimsOf(other.caller)).toMatchObject({
    sub: other.userId,
    userSourceIds: [otherSourceId],
    campaignIds: [campaign.id]
  })
}, 30_000)

it('drops a departed or deleting Campaign from the next token', async () => {
  const { t, owner, other, campaign, membershipId, claimsOf } = await setup()
  await t.run((ctx) =>
    ctx.db.patch(membershipId, { status: 'LEFT', leftAt: new Date().toISOString() })
  )
  expect((await claimsOf(owner.caller)).campaignIds).toEqual([])

  await t.run(async (ctx) => {
    const root = await ctx.db
      .query('campaigns')
      .withIndex('by_publicId', (q) => q.eq('id', campaign.id))
      .unique()
    if (!root) throw new Error('Missing Campaign.')
    const now = new Date().toISOString()
    await ctx.db.insert('campaignDeletionJobs', {
      campaignRootId: root._id,
      campaignId: campaign.id,
      ownerUserId: other.userId,
      expectedVersion: campaign.version,
      stage: 'DRAIN_ROOM',
      liveAuthority: null,
      phase: 0,
      revision: 0,
      status: 'DELETING',
      error: null,
      createdAt: now,
      updatedAt: now
    })
  })
  expect((await claimsOf(other.caller)).campaignIds).toEqual([])
}, 30_000)

it('refuses anonymous callers and a missing or short secret', async () => {
  const { t, owner } = await setup()
  await expect(t.action(issueAccess, {})).rejects.toThrow('Unauthenticated')
  for (const value of ['', 'short-secret']) {
    vi.stubEnv('CONTENT_SNAPSHOT_TOKEN_SECRET', value)
    await expect(owner.caller.action(issueAccess, {})).rejects.toThrow(
      'CONTENT_SNAPSHOT_TOKEN_SECRET must contain at least 32 bytes.'
    )
  }
}, 30_000)
