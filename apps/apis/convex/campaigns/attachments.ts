import { v } from 'convex/values'
import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import {
  campaignAttachmentDtoSchema,
  campaignAttachmentListInputSchema,
  campaignAttachmentListPageSchema,
  createCampaignAttachmentInputSchema,
  deleteCampaignAttachmentInputSchema,
  getCampaignAttachmentDeliveryInputSchema,
  type CampaignAttachmentDto,
  type CampaignAttachmentListPage
} from '@artificer-toolkit/schema/api/campaignAttachments'
import {
  campaignFileDeliverySourceSchema,
  campaignStoredAttachmentSchema,
  campaignStoredFileAssetSchema
} from '@artificer-toolkit/schema/projections/campaignFilePersistence'
import { query, internalQuery } from '../_generated/server'
import { mutation } from '../lib/mutations'
import { getAuthenticatedProfile, requireIdentity } from '../lib/identity'
import { readCampaignAuthorLabels, requireCampaignAuthorUsername } from './authorLabels'
import { requireCampaignAuthority } from './authority'
import { removeCampaignAttachment } from './attachmentDocuments'

export const readDelivery = internalQuery({
  args: zodToConvexFields(getCampaignAttachmentDeliveryInputSchema.shape),
  returns: zodToConvex(campaignFileDeliverySourceSchema),
  handler: async (ctx, args) => {
    const input = getCampaignAttachmentDeliveryInputSchema.parse(args)
    const { userId } = await requireIdentity(ctx)
    const { campaign } = await requireCampaignAuthority(ctx, input.campaignId, userId)
    const attachment = await ctx.db
      .query('campaignAttachments')
      .withIndex('by_campaignId_id', (q) =>
        q.eq('campaignId', campaign.id).eq('id', input.attachmentId.toLowerCase())
      )
      .unique()
    if (!attachment) throw new Error('Campaign attachment not found.')
    const asset = await ctx.db
      .query('mediaAssets')
      .withIndex('by_publicId', (q) => q.eq('id', attachment.assetId))
      .unique()
    if (
      !asset ||
      asset.status !== 'READY' ||
      (asset.profile !== 'CAMPAIGN_FILE' && asset.profile !== 'CAMPAIGN_HANDOUT_MAP') ||
      asset.campaignId !== campaign.id ||
      asset.profile !== attachment.profile ||
      (asset.ownerUserId !== attachment.uploaderUserId &&
        asset.retainedFromUserId !== attachment.uploaderUserId)
    )
      throw new Error('Campaign attachment is unavailable.')
    // Reading a shared attachment requires membership, not uploader ownership or
    // access to the optionally associated notebook. Only verified SOURCE is signable.
    const { _id, _creationTime, ...stored } = asset
    const file = campaignStoredFileAssetSchema.parse(stored)
    const source = file.variants.find((variant) => variant.kind === 'SOURCE')
    if (!source) throw new Error('Campaign attachment is unavailable.')
    return campaignFileDeliverySourceSchema.parse({
      assetId: file.id,
      objectKey: source.objectKey,
      mimeType: source.mimeType,
      fileName: file.upload.originalFileName,
      byteSize: source.byteSize
    })
  }
})

export const list = query({
  args: zodToConvexFields(campaignAttachmentListInputSchema.shape),
  returns: zodToConvex(campaignAttachmentListPageSchema),
  handler: async (ctx, args): Promise<CampaignAttachmentListPage> => {
    const input = campaignAttachmentListInputSchema.parse(args)
    const { userId } = await requireIdentity(ctx)
    const { campaign } = await requireCampaignAuthority(ctx, input.campaignId, userId)
    const result = await ctx.db
      .query('campaignAttachments')
      .withIndex('by_campaignId_createdAt_id', (q) => q.eq('campaignId', campaign.id))
      .order('desc')
      .paginate({ ...input.paginationOpts, maximumRowsRead: 48, maximumBytesRead: 1024 * 1024 })
    const uploaderLabels = await readCampaignAuthorLabels(
      ctx,
      result.page.map((attachment) => ({ userId: attachment.uploaderUserId }))
    )
    return campaignAttachmentListPageSchema.parse({
      ...result,
      page: result.page.map(({ _id, _creationTime, ...attachment }, index) => ({
        ...attachment,
        uploaderLabel: uploaderLabels[index]
      }))
    })
  }
})

