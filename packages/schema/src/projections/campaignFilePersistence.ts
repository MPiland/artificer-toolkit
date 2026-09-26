import { z } from '../zod.js'
import {
  avatarUploadInputSchema,
  mediaStoredAssetSchema,
  mediaStoredVariantSchema,
  mediaProcessingOperationSchema
} from '../api/mediaAssets.js'
import {
  campaignFileMimeTypeSchema,
  campaignFileProfileSchema,
  finalizeImageUploadInputSchema,
  finalizeImageUploadOutputSchema,
  signedCampaignFileDeliveryDtoSchema
} from '../api/media.js'
import { campaignAttachmentDtoSchema } from '../api/campaignAttachments.js'
import { postgresUuidSchema } from '../shared/postgresUuid.js'

/** The uploader label is resolved on read so a deleted account never keeps its username. */
export const campaignStoredAttachmentSchema = z.omit(campaignAttachmentDtoSchema, {
  uploaderLabel: true
})

export const campaignStoredFileVariantSchema = z.discriminatedUnion('mimeType', [
  mediaStoredVariantSchema,
  z.extend(mediaStoredVariantSchema, {
    kind: z.literal('SOURCE'),
    mimeType: z.literal('text/plain'),
    width: z.null(),
    height: z.null()
  })
])

export const campaignStoredFileAssetSchema = z
  .extend(z.omit(mediaStoredAssetSchema, { authoredTarget: true, copiedFromAssetId: true }), {
    profile: campaignFileProfileSchema,
    campaignId: postgresUuidSchema,
    upload: z.extend(avatarUploadInputSchema, { declaredMimeType: campaignFileMimeTypeSchema }),
    variants: z.array(campaignStoredFileVariantSchema).check(z.maxLength(3)),
    crop: z.null(),
    operation: z.nullable(
      z.extend(
        z.omit(mediaProcessingOperationSchema, { crop: true, expectedAvatarRevision: true }),
        { kind: z.literal('INITIAL') }
      )
    )
  })
  .check(
    z.superRefine((asset, ctx) => {
      const text = asset.upload.declaredMimeType === 'text/plain'
      if (text && asset.profile !== 'CAMPAIGN_FILE')
        ctx.addIssue({ code: 'custom', path: ['upload'], message: 'Handout maps must be images.' })
      if (asset.variants.some((variant) => (variant.mimeType === 'text/plain') !== text))
        ctx.addIssue({
          code: 'custom',
          path: ['variants'],
          message: 'File variants must match the upload type.'
        })
    })
  )

export type CampaignStoredFileAsset = z.infer<typeof campaignStoredFileAssetSchema>
export type CampaignStoredFileVariant = z.infer<typeof campaignStoredFileVariantSchema>

export const campaignFileFinalizeInputSchema = z.extend(finalizeImageUploadInputSchema, {
  operationId: z.string().check(z.uuid()),
  variants: z.array(campaignStoredFileVariantSchema).check(z.minLength(1)).check(z.maxLength(3))
})
export const campaignFileProcessClaimSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('CURRENT'),
    result: z.extend(finalizeImageUploadOutputSchema, {
      status: z.literal('READY'),
      preview: z.null()
    })
  }),
  z.strictObject({
    kind: z.literal('PROCESS'),
    asset: campaignStoredFileAssetSchema,
    operation: campaignStoredFileAssetSchema.shape.operation._zod.def.innerType
  })
])
export type CampaignFileProcessClaim = z.infer<typeof campaignFileProcessClaimSchema>
export type CampaignFileFinalizeInput = z.infer<typeof campaignFileFinalizeInputSchema>

// Internal signing input: never return this object-key projection to a client.
export const campaignFileDeliverySourceSchema = z.extend(
  z.omit(signedCampaignFileDeliveryDtoSchema, { url: true, expiresAt: true }),
  { objectKey: mediaStoredVariantSchema.shape.objectKey }
)
export type CampaignFileDeliverySource = z.infer<typeof campaignFileDeliverySourceSchema>
