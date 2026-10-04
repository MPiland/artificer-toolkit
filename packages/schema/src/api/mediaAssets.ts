import { z, lazySchema } from '../zod.js'
import { authoredDraftListInputSchema } from './authoredDrafts.js'
import {
  imageMimeTypeSchema,
  normalizedImageCropSchema,
  mediaAssetStatusSchema,
  mediaVariantKindSchema,
  mediaTargetSchema,
  imageLookupTargetSchema
} from './media.js'

/**
 * Assets are interchangeable within a class (ADR 0012, 2026-09-27 amendment): content art serves
 * avatars, portraits and authored artwork; maps stay apart.
 */
export const mediaProfileClassSchema = lazySchema(() => z.enum(['CONTENT_ART', 'VTT_MAP']))
/** SHA-256 hex digest: normalized bytes for de-duplication, or a canonical crop. */
export const mediaSha256Schema = lazySchema(() => z.string().check(z.regex(/^[0-9a-f]{64}$/)))

export const avatarUploadInputSchema = lazySchema(() =>
  z.strictObject({
    originalFileName: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(255)),
    declaredMimeType: imageMimeTypeSchema,
    declaredBytes: z
      .number()
      .check(z.int())
      .check(z.positive())
      .check(z.lte(6 * 1024 * 1024)),
    idempotencyKey: z.string().check(z.uuid())
  })
)
export const mediaSinglePutUploadSchema = lazySchema(() =>
  z.strictObject({
    assetId: z.string().check(z.uuid()),
    method: z.literal('PUT'),
    url: z.string().check(z.url()),
    expiresAt: z.iso.datetime()
  })
)
export const avatarSaveInputSchema = lazySchema(() =>
  z.strictObject({
    assetId: z.string().check(z.uuid()),
    crop: normalizedImageCropSchema
  })
)
export const avatarBindingSchema = lazySchema(() =>
  z.strictObject({
    assetId: z.nullable(z.string().check(z.uuid())),
    revision: z.number().check(z.int()).check(z.nonnegative())
  })
)
export const mediaStoredVariantSchema = lazySchema(() =>
  z.strictObject({
    kind: mediaVariantKindSchema,
    objectKey: z.string().check(z.minLength(1)),
    byteSize: z.number().check(z.int()).check(z.positive()),
    width: z.number().check(z.int()).check(z.positive()),
    height: z.number().check(z.int()).check(z.positive()),
    mimeType: z.literal('image/webp')
  })
)
/** A thumbnail derived from SOURCE for one crop; any reference using that crop shares it. */
export const mediaCropThumbnailSchema = lazySchema(() =>
  z.strictObject({
    cropHash: mediaSha256Schema,
    crop: normalizedImageCropSchema,
    variant: z.extend(mediaStoredVariantSchema, { kind: z.literal('THUMBNAIL') })
  })
)

export const authoredImageTargetSchema = lazySchema(() => mediaTargetSchema._zod.def.options[2])
export const authoredImageLookupSchema = lazySchema(
  () => imageLookupTargetSchema._zod.def.options[2]
)
export const characterPortraitTargetSchema = lazySchema(() => mediaTargetSchema._zod.def.options[1])
export const characterPortraitLookupSchema = lazySchema(
  () => imageLookupTargetSchema._zod.def.options[1]
)
/** The cropped image slots a user fills with their own content art. */
export const mediaImageSlotTargetSchema = lazySchema(() =>
  z.discriminatedUnion('type', [
    mediaTargetSchema._zod.def.options[0],
    characterPortraitTargetSchema,
    authoredImageTargetSchema
  ])
)
/** Server-only: the slot an upload binds to once processing settles, fenced by its revision. */
export const mediaImageBindingSchema = lazySchema(() =>
  z.discriminatedUnion('type', [
    z.strictObject({
      type: z.literal('ACCOUNT_AVATAR'),
      crop: normalizedImageCropSchema,
      expectedRevision: z.number().check(z.int()).check(z.nonnegative())
    }),
    z.extend(characterPortraitTargetSchema, {
      crop: normalizedImageCropSchema,
      expectedRevision: z.number().check(z.int()).check(z.nonnegative())
    }),
    z.extend(authoredImageTargetSchema, {
      draftId: z.string().check(z.minLength(1)),
      crop: normalizedImageCropSchema,
      expectedRevision: z.number().check(z.int()).check(z.nonnegative())
    })
  ])
)

