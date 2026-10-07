import { ConvexError } from 'convex/values'
import { makeFunctionReference } from 'convex/server'
import { afterEach, expect, it, vi } from 'vitest'
import { domainRejectionErrorDataSchema } from '@artificer-toolkit/schema/api/domainRejections'
import {
  LIVE_SESSION_TICKET_VERSION,
  LIVE_SESSION_TICKET_TTL_SECONDS,
  type LiveSessionJoinOptionsDto,
  type LiveSessionTicketDto
} from '@artificer-toolkit/schema/api/liveSessionIdentity'
import type {
  CampaignDetailDto,
  CreateCampaignInput
} from '@artificer-toolkit/schema/api/campaignCore'
import { verifyLiveSessionTicket } from '../../../session-worker/src/ticket'
import { createEncounterSceneFixture } from '../../tests/fixtures/encounterScene'

const issue = makeFunctionReference<'action', LiveSessionJoinOptionsDto, LiveSessionTicketDto>(
  'liveSessions/tickets:issue'
)
const createCampaign = makeFunctionReference<'mutation', CreateCampaignInput, CampaignDetailDto>(
  'campaigns/create:create'
)
const secret = 'native-live-session-ticket-secret-at-least-32-bytes'

afterEach(() => vi.unstubAllEnvs())

it('issues HS256 60-second tickets for active owner and player admissions', async () => {
  vi.stubEnv('LIVE_SESSION_TICKET_SECRET', secret)
  const base = await createEncounterSceneFixture()
  const input: LiveSessionJoinOptionsDto = { campaignId: base.campaign.id }
  const [owner, player] = await Promise.all([
    base.other.caller.action(issue, input),
    base.owner.caller.action(issue, input)
  ])
  const authorityEpochs: string[] = []
  for (const [ticket, userId, role, caller] of [
    [owner, base.other.userId, 'OWNER', base.other.caller],
    [player, base.owner.userId, 'PLAYER', base.owner.caller]
  ] as const) {
    const claims = await verifyLiveSessionTicket(ticket.ticket, secret)
    // The Better Auth subject is read from the authenticated identity, and is not the app user id.
    const subject = await caller.run(async (ctx) => (await ctx.auth.getUserIdentity())?.subject)
    expect(subject).toBeTruthy()
    expect(claims.authSubject).toBe(subject)
    expect(claims.authSubject).not.toBe(userId)
    expect(claims).toMatchObject({
      authorityEpoch: expect.stringMatching(/^[0-9a-f-]{36}$/),
      campaignId: input.campaignId,
      role,
      sub: userId,
      v: LIVE_SESSION_TICKET_VERSION
    })
    authorityEpochs.push(claims.authorityEpoch)
    expect(claims.exp - claims.iat).toBe(LIVE_SESSION_TICKET_TTL_SECONDS)
    expect(ticket.expiresAt).toBe(new Date(claims.exp * 1_000).toISOString())
    const authority = await base.t.run((ctx) =>
      ctx.db
        .query('campaignLiveAuthorities')
        .withIndex('by_campaignId', (q) => q.eq('campaignId', input.campaignId))
        .unique()
    )
    expect(authority?.activationExpiresAt).toBeGreaterThanOrEqual(claims.exp * 1_000)
  }
  expect(new Set(authorityEpochs).size).toBe(1)
}, 15_000)

