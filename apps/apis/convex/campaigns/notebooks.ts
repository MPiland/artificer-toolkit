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
import { getAuthenticatedProfile, requireIdentity } from '../lib/identity'
import { readCampaignAuthorLabels, requireCampaignAuthorUsername } from './authorLabels'
import { requireCampaignAuthority } from './authority'
import { assertCampaignContentAllowed } from './contentUsage'
import { canViewNote } from './noteVisibility'
import { deleteNotebookSection } from './noteRemoval'

function present(
  section: Omit<CampaignNotebookSectionDto, 'authorLabel'>,
  authorLabel: string,
  maturity: 'STANDARD' | 'MATURE'
) {
  const privateSection = section.visibility === 'PRIVATE'
  return campaignNotebookSectionDtoSchema.parse({
    id: section.id,
    campaignId: section.campaignId,
    authorUserId: section.authorUserId,
    authorLabel,
    title: privateSection ? section.title : presentCampaignPlainText(section.title, maturity),
    content: privateSection ? section.content : presentCampaignRichText(section.content, maturity),
    visibility: section.visibility,
    category: section.category,
    version: section.version,
    createdAt: section.createdAt,
    updatedAt: section.updatedAt
  })
}

async function requireWritableNotebook(ctx: QueryCtx, campaignId: string) {
  const actor = await getAuthenticatedProfile(ctx)
  if (!actor) throw new Error('Unauthenticated')
  const { userId } = actor.identity
  const { campaign, membership } = await requireCampaignAuthority(ctx, campaignId, userId)
  if (campaign.status !== 'ACTIVE') throw new Error('Archived Campaigns are read-only.')
  return { campaign, membership, userId, username: actor.username }
}

async function requireSection(
  ctx: QueryCtx,
  campaignId: string,
  sectionId: string,
  viewer: { userId: string; role: 'OWNER' | 'PLAYER' }
) {
  const section = await ctx.db
    .query('campaignNotebookSections')
    .withIndex('by_campaignId_id', (q) =>
      q.eq('campaignId', campaignId).eq('id', sectionId.toLowerCase())
    )
    .unique()
  if (!section || !canViewNote(section, viewer)) throw new Error('Notebook section not found.')
  return section
}

export const list = query({
  args: zodToConvexFields(campaignNotebookListInputSchema.shape),
  returns: zodToConvex(campaignNotebookListPageSchema),
  handler: async (ctx, args): Promise<CampaignNotebookListPage> => {
    const input = campaignNotebookListInputSchema.parse(args)
    const { userId } = await requireIdentity(ctx)
    const { campaign, membership } = await requireCampaignAuthority(ctx, input.campaignId, userId)
    const rows = ctx.db
      .query('campaignNotebookSections')
      .withIndex('by_campaignId_sortOrder_id', (q) => q.eq('campaignId', campaign.id))
    const result = await (
      membership.role === 'OWNER'
        ? rows
        : rows.filter((q) =>
            q.or(q.eq(q.field('visibility'), 'SHARED'), q.eq(q.field('authorUserId'), userId))
          )
    ).paginate({
      ...input.paginationOpts,
      maximumRowsRead: 8,
      maximumBytesRead: 1024 * 1024
    })
    const authorLabels = await readCampaignAuthorLabels(
      ctx,
      result.page.map((section) => ({ userId: section.authorUserId }))
    )
    return campaignNotebookListPageSchema.parse({
      ...result,
      page: result.page.map((section, index) =>
        present(section, authorLabels[index], campaign.contentMaturity)
      )
    })
  }
})

export const create = mutation({
  args: zodToConvexFields(createCampaignNotebookSectionInputSchema.shape),
  returns: zodToConvex(campaignNotebookSectionDtoSchema),
  handler: async (ctx, args): Promise<CampaignNotebookSectionDto> => {
    const input = createCampaignNotebookSectionInputSchema.parse(args)
    const { campaign, userId, username } = await requireWritableNotebook(ctx, input.campaignId)
    if (input.visibility === 'SHARED') requireCampaignAuthorUsername(username)
    await assertCampaignContentAllowed(ctx.db, campaign, 'campaignEntriesPerCampaign')
    const now = new Date().toISOString()
    const section = campaignStoredNotebookSectionSchema.parse({
      ...input,
      id: crypto.randomUUID(),
      campaignId: campaign.id,
      version: 0,
      sortOrder: 0,
      authorUserId: userId,
      updatedBy: userId,
      createdAt: now,
      updatedAt: now
    })
    await ctx.db.insert('campaignNotebookSections', section)
    const [authorLabel] = await readCampaignAuthorLabels(ctx, [{ userId }])
    return present(section, authorLabel, campaign.contentMaturity)
  }
})

export const update = mutation({
  args: zodToConvexFields(updateCampaignNotebookSectionInputSchema.shape),
  returns: zodToConvex(campaignNotebookSectionDtoSchema),
  handler: async (ctx, args): Promise<CampaignNotebookSectionDto> => {
    const input = updateCampaignNotebookSectionInputSchema.parse(args)
    const { campaign, membership, userId, username } = await requireWritableNotebook(
      ctx,
      input.campaignId
    )
    const existing = await requireSection(ctx, campaign.id, input.sectionId, {
      userId,
      role: membership.role
    })
    if (existing.authorUserId !== userId) throw new Error('Only the author can edit this entry.')
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
    if (patch.visibility === 'SHARED') requireCampaignAuthorUsername(username)
    await ctx.db.patch(existing._id, patch)
    const [authorLabel] = await readCampaignAuthorLabels(ctx, [{ userId: existing.authorUserId }])
    return present({ ...existing, ...patch }, authorLabel, campaign.contentMaturity)
  }
})

export const remove = mutation({
  args: zodToConvexFields(deleteCampaignNotebookSectionInputSchema.shape),
  returns: v.object({ ok: v.literal(true) }),
  handler: async (ctx, args): Promise<{ ok: true }> => {
    const input = deleteCampaignNotebookSectionInputSchema.parse(args)
    const { campaign, membership, userId } = await requireWritableNotebook(ctx, input.campaignId)
    const section = await requireSection(ctx, campaign.id, input.sectionId, {
      userId,
      role: membership.role
    })
    if (section.authorUserId !== userId && membership.role !== 'OWNER')
      throw new Error('Only the author or the GM can delete this entry.')
    await deleteNotebookSection(ctx, section)
    return { ok: true }
  }
})