// Server-only processing state; never an action argument or public media projection.
export const mediaProcessingOperationSchema = lazySchema(() =>
  z.strictObject({
    id: z.string().check(z.uuid()),
    expiresAt: z.number(),
    outputs: z
      .array(
        z.strictObject({
          kind: mediaVariantKindSchema,
          objectKey: z.string().check(z.minLength(1))
        })
      )
      .check(z.minLength(1))
      .check(z.maxLength(3)),
    binding: z.nullable(mediaImageBindingSchema)
  })
)
export const authoredImageUploadSchema = lazySchema(() =>
  z.extend(avatarUploadInputSchema, {
    target: authoredImageTargetSchema
  })
)
export const authoredImageSaveSchema = lazySchema(() =>
  z.extend(avatarSaveInputSchema, {
    target: authoredImageTargetSchema
  })
)
export const characterPortraitUploadSchema = lazySchema(() =>
  z.extend(avatarUploadInputSchema, {
    target: characterPortraitTargetSchema
  })
)
export const characterPortraitSaveSchema = lazySchema(() =>
  z.extend(avatarSaveInputSchema, {
    target: characterPortraitTargetSchema
  })
)
export const authoredImageSlotSchema = lazySchema(() =>
  z
    .strictObject({
      subjectKind: authoredImageTargetSchema.shape.subjectKind,
      subjectId: authoredImageTargetSchema.shape.subjectId,
      importJobId: z.optional(z.string().check(z.uuid())),
      scope: z.enum(['ACTIVE', 'DRAFT']),
      assetId: z.nullable(z.string().check(z.uuid())),
      crop: z.nullable(normalizedImageCropSchema),
      revision: z.number().check(z.int()).check(z.nonnegative())
    })
    .check(
      z.superRefine((slot, context) => {
        if ((slot.assetId === null) !== (slot.crop === null))
          context.addIssue({
            code: 'custom',
            path: ['crop'],
            message: 'Artwork framing belongs to the attached image.'
          })
      })
    )
)
/** A stored content-art asset; map rows extend its fields. */
export const mediaStoredAssetSchema = lazySchema(() =>
  z.strictObject({
    id: z.string().check(z.uuid()),
    ownerUserId: z.string().check(z.uuid()),
    /** The asset whose stored objects these variants are; a retained Campaign copy shares its source's. */
    storageAssetId: z.string().check(z.uuid()),
    profileClass: z.literal('CONTENT_ART'),
    upload: avatarUploadInputSchema,
    status: mediaAssetStatusSchema,
    rawObjectKey: z.nullable(z.string()),
    uploadExpiresAt: z.number(),
    chargedBytes: z.number().check(z.int()).check(z.nonnegative()),
    contentHash: z.nullable(mediaSha256Schema),
    variants: z.array(mediaStoredVariantSchema).check(z.maxLength(3)),
    cropThumbnails: z.array(mediaCropThumbnailSchema).check(z.maxLength(32)),
    operation: z.nullable(mediaProcessingOperationSchema),
    cleanupAt: z.nullable(z.number())
  })
)
export const mediaProcessClaimSchema = lazySchema(() =>
  z.discriminatedUnion('kind', [
    z.strictObject({ kind: z.literal('CURRENT'), binding: avatarBindingSchema }),
    z.strictObject({
      kind: z.literal('PROCESS'),
      asset: mediaStoredAssetSchema,
      operation: mediaProcessingOperationSchema
    })
  ])
)
export const mediaImageSaveSettlementSchema = lazySchema(() =>
  z.strictObject({
    assetId: z.string().check(z.uuid()),
    operationId: z.string().check(z.uuid()),
    variants: z.array(mediaStoredVariantSchema).check(z.minLength(3)).check(z.maxLength(3)),
    contentHash: mediaSha256Schema
  })
)
/** A slot's asset with that slot's own crop; reads never borrow another reference's framing. */
export const mediaReferencedImageSchema = lazySchema(() =>
  z.strictObject({
    asset: mediaStoredAssetSchema,
    crop: z.nullable(normalizedImageCropSchema)
  })
)
export const mediaCropThumbnailClaimSchema = lazySchema(() =>
  z.discriminatedUnion('kind', [
    z.strictObject({ kind: z.literal('READY'), variant: mediaCropThumbnailSchema.shape.variant }),
    z.strictObject({ kind: z.literal('GENERATE'), objectKey: z.string().check(z.minLength(1)) })
  ])
)

