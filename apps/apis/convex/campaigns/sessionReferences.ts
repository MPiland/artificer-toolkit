import { v } from 'convex/values'
import { rejectDomain } from '@artificer-toolkit/encounter-persistence/domainRejections'
import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import {
  campaignSessionReferencePinDtoSchema,
  createCampaignSessionReferencePinInputSchema,
  deleteCampaignSessionReferencePinInputSchema,
  type CampaignSessionReferencePinDto
} from '@artificer-toolkit/schema/api/campaignSessions'
import {
  campaignSessionReferenceListInputSchema,
  campaignSessionReferenceListPageSchema,
  type CampaignSessionReferenceListPage
} from '@artificer-toolkit/schema/api/campaignSessionLists'
import { campaignStoredSessionReferenceSchema } from '@artificer-toolkit/schema/projections/campaignSessionPersistence'
import { presentCampaignPlainText } from '@artificer-toolkit/shared/campaign/textPolicy'
import type { QueryCtx } from '../_generated/server'
import { query } from '../lib/queries'
import { mutation } from '../lib/mutations'
import { requireIdentity } from '../lib/identity'
import { readAuthoredDetail } from '../content/details'
import { requireCampaignAuthority } from './authority'
import { requireSession } from './sessionDocuments'

async function readLabel(
  ctx: QueryCtx,
  campaignId: string,
  target: CampaignSessionReferencePinDto['target']
) {
  if (target.kind === 'CAMPAIGN_NOTE') {
    const note = await ctx.db
      .query('campaignNotebookSections')
      .withIndex('by_campaignId_id', (q) =>
        q.eq('campaignId', campaignId).eq('id', target.noteSectionId.toLowerCase())
      )
      .unique()
    return note?.title ?? null
  }
  const detail = await readAuthoredDetail(ctx, {
    id: target.publicId,
    subjectKind: target.routeSubjectKind,
    view: 'active'
  })
  return detail?.item?.label ?? null
}

export const list = query({
  args: zodToConvexFields(campaignSessionReferenceListInputSchema.shape),
  returns: zodToConvex(campaignSessionReferenceListPageSchema),
  handler: async (ctx, args): Promise<CampaignSessionReferenceListPage> => {
    const input = campaignSessionReferenceListInputSchema.parse(args)
    const { userId } = await requireIdentity(ctx)
    const { campaign, membership } = await requireCampaignAuthority(ctx, input.campaignId, userId)
    if (membership.role !== 'OWNER') return { page: [], isDone: true, continueCursor: '' }
    const session = await requireSession(ctx, campaign.id, input.sessionId)
    const result = await ctx.db
      .query('campaignSessionReferences')
      .withIndex('by_campaignId_sessionId_createdAt_id', (q) =>
        q.eq('campaignId', campaign.id).eq('sessionId', session.id)
      )
      .paginate({ ...input.paginationOpts, maximumRowsRead: 4, maximumBytesRead: 1024 * 1024 })
    const page: CampaignSessionReferencePinDto[] = []
    for (const pin of result.page) {
      const label = await readLabel(ctx, campaign.id, pin.target)
      if (label === null) continue
      page.push(
        campaignSessionReferencePinDtoSchema.parse({
          id: pin.id,
          campaignId: pin.campaignId,
          sessionId: pin.sessionId,
          target: pin.target,
          createdAt: pin.createdAt,
          label: presentCampaignPlainText(label, campaign.contentMaturity)
        })
      )
    }
    return campaignSessionReferenceListPageSchema.parse({ ...result, page })
  }
})

export const create = mutation({
  args: zodToConvexFields(createCampaignSessionReferencePinInputSchema.shape),
  returns: zodToConvex(campaignSessionReferencePinDtoSchema),
  handler: async (ctx, args): Promise<CampaignSessionReferencePinDto> => {
    const input = createCampaignSessionReferencePinInputSchema.parse(args)
    const { userId } = await requireIdentity(ctx)
    const { campaign, membership } = await requireCampaignAuthority(ctx, input.campaignId, userId)
    if (membership.role !== 'OWNER') rejectDomain('CAMPAIGN_NOT_FOUND')
    if (campaign.status !== 'ACTIVE') throw new Error('Archived Campaigns are read-only.')
    const session = await requireSession(ctx, campaign.id, input.sessionId)
    const target =
      input.target.kind === 'CAMPAIGN_NOTE'
        ? { ...input.target, noteSectionId: input.target.noteSectionId.toLowerCase() }
        : input.target
    const label = await readLabel(ctx, campaign.id, target)
    if (label === null) throw new Error('Reference target not found.')
    const pin = campaignStoredSessionReferenceSchema.parse({
      id: crypto.randomUUID(),
      campaignId: campaign.id,
      sessionId: session.id,
      target,
      createdAt: new Date().toISOString()
    })
    await ctx.db.insert('campaignSessionReferences', pin)
    return campaignSessionReferencePinDtoSchema.parse({
      ...pin,
      label: presentCampaignPlainText(label, campaign.contentMaturity)
    })
  }
})

export const remove = mutation({
  args: zodToConvexFields(deleteCampaignSessionReferencePinInputSchema.shape),
  returns: v.object({ ok: v.literal(true) }),
  handler: async (ctx, args): Promise<{ ok: true }> => {
    const input = deleteCampaignSessionReferencePinInputSchema.parse(args)
    const { userId } = await requireIdentity(ctx)
    const { campaign, membership } = await requireCampaignAuthority(ctx, input.campaignId, userId)
    if (membership.role !== 'OWNER') rejectDomain('CAMPAIGN_NOT_FOUND')
    if (campaign.status !== 'ACTIVE') throw new Error('Archived Campaigns are read-only.')
    const session = await requireSession(ctx, campaign.id, input.sessionId)
    const pin = await ctx.db
      .query('campaignSessionReferences')
      .withIndex('by_campaignId_sessionId_id', (q) =>
        q
          .eq('campaignId', campaign.id)
          .eq('sessionId', session.id)
          .eq('id', input.pinId.toLowerCase())
      )
      .unique()
    if (!pin) throw new Error('Session reference pin not found.')
    await ctx.db.delete(pin._id)
    return { ok: true }
  }
})
