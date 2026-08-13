import { z } from 'zod'

import { campaignFileProfileSchema } from './media.js'
import { shortTextSchema, timestampSchema, uuidSchema } from './campaignContractSchemas.js'

export const campaignAttachmentDtoSchema = z.strictObject({
  id: uuidSchema,
  campaignId: uuidSchema,
  assetId: uuidSchema,
  uploaderUserId: uuidSchema,
  displayName: shortTextSchema,
  description: z.string().trim().min(1).max(1_000).nullable(),
  profile: campaignFileProfileSchema,
  sessionId: uuidSchema.nullable(),
  noteSectionId: uuidSchema.nullable(),
  createdAt: timestampSchema
})
export const campaignAttachmentsDtoSchema = z.array(campaignAttachmentDtoSchema)
export const listCampaignAttachmentsInputSchema = z.strictObject({
  campaignId: uuidSchema
})
export const createCampaignAttachmentInputSchema = z.strictObject({
  campaignId: uuidSchema,
  assetId: uuidSchema,
  displayName: shortTextSchema,
  description: z.string().trim().min(1).max(1_000).nullable().optional(),
  sessionId: uuidSchema.nullable().optional(),
  noteSectionId: uuidSchema.nullable().optional()
})
export const deleteCampaignAttachmentInputSchema = z.strictObject({
  campaignId: uuidSchema,
  attachmentId: uuidSchema
})
export const getCampaignAttachmentDeliveryInputSchema = deleteCampaignAttachmentInputSchema

export type CampaignAttachmentDto = z.infer<typeof campaignAttachmentDtoSchema>
export type CreateCampaignAttachmentInput = z.input<typeof createCampaignAttachmentInputSchema>
