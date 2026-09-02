import { z } from 'zod'

import { authoredSubjectKindDtoSchema } from './content.js'

export const mediaImageProfileSchema = z.enum([
  'ACCOUNT_AVATAR',
  'CHARACTER_PORTRAIT',
  'AUTHORED_IMAGE'
])
export const campaignFileProfileSchema = z.enum(['CAMPAIGN_FILE', 'CAMPAIGN_HANDOUT_MAP'])
export const vttMapProfileSchema = z.literal('VTT_MAP')
export const mediaProfileSchema = z.union([
  mediaImageProfileSchema,
  campaignFileProfileSchema,
  vttMapProfileSchema
])

export const mediaAssetStatusSchema = z.enum([
  'PENDING_UPLOAD',
  'PROCESSING',
  'READY',
  'REJECTED',
  'DELETED'
])

export const mediaVariantKindSchema = z.enum(['SOURCE', 'DISPLAY', 'THUMBNAIL'])

export const imageMimeTypeSchema = z.enum(['image/jpeg', 'image/png', 'image/webp'])
export const campaignFileMimeTypeSchema = z.enum([
  'image/jpeg',
  'image/png',
  'image/webp',
  'text/plain'
])

export const normalizedImageCropSchema = z
  .strictObject({
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    width: z.number().positive().max(1),
    height: z.number().positive().max(1)
  })
  .superRefine((crop, context) => {
    if (crop.x + crop.width > 1 || crop.y + crop.height > 1) {
      context.addIssue({
        code: 'custom',
        message: 'Crop must stay within the image bounds.'
      })
    }
  })

export const mediaTargetSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('ACCOUNT_AVATAR') }),
  z.strictObject({
    type: z.literal('CHARACTER_PORTRAIT'),
    characterId: z.string().uuid()
  }),
  z.strictObject({
    type: z.literal('AUTHORED_IMAGE'),
    subjectKind: authoredSubjectKindDtoSchema,
    subjectId: z.string().uuid()
  }),
  z.strictObject({
    type: z.literal('CAMPAIGN_FILE'),
    campaignId: z.string().uuid()
  }),
  z.strictObject({
    type: z.literal('CAMPAIGN_HANDOUT_MAP'),
    campaignId: z.string().uuid()
  }),
  z.strictObject({
    type: z.literal('VTT_MAP'),
    campaignId: z.string().uuid()
  })
])

export const createVttMapUploadIntentInputSchema = z
  .strictObject({
    profile: vttMapProfileSchema,
    target: z.strictObject({
      type: z.literal('VTT_MAP'),
      campaignId: z.string().uuid()
    }),
    originalFileName: z.string().trim().min(1).max(255),
    declaredMimeType: imageMimeTypeSchema,
    declaredBytes: z
      .number()
      .int()
      .positive()
      .max(25 * 1024 * 1024),
    idempotencyKey: z.string().uuid()
  })
  .superRefine((input, context) => {
    if (input.profile !== input.target.type) {
      context.addIssue({
        code: 'custom',
        path: ['target'],
        message: 'The upload profile must match its target.'
      })
    }
  })

export const createCampaignFileUploadIntentInputSchema = z
  .strictObject({
    profile: campaignFileProfileSchema,
    target: z.discriminatedUnion('type', [
      z.strictObject({
        type: z.literal('CAMPAIGN_FILE'),
        campaignId: z.string().uuid()
      }),
      z.strictObject({
        type: z.literal('CAMPAIGN_HANDOUT_MAP'),
        campaignId: z.string().uuid()
      })
    ]),
    originalFileName: z.string().trim().min(1).max(255),
    declaredMimeType: campaignFileMimeTypeSchema,
    declaredBytes: z
      .number()
      .int()
      .positive()
      .max(6 * 1024 * 1024),
    idempotencyKey: z.string().uuid()
  })
  .superRefine((input, context) => {
    if (input.profile !== input.target.type)
      context.addIssue({
        code: 'custom',
        path: ['target'],
        message: 'The upload profile must match its target.'
      })
    if (input.profile === 'CAMPAIGN_HANDOUT_MAP' && input.declaredMimeType === 'text/plain')
      context.addIssue({
        code: 'custom',
        path: ['declaredMimeType'],
        message: 'Handout maps must be images.'
      })
  })