export const create = mutation({
  args: zodToConvexFields(createCampaignAttachmentInputSchema.shape),
  returns: zodToConvex(campaignAttachmentDtoSchema),
  handler: async (ctx, args): Promise<CampaignAttachmentDto> => {
    const input = createCampaignAttachmentInputSchema.parse(args)
    const actor = await getAuthenticatedProfile(ctx)
    if (!actor) throw new Error('Unauthenticated')
    const { userId } = actor.identity
    const { campaign } = await requireCampaignAuthority(ctx, input.campaignId, userId)
    if (campaign.status !== 'ACTIVE') throw new Error('Archived Campaigns are read-only.')
    requireCampaignAuthorUsername(actor.username)
    const sessionId = input.sessionId?.toLowerCase() ?? null
    const noteSectionId = input.noteSectionId?.toLowerCase() ?? null
    if (
      sessionId &&
      !(await ctx.db
        .query('campaignSessions')
        .withIndex('by_campaignId_id', (q) => q.eq('campaignId', campaign.id).eq('id', sessionId))
        .unique())
    )
      throw new Error('Campaign attachment is unavailable.')
    if (
      noteSectionId &&
      !(await ctx.db
        .query('campaignNotebookSections')
        .withIndex('by_campaignId_id', (q) =>
          q.eq('campaignId', campaign.id).eq('id', noteSectionId)
        )
        .unique())
    )
      throw new Error('Campaign attachment is unavailable.')
    const asset = await ctx.db
      .query('mediaAssets')
      .withIndex('by_publicId', (q) => q.eq('id', input.assetId.toLowerCase()))
      .unique()
    if (
      !asset ||
      asset.ownerUserId !== userId ||
      asset.status !== 'READY' ||
      (asset.profile !== 'CAMPAIGN_FILE' && asset.profile !== 'CAMPAIGN_HANDOUT_MAP') ||
      asset.campaignId !== campaign.id
    )
      throw new Error('Campaign attachment is unavailable.')
    const attachment = campaignStoredAttachmentSchema.parse({
      id: crypto.randomUUID(),
      campaignId: campaign.id,
      assetId: asset.id,
      uploaderUserId: userId,
      profile: asset.profile,
      displayName: input.displayName,
      description: input.description ?? null,
      sessionId,
      noteSectionId,
      createdAt: new Date().toISOString()
    })
    await ctx.db.insert('campaignAttachments', attachment)
    await ctx.db.patch(asset._id, { cleanupAt: null })
    const [uploaderLabel] = await readCampaignAuthorLabels(ctx, [{ userId }])
    return campaignAttachmentDtoSchema.parse({ ...attachment, uploaderLabel })
  }
})

export const remove = mutation({
  args: zodToConvexFields(deleteCampaignAttachmentInputSchema.shape),
  returns: v.object({ ok: v.literal(true) }),
  handler: async (ctx, args): Promise<{ ok: true }> => {
    const input = deleteCampaignAttachmentInputSchema.parse(args)
    const { userId } = await requireIdentity(ctx)
    const { campaign, membership } = await requireCampaignAuthority(ctx, input.campaignId, userId)
    if (campaign.status !== 'ACTIVE') throw new Error('Archived Campaigns are read-only.')
    const attachment = await ctx.db
      .query('campaignAttachments')
      .withIndex('by_campaignId_id', (q) =>
        q.eq('campaignId', campaign.id).eq('id', input.attachmentId.toLowerCase())
      )
      .unique()
    if (!attachment) throw new Error('Campaign attachment not found.')
    if (attachment.uploaderUserId !== userId && membership.role !== 'OWNER')
      throw new Error('Campaign attachment is unavailable.')
    await removeCampaignAttachment(ctx, attachment)
    return { ok: true }
  }
})
