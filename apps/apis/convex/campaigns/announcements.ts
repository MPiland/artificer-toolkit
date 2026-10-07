import { rejectDomain } from '@artificer-toolkit/encounter-persistence/domainRejections'
import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import {
  campaignAnnouncementDtoSchema,
  campaignAnnouncementListInputSchema,
  campaignAnnouncementListPageSchema,
  createCampaignAnnouncementInputSchema,
  getCampaignAnnouncementInputSchema,
  type CampaignAnnouncementDto,
  type CampaignAnnouncementListPage
} from '@artificer-toolkit/schema/api/campaignAnnouncements'
import { campaignStoredAnnouncementSchema } from '@artificer-toolkit/schema/projections/campaignCommunicationPersistence'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { presentCampaignPlainText } from '@artificer-toolkit/shared/campaign/textPolicy'
import type { QueryCtx } from '../_generated/server'
import { query } from '../lib/queries'
import { mutation } from '../lib/mutations'
import type { Doc } from '../_generated/dataModel'
import { requireIdentity } from '../lib/identity'
import { enqueueNotification } from '../notifications/intents'
import { readActiveCampaignMembers, requireCampaignAuthority } from './authority'

export async function readParty(ctx: QueryCtx, campaignId: string) {
  return ctx.db
    .query('campaignConversations')
    .withIndex('by_campaignId_kind', (q) => q.eq('campaignId', campaignId).eq('kind', 'PARTY'))
    .unique()
}

export async function isPartyMember(
  ctx: QueryCtx,
  partyId: string,
  member: Doc<'campaignMemberships'>
) {
  if (member.role !== 'PLAYER' || member.status !== 'ACTIVE') return false
  const row = await ctx.db
    .query('campaignConversationMembers')
    .withIndex('by_conversationId_userId', (q) =>
      q.eq('conversationId', partyId).eq('userId', member.userId)
    )
    .unique()
  return row?.campaignId === member.campaignId
}

function present(record: Doc<'campaignAnnouncements'>, campaign: Doc<'campaigns'>, owner: boolean) {
  const {
    _id,
    _creationTime,
    commandId: _commandId,
    inputFingerprint: _fingerprint,
    ...announcement
  } = record
  return campaignAnnouncementDtoSchema.parse({
    ...announcement,
    title: owner ? record.title : presentCampaignPlainText(record.title, campaign.contentMaturity),
    body: owner ? record.body : presentCampaignPlainText(record.body, campaign.contentMaturity)
  })
}

export const list = query({
  args: zodToConvexFields(campaignAnnouncementListInputSchema.shape),
  returns: zodToConvex(campaignAnnouncementListPageSchema),
  handler: async (ctx, args): Promise<CampaignAnnouncementListPage> => {
    const { userId } = await requireIdentity(ctx)
    const input = campaignAnnouncementListInputSchema.parse(args)
    const { campaign, membership } = await requireCampaignAuthority(ctx, input.campaignId, userId)
    // Owner reads never query the private room or its announcement index range.
    const party = membership.role === 'PLAYER' ? await readParty(ctx, campaign.id) : null
    const includeParty = party !== null && (await isPartyMember(ctx, party.id, membership))
    const rows = includeParty
      ? ctx.db
          .query('campaignAnnouncements')
          .withIndex('by_campaignId_createdAt_publicId', (q) => q.eq('campaignId', campaign.id))
      : ctx.db
          .query('campaignAnnouncements')
          .withIndex('by_campaignId_scope_createdAt_publicId', (q) =>
            q.eq('campaignId', campaign.id).eq('scope', 'TABLE')
          )
    const result = await rows.order('desc').paginate({
      ...input.paginationOpts,
      maximumRowsRead: 48,
      maximumBytesRead: 1024 * 1024
    })
    return campaignAnnouncementListPageSchema.parse({
      ...result,
      page: result.page.map((record) => {
        if (record.scope === 'PARTY' && record.partyId !== party?.id)
          throw new Error('Stored Campaign announcement target mismatch.')
        return present(record, campaign, membership.role === 'OWNER')
      })
    })
  }
})