export const signedCampaignFileDeliveryDtoSchema = z.strictObject({
  assetId: z.string().uuid(),
  url: z.string().url(),
  expiresAt: z.string().datetime(),
  mimeType: campaignFileMimeTypeSchema,
  fileName: z.string().trim().min(1).max(255),
  byteSize: z.number().int().positive()
})

export const signedImageDeliveryDtoSchema = z.strictObject({
  assetId: z.string().uuid(),
  variantKind: mediaVariantKindSchema,
  url: z.string().url(),
  expiresAt: z.string().datetime(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  mimeType: imageMimeTypeSchema,
  crop: normalizedImageCropSchema.nullable(),
  altText: z.string().trim().min(1).max(240).nullable(),
  isDecorative: z.boolean()
})

export const createImageUploadIntentInputSchema = z
  .strictObject({
    profile: mediaImageProfileSchema,
    target: mediaTargetSchema,
    originalFileName: z.string().trim().min(1).max(255),
    declaredMimeType: imageMimeTypeSchema,
    declaredBytes: z
      .number()
      .int()
      .positive()
      .max(6 * 1024 * 1024),
    idempotencyKey: z.string().uuid()
  })
  .superRefine((input, context) => {
    if (input.profile !== input.target.type) {
      context.addIssue({
        code: 'custom',
        path: ['target'],
        message: 'The upload profile must match its target.'
      })
    }
  })

export const createImageUploadIntentOutputSchema = z.strictObject({
  assetId: z.string().uuid(),
  bucket: z.literal('media'),
  objectKey: z.string().min(1),
  token: z.string().min(1),
  expiresAt: z.string().datetime()
})

export const vttMapMultipartPartUploadSchema = z.strictObject({
  partNumber: z.number().int().min(1).max(5),
  url: z.string().url()
})

export const createVttMapUploadIntentOutputSchema = z.strictObject({
  assetId: z.string().uuid(),
  storageProvider: z.literal('R2'),
  objectKey: z.string().min(1),
  expiresAt: z.string().datetime(),
  resumable: z.strictObject({
    chunkBytes: z.literal(6 * 1024 * 1024),
    protocol: z.literal('R2_MULTIPART'),
    parts: z.array(vttMapMultipartPartUploadSchema).min(1).max(5)
  })
})

export const completeVttMapMultipartUploadInputSchema = z
  .strictObject({
    assetId: z.string().uuid(),
    parts: z
      .array(
        z.strictObject({
          partNumber: z.number().int().min(1).max(5),
          etag: z.string().trim().min(1).max(128)
        })
      )
      .min(1)
      .max(5)
  })
  .superRefine((input, context) => {
    const partNumbers = input.parts.map((part) => part.partNumber)
    if (new Set(partNumbers).size !== partNumbers.length) {
      context.addIssue({ code: 'custom', path: ['parts'], message: 'Upload parts must be unique.' })
    }
  })

export const finalizeImageUploadInputSchema = z.strictObject({
  assetId: z.string().uuid()
})

export const finalizeImageUploadOutputSchema = z.strictObject({
  assetId: z.string().uuid(),
  status: mediaAssetStatusSchema,
  preview: signedImageDeliveryDtoSchema.nullable()
})

export const finalizeVttMapUploadOutputSchema = z.strictObject({
  assetId: z.string().uuid(),
  status: z.enum(['READY', 'REJECTED'])
})

export const vttMapTileDeliveryDtoSchema = z.strictObject({
  column: z.number().int().nonnegative(),
  height: z.number().int().positive(),
  row: z.number().int().nonnegative(),
  url: z.string().url(),
  width: z.number().int().positive()
})

export const signedVttMapDeliveryDtoSchema = z.strictObject({
  assetId: z.string().uuid(),
  expiresAt: z.string().datetime(),
  height: z.number().int().positive().max(8192),
  overview: z.strictObject({
    height: z.number().int().positive(),
    url: z.string().url(),
    width: z.number().int().positive()
  }),
  tiles: z.array(vttMapTileDeliveryDtoSchema).min(1).max(64),
  width: z.number().int().positive().max(8192)
})

export const attachImageInputSchema = z
  .strictObject({
    assetId: z.string().uuid(),
    target: mediaTargetSchema,
    crop: normalizedImageCropSchema.optional(),
    altText: z.string().trim().min(1).max(240).optional(),
    isDecorative: z.boolean().default(false)
  })
  .superRefine((input, context) => {
    if (input.target.type === 'AUTHORED_IMAGE') {
      if (input.crop === undefined) {
        context.addIssue({
          code: 'custom',
          path: ['crop'],
          message: 'Choose a thumbnail crop for authored artwork.'
        })
      }
      if (!input.isDecorative) {
        context.addIssue({
          code: 'custom',
          path: ['isDecorative'],
          message: 'Main authored artwork is decorative.'
        })
      }
      if (input.altText !== undefined) {
        context.addIssue({
          code: 'custom',
          path: ['altText'],
          message: 'Main authored artwork does not accept alt text.'
        })
      }
      return
    }

    if (input.altText !== undefined || input.isDecorative) {
      context.addIssue({
        code: 'custom',
        message: 'Alt text and decorative state only apply to authored images.'
      })
    }
    if (input.crop === undefined) {
      context.addIssue({
        code: 'custom',
        path: ['crop'],
        message: 'Avatar and portrait crops are required.'
      })
    }
  })

export const removeImageInputSchema = z.strictObject({
  target: mediaTargetSchema
})

export const imageLookupTargetSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('ACCOUNT_AVATAR') }),
  z.strictObject({
    type: z.literal('CHARACTER_PORTRAIT'),
    characterId: z.string().uuid()
  }),
  z.strictObject({
    type: z.literal('AUTHORED_IMAGE'),
    subjectKind: authoredSubjectKindDtoSchema,
    subjectId: z.string().uuid(),
    scope: z.enum(['ACTIVE', 'DRAFT'])
  })
])

