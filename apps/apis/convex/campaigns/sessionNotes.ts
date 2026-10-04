import { v } from 'convex/values'
import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import {
  campaignSessionNoteSectionDtoSchema,
  createCampaignSessionNoteSectionInputSchema,
  updateCampaignSessionNoteSectionInputSchema,
  deleteCampaignSessionNoteSectionInputSchema,
  type CampaignSessionNoteSectionDto
} from '@artificer-toolkit/schema/api/campaignSessions'
import {
  campaignSessionNoteListInputSchema,
  campaignSessionNoteListPageSchema,
  type CampaignSessionNoteListPage
} from '@artificer-toolkit/schema/api/campaignSessionLists'
import { campaignStoredSessionNoteSchema } from '@artificer-toolkit/schema/projections/campaignSessionPersistence'
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
import { canViewNote } from './noteVisibility'
import { requireSession } from './sessionDocuments'

function present(
  note: Omit<CampaignSessionNoteSectionDto, 'authorLabel'>,
  authorLabel: string,
  maturity: 'STANDARD' | 'MATURE'
) {
  const privateNote = note.visibility === 'PRIVATE'
  return campaignSessionNoteSectionDtoSchema.parse({
    id: note.id,
    campaignId: note.campaignId,
    sessionId: note.sessionId,
    authorUserId: note.authorUserId,
    authorLabel,
    title: privateNote ? note.title : presentCampaignPlainText(note.title, maturity),
    content: privateNote ? note.content : presentCampaignRichText(note.content, maturity),
    visibility: note.visibility,
    kind: note.kind,
    sortOrder: note.sortOrder,
    version: note.version,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt
  })
}

async function requireNote(
  ctx: QueryCtx,
  campaignId: string,
  sessionId: string,
  sectionId: string,
  viewer: { userId: string; role: 'OWNER' | 'PLAYER' }
) {
  const note = await ctx.db
    .query('campaignSessionNotes')
    .withIndex('by_campaignId_sessionId_id', (q) =>
      q.eq('campaignId', campaignId).eq('sessionId', sessionId).eq('id', sectionId.toLowerCase())
    )
    .unique()
  if (!note || !canViewNote(note, viewer)) throw new Error('Session note not found.')
  return note
}

export const list = query({
  args: zodToConvexFields(campaignSessionNoteListInputSchema.shape),
  returns: zodToConvex(campaignSessionNoteListPageSchema),
  handler: async (ctx, args): Promise<CampaignSessionNoteListPage> => {
    const input = campaignSessionNoteListInputSchema.parse(args)
    const { userId } = await requireIdentity(ctx)
    const { campaign, membership } = await requireCampaignAuthority(ctx, input.campaignId, userId)
    const session = await requireSession(ctx, campaign.id, input.sessionId)
    const rows = ctx.db
      .query('campaignSessionNotes')
      .withIndex('by_campaignId_sessionId_sortOrder_id', (q) =>
        q.eq('campaignId', campaign.id).eq('sessionId', session.id)
      )
    const result = await (
      membership.role === 'OWNER'
        ? rows
        : rows.filter((q) =>
            q.or(
              q.eq(q.field('visibility'), 'SHARED'),
              q.eq(q.field('authorUserId'), userId)
            )
          )
    ).paginate({
      ...input.paginationOpts,
      maximumRowsRead: 8,
      maximumBytesRead: 1024 * 1024
    })
    const authorLabels = await readCampaignAuthorLabels(
      ctx,
      result.page.map((note) => ({ userId: note.authorUserId }))
    )
    return campaignSessionNoteListPageSchema.parse({
      ...result,
      page: result.page.map((note, index) =>
        present(note, authorLabels[index], campaign.contentMaturity)
      )
    })
  }
})

