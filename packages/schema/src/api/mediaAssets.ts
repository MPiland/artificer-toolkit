import { z } from '../zod.js'
import {
  imageMimeTypeSchema,
  normalizedImageCropSchema,
  mediaAssetStatusSchema,
  mediaVariantKindSchema,
  mediaTargetSchema,
  imageLookupTargetSchema
} from './media.js'

export const avatarUploadInputSchema = z.strictObject({
  originalFileName: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(255)),
  declaredMimeType: imageMimeTypeSchema,
  declaredBytes: z
    .number()
    .check(z.int())
    .check(z.positive())
    .check(z.lte(6 * 1024 * 1024)),
  idempotencyKey: z.string().check(z.uuid())
})
export const mediaSinglePutUploadSchema = z.strictObject({
  assetId: z.string().check(z.uuid()),
  method: z.literal('PUT'),
  url: z.string().check(z.url()),
  expiresAt: z.iso.datetime()
})
export const avatarSaveInputSchema = z.strictObject({
  assetId: z.string().check(z.uuid()),
  crop: normalizedImageCropSchema
})
export const avatarBindingSchema = z.strictObject({
  assetId: z.nullable(z.string().check(z.uuid())),
  revision: z.number().check(z.int()).check(z.nonnegative())
})
export const mediaStoredVariantSchema = z.strictObject({
  kind: mediaVariantKindSchema,
  objectKey: z.string().check(z.minLength(1)),
  byteSize: z.number().check(z.int()).check(z.positive()),
  width: z.number().check(z.int()).check(z.positive()),
  height: z.number().check(z.int()).check(z.positive()),
  mimeType: z.literal('image/webp')
})

// Server-only processing state; never an action argument or public media projection.
export const mediaProcessingOperationSchema = z.strictObject({
  id: z.string().check(z.uuid()),
  kind: z.enum(['INITIAL', 'CROP']),
  crop: normalizedImageCropSchema,
  expectedAvatarRevision: z.number().check(z.int()).check(z.nonnegative()),
  expiresAt: z.number(),
  outputs: z
    .array(
      z.strictObject({
        kind: mediaVariantKindSchema,
        objectKey: z.string().check(z.minLength(1))
      })
    )
    .check(z.minLength(1))
    .check(z.maxLength(3))
})
export const authoredImageTargetSchema = mediaTargetSchema._zod.def.options[2]
export const authoredImageLookupSchema = imageLookupTargetSchema._zod.def.options[2]
export const characterPortraitTargetSchema = mediaTargetSchema._zod.def.options[1]
export const characterPortraitLookupSchema = imageLookupTargetSchema._zod.def.options[1]
export const authoredImageUploadSchema = z.extend(avatarUploadInputSchema, {
  target: authoredImageTargetSchema
})
export const authoredImageSaveSchema = z.extend(avatarSaveInputSchema, {
  target: authoredImageTargetSchema
})
export const characterPortraitUploadSchema = z.extend(avatarUploadInputSchema, {
  target: characterPortraitTargetSchema
})
export const characterPortraitSaveSchema = z.extend(avatarSaveInputSchema, {
  target: characterPortraitTargetSchema
})
export const authoredImageSlotSchema = z.strictObject({
  subjectKind: authoredImageTargetSchema.shape.subjectKind,
  subjectId: authoredImageTargetSchema.shape.subjectId,
  importJobId: z.optional(z.string().check(z.uuid())),
  scope: z.enum(['ACTIVE', 'DRAFT']),
  assetId: z.nullable(z.string().check(z.uuid())),
  revision: z.number().check(z.int()).check(z.nonnegative())
})
export const authoredImageOperationSchema = z.extend(
  z.omit(mediaProcessingOperationSchema, { expectedAvatarRevision: true }),
  {
    target: authoredImageTargetSchema,
    draftId: z.string().check(z.minLength(1)),
    expectedSlotRevision: z.number().check(z.int()).check(z.nonnegative()),
    sourceVariants: z.optional(
      z.strictObject({
        source: mediaStoredVariantSchema,
        display: mediaStoredVariantSchema
      })
    )
  }
)
export const characterPortraitOperationSchema = z.extend(
  z.omit(mediaProcessingOperationSchema, { expectedAvatarRevision: true }),
  {
    target: characterPortraitTargetSchema,
    expectedPortraitRevision: z.number().check(z.int()).check(z.nonnegative())
  }
)
export const mediaStoredAssetSchema = z.strictObject({
  id: z.string().check(z.uuid()),
  ownerUserId: z.string().check(z.uuid()),
  retainedFromUserId: z.optional(z.string().check(z.uuid())),
  profile: z.enum(['ACCOUNT_AVATAR', 'CHARACTER_PORTRAIT', 'AUTHORED_IMAGE']),
  authoredTarget: z.optional(authoredImageTargetSchema),
  characterTarget: z.optional(characterPortraitTargetSchema),
  copiedFromAssetId: z.optional(z.string().check(z.uuid())),
  upload: avatarUploadInputSchema,
  status: mediaAssetStatusSchema,
  rawObjectKey: z.nullable(z.string()),
  uploadExpiresAt: z.number(),
  chargedBytes: z.number().check(z.int()).check(z.nonnegative()),
  variants: z.array(mediaStoredVariantSchema).check(z.maxLength(3)),
  crop: z.nullable(normalizedImageCropSchema),
  operation: z.nullable(
    z.union([
      mediaProcessingOperationSchema,
      authoredImageOperationSchema,
      characterPortraitOperationSchema
    ])
  ),
  cleanupAt: z.nullable(z.number())
})
export const authoredImageProcessClaimSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('CURRENT'), binding: avatarBindingSchema }),
  z.strictObject({
    kind: z.literal('PROCESS'),
    asset: mediaStoredAssetSchema,
    operation: authoredImageOperationSchema
  })
])
export const mediaProcessClaimSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('CURRENT'), binding: avatarBindingSchema }),
  z.strictObject({
    kind: z.literal('PROCESS'),
    asset: mediaStoredAssetSchema,
    operation: mediaProcessingOperationSchema
  })
])
export const characterPortraitProcessClaimSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('CURRENT'),
    binding: avatarBindingSchema
  }),
  z.strictObject({
    kind: z.literal('PROCESS'),
    asset: mediaStoredAssetSchema,
    operation: characterPortraitOperationSchema
  })
])
export type MediaStoredAsset = z.infer<typeof mediaStoredAssetSchema>
export type MediaStoredVariant = z.infer<typeof mediaStoredVariantSchema>
export type AvatarBindingDto = z.infer<typeof avatarBindingSchema>
export type ImageUploadMetadata = z.infer<typeof avatarUploadInputSchema>
export type MediaProcessClaim = z.infer<typeof mediaProcessClaimSchema>
export type AuthoredImageTarget = z.infer<typeof authoredImageTargetSchema>
export type AuthoredImageLookup = z.infer<typeof authoredImageLookupSchema>
export type AuthoredImageProcessClaim = z.infer<typeof authoredImageProcessClaimSchema>
export type CharacterPortraitTarget = z.infer<typeof characterPortraitTargetSchema>
export type CharacterPortraitLookup = z.infer<typeof characterPortraitLookupSchema>
export type CharacterPortraitProcessClaim = z.infer<typeof characterPortraitProcessClaimSchema>