export const imageLookupInputSchema = z.strictObject({
  target: imageLookupTargetSchema,
  variantKind: mediaVariantKindSchema.default('DISPLAY')
})

export type MediaImageProfile = z.infer<typeof mediaImageProfileSchema>
export type CampaignFileProfile = z.infer<typeof campaignFileProfileSchema>
export type VttMapProfile = z.infer<typeof vttMapProfileSchema>
export type CreateCampaignFileUploadIntentInput = z.infer<
  typeof createCampaignFileUploadIntentInputSchema
>
export type CreateVttMapUploadIntentInput = z.infer<typeof createVttMapUploadIntentInputSchema>
export type SignedCampaignFileDeliveryDto = z.infer<typeof signedCampaignFileDeliveryDtoSchema>
export type MediaAssetStatus = z.infer<typeof mediaAssetStatusSchema>
export type MediaVariantKind = z.infer<typeof mediaVariantKindSchema>
export type NormalizedImageCrop = z.infer<typeof normalizedImageCropSchema>
export type MediaTarget = z.infer<typeof mediaTargetSchema>
export type SignedImageDeliveryDto = z.infer<typeof signedImageDeliveryDtoSchema>
export type CreateImageUploadIntentInput = z.infer<typeof createImageUploadIntentInputSchema>
export type CreateImageUploadIntentOutput = z.infer<typeof createImageUploadIntentOutputSchema>
export type CreateVttMapUploadIntentOutput = z.infer<typeof createVttMapUploadIntentOutputSchema>
export type CompleteVttMapMultipartUploadInput = z.infer<
  typeof completeVttMapMultipartUploadInputSchema
>
export type FinalizeImageUploadInput = z.infer<typeof finalizeImageUploadInputSchema>
export type FinalizeImageUploadOutput = z.infer<typeof finalizeImageUploadOutputSchema>
export type FinalizeVttMapUploadOutput = z.infer<typeof finalizeVttMapUploadOutputSchema>
export type SignedVttMapDeliveryDto = z.infer<typeof signedVttMapDeliveryDtoSchema>
export type AttachImageInput = z.input<typeof attachImageInputSchema>
export type RemoveImageInput = z.infer<typeof removeImageInputSchema>
export type ImageLookupInput = z.input<typeof imageLookupInputSchema>
