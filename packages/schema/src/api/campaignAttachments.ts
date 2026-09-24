import { z } from '../zod.js'

import { campaignFileProfileSchema } from './media.js'
import { shortTextSchema, timestampSchema, uuidSchema } from './campaignContractSchemas.js'
import { campaignListInputSchema, campaignListPageSchema } from './campaignList.js'

export const campaignAttachmentDtoSchema = z.strictObject({
  id: uuidSchema,
  campaignId: uuidSchema,
  assetId: uuidSchema,
  uploaderUserId: uuidSchema,
  displayName: shortTextSchema,
  description: z.nullable(
    z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(1_000))
  ),
  profile: campaignFileProfileSchema,
  sessionId: z.nullable(uuidSchema),
  noteSectionId: z.nullable(uuidSchema),
  createdAt: timestampSchema
})
export const campaignAttachmentsDtoSchema = z.array(campaignAttachmentDtoSchema)
export const listCampaignAttachmentsInputSchema = z.strictObject({
  campaignId: uuidSchema
})
export const campaignAttachmentListInputSchema = z.extend(
  listCampaignAttachmentsInputSchema,
  campaignListInputSchema.shape
)
export const campaignAttachmentListPageSchema = z.extend(campaignListPageSchema, {
  page: campaignAttachmentsDtoSchema
})
export const createCampaignAttachmentInputSchema = z.strictObject({
  campaignId: uuidSchema,
  assetId: uuidSchema,
  displayName: shortTextSchema,
  description: z.optional(
    z.nullable(z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(1_000)))
  ),
  sessionId: z.optional(z.nullable(uuidSchema)),
  noteSectionId: z.optional(z.nullable(uuidSchema))
})
export const deleteCampaignAttachmentInputSchema = z.strictObject({
  campaignId: uuidSchema,
  attachmentId: uuidSchema
})
export const getCampaignAttachmentDeliveryInputSchema = deleteCampaignAttachmentInputSchema

export type CampaignAttachmentDto = z.infer<typeof campaignAttachmentDtoSchema>
export type CreateCampaignAttachmentInput = z.input<typeof createCampaignAttachmentInputSchema>
export type CampaignAttachmentListInput = z.infer<typeof campaignAttachmentListInputSchema>
export type CampaignAttachmentListPage = z.infer<typeof campaignAttachmentListPageSchema>
