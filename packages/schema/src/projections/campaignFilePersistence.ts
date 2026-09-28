import { z, lazySchema } from '../zod.js'
import {
  mediaSha256Schema,
  mediaStoredAssetSchema,
  mediaStoredFileVariantSchema,
  mediaStoredVariantSchema,
  mediaProcessingOperationSchema
} from '../api/mediaAssets.js'
import {
  finalizeImageUploadInputSchema,
  finalizeImageUploadOutputSchema,
  signedCampaignFileDeliveryDtoSchema
} from '../api/media.js'
import { campaignAttachmentDtoSchema } from '../api/campaignAttachments.js'

/** The uploader label is resolved on read so a deleted account never keeps its username. */
export const campaignStoredAttachmentSchema = lazySchema(() =>
  z.omit(campaignAttachmentDtoSchema, {
    uploaderLabel: true
  })
)

export const campaignFileFinalizeInputSchema = lazySchema(() =>
  z.extend(finalizeImageUploadInputSchema, {
    operationId: z.string().check(z.uuid()),
    variants: z.array(mediaStoredFileVariantSchema).check(z.minLength(1)).check(z.maxLength(3)),
    contentHash: mediaSha256Schema
  })
)
export const campaignFileProcessClaimSchema = lazySchema(() =>
  z.discriminatedUnion('kind', [
    z.strictObject({
      kind: z.literal('CURRENT'),
      result: z.extend(finalizeImageUploadOutputSchema, {
        status: z.literal('READY'),
        preview: z.null()
      })
    }),
    z.strictObject({
      kind: z.literal('PROCESS'),
      asset: mediaStoredAssetSchema,
      operation: mediaProcessingOperationSchema
    })
  ])
)
export type CampaignFileProcessClaim = z.infer<typeof campaignFileProcessClaimSchema>
export type CampaignFileFinalizeInput = z.infer<typeof campaignFileFinalizeInputSchema>

// Internal signing input: never return this object-key projection to a client.
export const campaignFileDeliverySourceSchema = lazySchema(() =>
  z.extend(z.omit(signedCampaignFileDeliveryDtoSchema, { url: true, expiresAt: true }), {
    objectKey: mediaStoredVariantSchema.shape.objectKey
  })
)
export type CampaignFileDeliverySource = z.infer<typeof campaignFileDeliverySourceSchema>
