import { v } from 'convex/values'
import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import {
  campaignNotebookListInputSchema,
  campaignNotebookListPageSchema,
  campaignNotebookSectionDtoSchema,
  createCampaignNotebookSectionInputSchema,
  updateCampaignNotebookSectionInputSchema,
  deleteCampaignNotebookSectionInputSchema,
  type CampaignNotebookListPage,
  type CampaignNotebookSectionDto
} from '@artificer-toolkit/schema/api/campaignSessions'
import { campaignStoredNotebookSectionSchema } from '@artificer-toolkit/schema/projections/campaignNotebookPersistence'
import {
  presentCampaignPlainText,
  presentCampaignRichText
} from '@artificer-toolkit/shared/campaign/textPolicy'
import type { QueryCtx } from '../_generated/server'
import { query } from '../lib/queries'
import { mutation } from '../lib/mutations'
import { requireIdentity } from '../lib/identity'
import { requireCampaignAuthority } from './authority'
import { removeCampaignAttachment } from './attachmentDocuments'
import { assertCampaignContentAllowed } from './contentUsage'

function present(section: CampaignNotebookSectionDto, maturity: 'STANDARD' | 'MATURE') {
  return campaignNotebookSectionDtoSchema.parse({
    id: section.id,
    campaignId: section.campaignId,
    title:
      section.visibility === 'GM_PRIVATE'
        ? section.title
        : presentCampaignPlainText(section.title, maturity),
    content:
      section.visibility === 'GM_PRIVATE'
        ? section.content
        : presentCampaignRichText(section.content, maturity),
    visibility: section.visibility,
    category: section.category,
    version: section.version,
    createdAt: section.createdAt,
    updatedAt: section.updatedAt
  })
}

async function requireWritableNotebook(ctx: QueryCtx, campaignId: string) {
  const { userId } = await requireIdentity(ctx)
  const { campaign, membership } = await requireCampaignAuthority(ctx, campaignId, userId)
  if (membership.role !== 'OWNER') throw new Error('Campaign not found.')
  if (campaign.status !== 'ACTIVE') throw new Error('Archived Campaigns are read-only.')
  return { campaign, userId }
}

async function requireSection(ctx: QueryCtx, campaignId: string, sectionId: string) {
  const section = await ctx.db
    .query('campaignNotebookSections')
    .withIndex('by_campaignId_id', (q) =>
      q.eq('campaignId', campaignId).eq('id', sectionId.toLowerCase())
    )
    .unique()
  if (!section) throw new Error('Notebook section not found.')
  return section
}

export const list = query({
  args: zodToConvexFields(campaignNotebookListInputSchema.shape),
  returns: zodToConvex(campaignNotebookListPageSchema),
  handler: async (ctx, args): Promise<CampaignNotebookListPage> => {
    const input = campaignNotebookListInputSchema.parse(args)
    const { userId } = await requireIdentity(ctx)
    const { campaign, membership } = await requireCampaignAuthority(ctx, input.campaignId, userId)
    const rows =
      membership.role === 'OWNER'
        ? ctx.db
            .query('campaignNotebookSections')
            .withIndex('by_campaignId_sortOrder_id', (q) => q.eq('campaignId', campaign.id))
        : ctx.db
            .query('campaignNotebookSections')
            .withIndex('by_campaignId_visibility_sortOrder_id', (q) =>
              q.eq('campaignId', campaign.id).eq('visibility', 'SHARED')
            )
    const result = await rows.paginate({
      ...input.paginationOpts,
      maximumRowsRead: 8,
      maximumBytesRead: 1024 * 1024
    })
    return campaignNotebookListPageSchema.parse({
      ...result,
      page: result.page.map((section) => present(section, campaign.contentMaturity))
    })
  }
})

export const create = mutation({
  args: zodToConvexFields(createCampaignNotebookSectionInputSchema.shape),
  returns: zodToConvex(campaignNotebookSectionDtoSchema),
  handler: async (ctx, args): Promise<CampaignNotebookSectionDto> => {
    const input = createCampaignNotebookSectionInputSchema.parse(args)
    const { campaign, userId } = await requireWritableNotebook(ctx, input.campaignId)
    await assertCampaignContentAllowed(ctx.db, campaign, 'campaignEntriesPerCampaign')
    const now = new Date().toISOString()
    const section = campaignStoredNotebookSectionSchema.parse({
      ...input,
      id: crypto.randomUUID(),
      campaignId: campaign.id,
      version: 0,
      sortOrder: 0,
      createdBy: userId,
      updatedBy: userId,
      createdAt: now,
      updatedAt: now
    })
    await ctx.db.insert('campaignNotebookSections', section)
    return present(section, campaign.contentMaturity)
  }
})

export const update = mutation({
  args: zodToConvexFields(updateCampaignNotebookSectionInputSchema.shape),
  returns: zodToConvex(campaignNotebookSectionDtoSchema),
  handler: async (ctx, args): Promise<CampaignNotebookSectionDto> => {
    const input = updateCampaignNotebookSectionInputSchema.parse(args)
    const { campaign, userId } = await requireWritableNotebook(ctx, input.campaignId)
    const existing = await requireSection(ctx, campaign.id, input.sectionId)
    if (existing.version !== input.expectedVersion)
      throw new Error('Notebook section version conflict.')
    const patch = {
      title: input.title ?? existing.title,
      content: input.content ?? existing.content,
      visibility: input.visibility ?? existing.visibility,
      category: input.category ?? existing.category,
      version: existing.version + 1,
      updatedBy: userId,
      updatedAt: new Date().toISOString()
    }
    await ctx.db.patch(existing._id, patch)
    return present({ ...existing, ...patch }, campaign.contentMaturity)
  }
})

export const remove = mutation({
  args: zodToConvexFields(deleteCampaignNotebookSectionInputSchema.shape),
  returns: v.object({ ok: v.literal(true) }),
  handler: async (ctx, args): Promise<{ ok: true }> => {
    const input = deleteCampaignNotebookSectionInputSchema.parse(args)
    const { campaign } = await requireWritableNotebook(ctx, input.campaignId)
    const section = await requireSection(ctx, campaign.id, input.sectionId)
    // Preserve the former note-reference FK cascade in this same transaction.
    // Complete indexed batches; platform limits must roll back, never leave partial cleanup.
    while (true) {
      const pins = await ctx.db
        .query('campaignSessionReferences')
        .withIndex('by_campaignId_noteSectionId', (q) =>
          q.eq('campaignId', campaign.id).eq('target.noteSectionId', section.id)
        )
        .take(48)
      for (const pin of pins) await ctx.db.delete(pin._id)
      if (pins.length < 48) break
    }
    while (true) {
      const attachments = await ctx.db
        .query('campaignAttachments')
        .withIndex('by_campaignId_noteSectionId', (q) =>
          q.eq('campaignId', campaign.id).eq('noteSectionId', section.id)
        )
        .take(48)
      for (const attachment of attachments) await removeCampaignAttachment(ctx, attachment)
      if (attachments.length < 48) break
    }
    await ctx.db.delete(section._id)
    return { ok: true }
  }
})
