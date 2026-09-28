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
import type { CampaignFileProfile } from '@artificer-toolkit/schema/api/media'
import type { MediaStoredAsset } from '@artificer-toolkit/schema/api/mediaAssets'
import {
  campaignFileDeliverySourceSchema,
  campaignStoredAttachmentSchema
} from '@artificer-toolkit/schema/projections/campaignFilePersistence'
import { query, internalQuery } from '../lib/queries'
import { mutation } from '../lib/mutations'
import { getAuthenticatedProfile, requireIdentity } from '../lib/identity'
import { storedImage } from '../media/assets'
import { readCampaignAuthorLabels, requireCampaignAuthorUsername } from './authorLabels'
import { requireCampaignAuthority } from './authority'
import { removeCampaignAttachment } from './attachmentDocuments'
import { assertCampaignContentAllowed } from './contentUsage'

function attachmentProfile(profileClass: MediaStoredAsset['profileClass']): CampaignFileProfile {
  return profileClass === 'HANDOUT_MAP' ? 'CAMPAIGN_HANDOUT_MAP' : 'CAMPAIGN_FILE'
}

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
      asset.profileClass === 'VTT_MAP' ||
      attachmentProfile(asset.profileClass) !== attachment.profile
    )
      throw new Error('Campaign attachment is unavailable.')
    // Reading a shared attachment requires membership, not uploader ownership or
    // access to the optionally associated notebook. Only verified SOURCE is signable.
    const file = storedImage(asset)
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
    await assertCampaignContentAllowed(ctx.db, campaign, 'campaignEntriesPerCampaign')
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
    // Attaching needs Campaign write access and the caller's own READY file or image (any class
    // but maps); the same asset may already serve other Campaigns or the caller's own slots.
    if (
      !asset ||
      asset.ownerUserId !== userId ||
      asset.status !== 'READY' ||
      asset.profileClass === 'VTT_MAP'
    )
      throw new Error('Campaign attachment is unavailable.')
    const attachment = campaignStoredAttachmentSchema.parse({
      id: crypto.randomUUID(),
      campaignId: campaign.id,
      assetId: asset.id,
      uploaderUserId: userId,
      profile: attachmentProfile(asset.profileClass),
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