export const mediaLibraryListInputSchema = lazySchema(() =>
  z.strictObject({
    profileClass: mediaProfileClassSchema,
    paginationOpts: authoredDraftListInputSchema.shape.paginationOpts
  })
)
export const mediaLibraryItemDtoSchema = lazySchema(() =>
  z.strictObject({
    assetId: z.string().check(z.uuid()),
    profileClass: mediaProfileClassSchema,
    originalFileName: avatarUploadInputSchema.shape.originalFileName,
    width: z.nullable(z.number().check(z.int()).check(z.positive())),
    height: z.nullable(z.number().check(z.int()).check(z.positive())),
    createdAt: z.iso.datetime()
  })
)
export const mediaLibraryPageSchema = lazySchema(() =>
  z.strictObject({
    page: z.array(mediaLibraryItemDtoSchema),
    isDone: z.boolean(),
    continueCursor: z.string(),
    splitCursor: z.optional(z.nullable(z.string())),
    pageStatus: z.optional(z.nullable(z.enum(['SplitRecommended', 'SplitRequired'])))
  })
)
export const mediaLibraryImageInputSchema = lazySchema(() =>
  z.strictObject({
    assetId: z.string().check(z.uuid()),
    variantKind: mediaVariantKindSchema
  })
)
export const mediaImageAttachInputSchema = lazySchema(() =>
  z.strictObject({
    target: mediaImageSlotTargetSchema,
    assetId: z.string().check(z.uuid()),
    crop: normalizedImageCropSchema
  })
)

export type MediaProfileClass = z.infer<typeof mediaProfileClassSchema>
export type MediaStoredAsset = z.infer<typeof mediaStoredAssetSchema>
export type MediaStoredVariant = z.infer<typeof mediaStoredVariantSchema>
export type MediaCropThumbnail = z.infer<typeof mediaCropThumbnailSchema>
export type MediaCropThumbnailClaim = z.infer<typeof mediaCropThumbnailClaimSchema>
export type MediaProcessingOperation = z.infer<typeof mediaProcessingOperationSchema>
export type MediaImageBinding = z.infer<typeof mediaImageBindingSchema>
export type MediaImageSlotTarget = z.infer<typeof mediaImageSlotTargetSchema>
export type MediaReferencedImage = z.infer<typeof mediaReferencedImageSchema>
export type MediaImageSaveSettlement = z.infer<typeof mediaImageSaveSettlementSchema>
export type AvatarBindingDto = z.infer<typeof avatarBindingSchema>
export type ImageUploadMetadata = z.infer<typeof avatarUploadInputSchema>
export type MediaProcessClaim = z.infer<typeof mediaProcessClaimSchema>
export type AuthoredImageTarget = z.infer<typeof authoredImageTargetSchema>
export type AuthoredImageLookup = z.infer<typeof authoredImageLookupSchema>
export type CharacterPortraitTarget = z.infer<typeof characterPortraitTargetSchema>
export type CharacterPortraitLookup = z.infer<typeof characterPortraitLookupSchema>
export type MediaLibraryListInput = z.infer<typeof mediaLibraryListInputSchema>
export type MediaLibraryItemDto = z.infer<typeof mediaLibraryItemDtoSchema>
export type MediaLibraryPage = z.infer<typeof mediaLibraryPageSchema>
export type MediaImageAttachInput = z.infer<typeof mediaImageAttachInputSchema>