export const get = query({
  args: zodToConvexFields(getCampaignAnnouncementInputSchema.shape),
  returns: zodToConvex(campaignAnnouncementDtoSchema),
  handler: async (ctx, args): Promise<CampaignAnnouncementDto> => {
    const { userId } = await requireIdentity(ctx)
    const input = getCampaignAnnouncementInputSchema.parse(args)
    const { campaign, membership } = await requireCampaignAuthority(ctx, input.campaignId, userId)
    const record = await ctx.db
      .query('campaignAnnouncements')
      .withIndex('by_campaignId_publicId', (q) =>
        q
          .eq('campaignId', campaign.id)
          .eq('announcementPublicId', input.announcementPublicId.toLowerCase())
      )
      .unique()
    if (!record) throw new Error('Announcement not found.')
    if (record.scope === 'PARTY') {
      if (membership.role !== 'PLAYER') throw new Error('Announcement not found.')
      const party = await readParty(ctx, campaign.id)
      if (
        !party ||
        party.id !== record.partyId ||
        !(await isPartyMember(ctx, party.id, membership))
      )
        throw new Error('Announcement not found.')
    }
    return present(record, campaign, membership.role === 'OWNER')
  }
})

export const create = mutation({
  args: zodToConvexFields(createCampaignAnnouncementInputSchema.shape),
  returns: zodToConvex(campaignAnnouncementDtoSchema),
  handler: async (ctx, args): Promise<CampaignAnnouncementDto> => {
    const { userId } = await requireIdentity(ctx)
    const input = createCampaignAnnouncementInputSchema.parse(args)
    const { campaign, membership } = await requireCampaignAuthority(ctx, input.campaignId, userId)
    if (membership.role !== 'OWNER') rejectDomain('CAMPAIGN_NOT_FOUND')
    if (campaign.status !== 'ACTIVE') throw new Error('Archived Campaigns are read-only.')
    const inputFingerprint = checksumCanonicalJson(input)
    const commandId = input.commandId.toLowerCase()
    let partyId: string | null = null
    if (input.scope === 'PARTY') {
      const party = await readParty(ctx, campaign.id)
      const suppliedPartyId = input.partyId?.toLowerCase() ?? null
      if (!party || (suppliedPartyId !== null && party.id !== suppliedPartyId))
        rejectDomain('CAMPAIGN_NOT_FOUND')
      partyId = party.id
    }
    const prior = await ctx.db
      .query('campaignAnnouncements')
      .withIndex('by_campaignId_commandId', (q) =>
        q.eq('campaignId', campaign.id).eq('commandId', commandId)
      )
      .unique()
    if (prior) {
      if (prior.inputFingerprint !== inputFingerprint)
        throw new Error('This command ID was already used with different input.')
      return present(prior, campaign, true)
    }
    const record = campaignStoredAnnouncementSchema.parse({
      ...input,
      campaignId: campaign.id,
      commandId,
      partyId,
      inputFingerprint,
      announcementPublicId: crypto.randomUUID(),
      authorUserId: userId,
      createdAt: new Date().toISOString()
    })
    await ctx.db.insert('campaignAnnouncements', record)
    const members = await readActiveCampaignMembers(ctx, campaign)
    await Promise.all(
      members.map(async (member) => {
        if (
          member.userId === userId ||
          (partyId !== null && !(await isPartyMember(ctx, partyId, member)))
        )
          return
        await enqueueNotification(ctx, {
          recipientUserId: member.userId,
          data: {
            kind: 'CAMPAIGN_ANNOUNCEMENT',
            announcementPublicId: record.announcementPublicId,
            campaignPublicId: campaign.publicId,
            scope: input.scope,
            summary: 'A new Campaign announcement is available.',
            occurredAt: record.createdAt
          }
        })
      })
    )
    const { commandId: _commandId, inputFingerprint: _fingerprint, ...announcement } = record
    return campaignAnnouncementDtoSchema.parse(announcement)
  }
})