it('denies unauthenticated, nonmember, archived, and cross-Campaign ticket requests', async () => {
  vi.stubEnv('LIVE_SESSION_TICKET_SECRET', secret)
  const base = await createEncounterSceneFixture()
  const input: LiveSessionJoinOptionsDto = { campaignId: base.campaign.id }
  await expect(base.t.action(issue, input)).rejects.toThrow('Unauthenticated')
  await base.t.run(async (ctx) => {
    const member = await ctx.db
      .query('campaignMemberships')
      .withIndex('by_campaignId_userId', (q) =>
        q.eq('campaignId', base.campaign.id).eq('userId', base.owner.userId)
      )
      .unique()
    if (!member) throw new Error('Missing player membership.')
    await ctx.db.patch(member._id, { leftAt: new Date().toISOString(), status: 'LEFT' })
  })
  await expect(base.owner.caller.action(issue, input)).rejects.toThrow('Campaign not found')

  const archived = await createEncounterSceneFixture()
  await archived.t.run(async (ctx) => {
    const campaign = await ctx.db
      .query('campaigns')
      .withIndex('by_publicId', (q) => q.eq('id', archived.campaign.id))
      .unique()
    if (!campaign) throw new Error('Missing Campaign.')
    await ctx.db.patch(campaign._id, { status: 'ARCHIVED' })
  })
  await expect(
    archived.other.caller.action(issue, { campaignId: archived.campaign.id })
  ).rejects.toThrow('read-only')

  const foreignCampaign = await base.owner.caller.mutation(createCampaign, {
    name: 'Foreign Campaign',
    format: 'ONGOING',
    toneTags: ['HEROIC'],
    contentMaturity: 'STANDARD',
    gameSystemId: base.campaign.gameSystemId,
    primaryRulesCatalogueId: base.campaign.primaryRulesCatalogueId
  })
  await expect(base.other.caller.action(issue, { campaignId: foreignCampaign.id })).rejects.toThrow(
    'Campaign not found'
  )
})

it('refuses a departed member and an archived Campaign with user-safe ConvexError data', async () => {
  vi.stubEnv('LIVE_SESSION_TICKET_SECRET', secret)
  const refusal = async (promise: Promise<unknown>) => {
    const error: unknown = await promise.then(
      () => null,
      (rejected: unknown) => rejected
    )
    if (!(error instanceof ConvexError)) throw new Error('Expected a ConvexError refusal.')
    return domainRejectionErrorDataSchema.parse(error.data)
  }
  const departed = await createEncounterSceneFixture()
  await departed.t.run(async (ctx) => {
    const member = await ctx.db
      .query('campaignMemberships')
      .withIndex('by_campaignId_userId', (q) =>
        q.eq('campaignId', departed.campaign.id).eq('userId', departed.owner.userId)
      )
      .unique()
    if (!member) throw new Error('Missing player membership.')
    await ctx.db.patch(member._id, { leftAt: new Date().toISOString(), status: 'LEFT' })
  })
  expect(
    await refusal(departed.owner.caller.action(issue, { campaignId: departed.campaign.id }))
  ).toEqual({
    code: 'DOMAIN_REJECTED',
    message: 'Campaign not found.',
    reason: 'CAMPAIGN_NOT_FOUND'
  })

  const archived = await createEncounterSceneFixture()
  await archived.t.run(async (ctx) => {
    const campaign = await ctx.db
      .query('campaigns')
      .withIndex('by_publicId', (q) => q.eq('id', archived.campaign.id))
      .unique()
    if (!campaign) throw new Error('Missing Campaign.')
    await ctx.db.patch(campaign._id, { status: 'ARCHIVED' })
  })
  expect(
    await refusal(archived.other.caller.action(issue, { campaignId: archived.campaign.id }))
  ).toEqual({
    code: 'DOMAIN_REJECTED',
    message: 'Archived Campaigns are read-only.',
    reason: 'CAMPAIGN_NOT_ACTIVE'
  })
})

it('rejects missing and too-short ticket secrets without claiming authority', async () => {
  vi.stubEnv('LIVE_SESSION_TICKET_SECRET', '')
  const base = await createEncounterSceneFixture()
  const input: LiveSessionJoinOptionsDto = { campaignId: base.campaign.id }
  await expect(base.other.caller.action(issue, input)).rejects.toThrow(
    'LIVE_SESSION_TICKET_SECRET must contain at least 32 bytes.'
  )
  vi.stubEnv('LIVE_SESSION_TICKET_SECRET', 'short-secret')
  await expect(base.other.caller.action(issue, input)).rejects.toThrow(
    'LIVE_SESSION_TICKET_SECRET must contain at least 32 bytes.'
  )
  const authority = await base.t.run((ctx) =>
    ctx.db
      .query('campaignLiveAuthorities')
      .withIndex('by_campaignId', (q) => q.eq('campaignId', input.campaignId))
      .unique()
  )
  expect(authority).toBeNull()
})