export const create = mutation({
  args: zodToConvexFields(createCampaignSessionNoteSectionInputSchema.shape),
  returns: zodToConvex(campaignSessionNoteSectionDtoSchema),
  handler: async (ctx, args): Promise<CampaignSessionNoteSectionDto> => {
    const input = createCampaignSessionNoteSectionInputSchema.parse(args)
    const actor = await getAuthenticatedProfile(ctx)
    if (!actor) throw new Error('Unauthenticated')
    const { userId } = actor.identity
    const { campaign, membership } = await requireCampaignAuthority(ctx, input.campaignId, userId)
    if (campaign.status !== 'ACTIVE') throw new Error('Archived Campaigns are read-only.')
    if (input.visibility === 'SHARED') requireCampaignAuthorUsername(actor.username)
    if (input.kind !== 'NOTE' && membership.role !== 'OWNER') throw new Error('Campaign not found.')
    const session = await requireSession(ctx, campaign.id, input.sessionId)
    const now = new Date().toISOString()
    const note = campaignStoredSessionNoteSchema.parse({
      ...input,
      campaignId: campaign.id,
      sessionId: session.id,
      id: crypto.randomUUID(),
      authorUserId: userId,
      updatedBy: userId,
      sortOrder: input.sortOrder ?? 0,
      version: 0,
      createdAt: now,
      updatedAt: now
    })
    await ctx.db.insert('campaignSessionNotes', note)
    const [authorLabel] = await readCampaignAuthorLabels(ctx, [{ userId: note.authorUserId }])
    return present(note, authorLabel, campaign.contentMaturity)
  }
})

export const update = mutation({
  args: zodToConvexFields(updateCampaignSessionNoteSectionInputSchema.shape),
  returns: zodToConvex(campaignSessionNoteSectionDtoSchema),
  handler: async (ctx, args): Promise<CampaignSessionNoteSectionDto> => {
    const input = updateCampaignSessionNoteSectionInputSchema.parse(args)
    const actor = await getAuthenticatedProfile(ctx)
    if (!actor) throw new Error('Unauthenticated')
    const { userId } = actor.identity
    const { campaign, membership } = await requireCampaignAuthority(ctx, input.campaignId, userId)
    if (campaign.status !== 'ACTIVE') throw new Error('Archived Campaigns are read-only.')
    const session = await requireSession(ctx, campaign.id, input.sessionId)
    const existing = await requireNote(ctx, campaign.id, session.id, input.sectionId, {
      userId,
      role: membership.role
    })
    if (existing.authorUserId !== userId) throw new Error('Only the author can edit this note.')
    if (existing.version !== input.expectedVersion)
      throw new Error('Session note version conflict.')
    const merged = createCampaignSessionNoteSectionInputSchema.parse({
      campaignId: campaign.id,
      sessionId: session.id,
      title: input.title ?? existing.title,
      content: input.content ?? existing.content,
      visibility: input.visibility ?? existing.visibility,
      kind: input.kind ?? existing.kind,
      sortOrder: input.sortOrder ?? existing.sortOrder
    })
    if (merged.visibility === 'SHARED') requireCampaignAuthorUsername(actor.username)
    if (merged.kind !== 'NOTE' && membership.role !== 'OWNER') throw new Error('Campaign not found.')
    const patch = {
      ...merged,
      version: existing.version + 1,
      updatedBy: userId,
      updatedAt: new Date().toISOString()
    }
    await ctx.db.patch(existing._id, patch)
    const [authorLabel] = await readCampaignAuthorLabels(ctx, [{ userId: existing.authorUserId }])
    return present({ ...existing, ...patch }, authorLabel, campaign.contentMaturity)
  }
})

export const remove = mutation({
  args: zodToConvexFields(deleteCampaignSessionNoteSectionInputSchema.shape),
  returns: v.object({ ok: v.literal(true) }),
  handler: async (ctx, args): Promise<{ ok: true }> => {
    const input = deleteCampaignSessionNoteSectionInputSchema.parse(args)
    const { userId } = await requireIdentity(ctx)
    const { campaign, membership } = await requireCampaignAuthority(ctx, input.campaignId, userId)
    if (campaign.status !== 'ACTIVE') throw new Error('Archived Campaigns are read-only.')
    const session = await requireSession(ctx, campaign.id, input.sessionId)
    const note = await requireNote(ctx, campaign.id, session.id, input.sectionId, {
      userId,
      role: membership.role
    })
    if (note.authorUserId !== userId && membership.role !== 'OWNER')
      throw new Error('Only the author or the GM can delete this note.')
    await ctx.db.delete(note._id)
    return { ok: true }
  }
})
