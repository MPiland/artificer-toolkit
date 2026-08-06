import { z } from 'zod'

import { authoredSubjectKindDtoSchema } from './content.js'

export const mediaImageProfileSchema = z.enum([
  'ACCOUNT_AVATAR',
  'CHARACTER_PORTRAIT',
  'AUTHORED_IMAGE'
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

export const normalizedImageCropSchema = z
  .strictObject({
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    width: z.number().positive().max(1),
    height: z.number().positive().max(1)
  })
  .superRefine((crop, context) => {
    if (crop.x + crop.width > 1 || crop.y + crop.height > 1) {
      context.addIssue({ code: 'custom', message: 'Crop must stay within the image bounds.' })
    }
  })

export const mediaTargetSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('ACCOUNT_AVATAR') }),
  z.strictObject({ type: z.literal('CHARACTER_PORTRAIT'), characterId: z.string().uuid() }),
  z.strictObject({
    type: z.literal('AUTHORED_IMAGE'),
    subjectKind: authoredSubjectKindDtoSchema,
    subjectId: z.string().uuid()
  })
])

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

export const finalizeImageUploadInputSchema = z.strictObject({
  assetId: z.string().uuid()
})

export const finalizeImageUploadOutputSchema = z.strictObject({
  assetId: z.string().uuid(),
  status: mediaAssetStatusSchema,
  preview: signedImageDeliveryDtoSchema.nullable()
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

export const removeImageInputSchema = z.strictObject({ target: mediaTargetSchema })

export const imageLookupTargetSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('ACCOUNT_AVATAR') }),
  z.strictObject({ type: z.literal('CHARACTER_PORTRAIT'), characterId: z.string().uuid() }),
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
export type MediaAssetStatus = z.infer<typeof mediaAssetStatusSchema>
export type MediaVariantKind = z.infer<typeof mediaVariantKindSchema>
export type NormalizedImageCrop = z.infer<typeof normalizedImageCropSchema>
export type MediaTarget = z.infer<typeof mediaTargetSchema>
export type SignedImageDeliveryDto = z.infer<typeof signedImageDeliveryDtoSchema>
export type CreateImageUploadIntentInput = z.infer<typeof createImageUploadIntentInputSchema>
export type CreateImageUploadIntentOutput = z.infer<typeof createImageUploadIntentOutputSchema>
export type FinalizeImageUploadInput = z.infer<typeof finalizeImageUploadInputSchema>
export type FinalizeImageUploadOutput = z.infer<typeof finalizeImageUploadOutputSchema>
export type AttachImageInput = z.input<typeof attachImageInputSchema>
export type RemoveImageInput = z.infer<typeof removeImageInputSchema>
export type ImageLookupInput = z.input<typeof imageLookupInputSchema>
