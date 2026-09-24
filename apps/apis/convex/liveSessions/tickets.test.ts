import { makeFunctionReference } from 'convex/server'
import { afterEach, expect, it, vi } from 'vitest'
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
  for (const [ticket, userId, role] of [
    [owner, base.other.userId, 'OWNER'],
    [player, base.owner.userId, 'PLAYER']
  ] as const) {
    const claims = await verifyLiveSessionTicket(ticket.ticket, secret)
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
