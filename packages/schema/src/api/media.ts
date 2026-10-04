import { z, lazySchema } from '../zod.js'

import { authoredSubjectKindSchema } from '../projections/identity.js'
import { postgresUuidSchema } from '../shared/postgresUuid.js'

export const mediaImageProfileSchema = lazySchema(() =>
  z.enum(['ACCOUNT_AVATAR', 'CHARACTER_PORTRAIT', 'AUTHORED_IMAGE'])
)
export const vttMapProfileSchema = lazySchema(() => z.literal('VTT_MAP'))
export const mediaProfileSchema = lazySchema(() =>
  z.union([mediaImageProfileSchema, vttMapProfileSchema])
)

export const mediaAssetStatusSchema = lazySchema(() =>
  z.enum(['PENDING_UPLOAD', 'PROCESSING', 'READY', 'REJECTED', 'DELETED'])
)

export const mediaVariantKindSchema = lazySchema(() => z.enum(['SOURCE', 'DISPLAY', 'THUMBNAIL']))

export const imageMimeTypeSchema = lazySchema(() =>
  z.enum(['image/jpeg', 'image/png', 'image/webp'])
)

export const normalizedImageCropSchema = lazySchema(() =>
  z
    .strictObject({
      x: z.number().check(z.gte(0)).check(z.lte(1)),
      y: z.number().check(z.gte(0)).check(z.lte(1)),
      width: z.number().check(z.positive()).check(z.lte(1)),
      height: z.number().check(z.positive()).check(z.lte(1))
    })
    .check(
      z.superRefine((crop, context) => {
        if (crop.x + crop.width > 1 || crop.y + crop.height > 1) {
          context.addIssue({
            code: 'custom',
            message: 'Crop must stay within the image bounds.'
          })
        }
      })
    )
)

export const mediaTargetSchema = lazySchema(() =>
  z.discriminatedUnion('type', [
    z.strictObject({ type: z.literal('ACCOUNT_AVATAR') }),
    z.strictObject({
      type: z.literal('CHARACTER_PORTRAIT'),
      characterId: z.string().check(z.uuid())
    }),
    z.strictObject({
      type: z.literal('AUTHORED_IMAGE'),
      subjectKind: authoredSubjectKindSchema,
      subjectId: postgresUuidSchema
    }),
    z.strictObject({
      type: z.literal('VTT_MAP'),
      campaignId: z.string().check(z.uuid())
    })
  ])
)

export const createVttMapUploadIntentInputSchema = lazySchema(() =>
  z
    .strictObject({
      profile: vttMapProfileSchema,
      target: z.strictObject({
        type: z.literal('VTT_MAP'),
        campaignId: z.string().check(z.uuid())
      }),
      originalFileName: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(255)),
      declaredMimeType: imageMimeTypeSchema,
      declaredBytes: z
        .number()
        .check(z.int())
        .check(z.positive())
        .check(z.lte(25 * 1024 * 1024)),
      idempotencyKey: z.string().check(z.uuid())
    })
    .check(
      z.superRefine((input, context) => {
        if (input.profile !== input.target.type) {
          context.addIssue({
            code: 'custom',
            path: ['target'],
            message: 'The upload profile must match its target.'
          })
        }
      })
    )
)

export const signedImageDeliveryDtoSchema = lazySchema(() =>
  z.strictObject({
    assetId: z.string().check(z.uuid()),
    variantKind: mediaVariantKindSchema,
    url: z.string().check(z.url()),
    expiresAt: z.iso.datetime(),
    width: z.number().check(z.int()).check(z.positive()),
    height: z.number().check(z.int()).check(z.positive()),
    mimeType: imageMimeTypeSchema,
    crop: z.nullable(normalizedImageCropSchema),
    altText: z.nullable(z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(240))),
    isDecorative: z.boolean()
  })
)

export const createImageUploadIntentInputSchema = lazySchema(() =>
  z
    .strictObject({
      profile: mediaImageProfileSchema,
      target: mediaTargetSchema,
      originalFileName: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(255)),
      declaredMimeType: imageMimeTypeSchema,
      declaredBytes: z
        .number()
        .check(z.int())
        .check(z.positive())
        .check(z.lte(6 * 1024 * 1024)),
      idempotencyKey: z.string().check(z.uuid())
    })
    .check(
      z.superRefine((input, context) => {
        if (input.profile !== input.target.type) {
          context.addIssue({
            code: 'custom',
            path: ['target'],
            message: 'The upload profile must match its target.'
          })
        }
      })
    )
)

export const createImageUploadIntentOutputSchema = lazySchema(() =>
  z.strictObject({
    assetId: z.string().check(z.uuid()),
    bucket: z.literal('media'),
    objectKey: z.string().check(z.minLength(1)),
    token: z.string().check(z.minLength(1)),
    expiresAt: z.iso.datetime()
  })
)

export const vttMapMultipartPartUploadSchema = lazySchema(() =>
  z.strictObject({
    partNumber: z.number().check(z.int()).check(z.gte(1)).check(z.lte(5)),
    url: z.string().check(z.url())
  })
)

export const createVttMapUploadIntentOutputSchema = lazySchema(() =>
  z.strictObject({
    assetId: z.string().check(z.uuid()),
    storageProvider: z.literal('R2'),
    objectKey: z.string().check(z.minLength(1)),
    expiresAt: z.iso.datetime(),
    resumable: z.strictObject({
      chunkBytes: z.literal(6 * 1024 * 1024),
      protocol: z.literal('R2_MULTIPART'),
      parts: z.array(vttMapMultipartPartUploadSchema).check(z.minLength(1)).check(z.maxLength(5))
    })
  })
)

export const completeVttMapMultipartUploadInputSchema = lazySchema(() =>
  z
    .strictObject({
      assetId: z.string().check(z.uuid()),
      parts: z
        .array(
          z.strictObject({
            partNumber: z.number().check(z.int()).check(z.gte(1)).check(z.lte(5)),
            etag: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(128))
          })
        )
        .check(z.minLength(1))
        .check(z.maxLength(5))
    })
    .check(
      z.superRefine((input, context) => {
        const partNumbers = input.parts.map((part) => part.partNumber)
        if (new Set(partNumbers).size !== partNumbers.length) {
          context.addIssue({
            code: 'custom',
            path: ['parts'],
            message: 'Upload parts must be unique.'
          })
        }
      })
    )
)

export const finalizeImageUploadInputSchema = lazySchema(() =>
  z.strictObject({
    assetId: z.string().check(z.uuid())
  })
)

export const finalizeImageUploadOutputSchema = lazySchema(() =>
  z.strictObject({
    assetId: z.string().check(z.uuid()),
    status: mediaAssetStatusSchema,
    preview: z.nullable(signedImageDeliveryDtoSchema)
  })
)

export const finalizeVttMapUploadOutputSchema = lazySchema(() =>
  z.strictObject({
    assetId: z.string().check(z.uuid()),
    status: z.enum(['READY', 'REJECTED'])
  })
)

export const vttMapTileDeliveryDtoSchema = lazySchema(() =>
  z.strictObject({
    column: z.number().check(z.int()).check(z.nonnegative()),
    height: z.number().check(z.int()).check(z.positive()),
    row: z.number().check(z.int()).check(z.nonnegative()),
    url: z.string().check(z.url()),
    width: z.number().check(z.int()).check(z.positive())
  })
)

export const signedVttMapDeliveryDtoSchema = lazySchema(() =>
  z.strictObject({
    assetId: z.string().check(z.uuid()),
    expiresAt: z.iso.datetime(),
    height: z.number().check(z.int()).check(z.positive()).check(z.lte(8192)),
    overview: z.strictObject({
      height: z.number().check(z.int()).check(z.positive()),
      url: z.string().check(z.url()),
      width: z.number().check(z.int()).check(z.positive())
    }),
    tiles: z.array(vttMapTileDeliveryDtoSchema).check(z.minLength(1)).check(z.maxLength(64)),
    width: z.number().check(z.int()).check(z.positive()).check(z.lte(8192))
  })
)

export const attachImageInputSchema = lazySchema(() =>
  z
    .strictObject({
      assetId: z.string().check(z.uuid()),
      target: mediaTargetSchema,
      crop: z.optional(normalizedImageCropSchema),
      altText: z.optional(z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(240))),
      isDecorative: z._default(z.boolean(), false)
    })
    .check(
      z.superRefine((input, context) => {
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
    )
)

export const removeImageInputSchema = lazySchema(() =>
  z.strictObject({
    target: mediaTargetSchema
  })
)

export const imageLookupTargetSchema = lazySchema(() =>
  z.discriminatedUnion('type', [
    z.strictObject({ type: z.literal('ACCOUNT_AVATAR') }),
    z.strictObject({
      type: z.literal('CHARACTER_PORTRAIT'),
      characterId: z.string().check(z.uuid()),
      /**
       * Campaign scope: any active member reads the portrait of a Character assigned in that Campaign
       * (ADR 0034 decision 5). Without it, only the Character's owner reads it.
       */
      campaignId: z.optional(z.string().check(z.uuid()))
    }),
    z.strictObject({
      type: z.literal('AUTHORED_IMAGE'),
      subjectKind: authoredSubjectKindSchema,
      subjectId: postgresUuidSchema,
      scope: z.enum(['ACTIVE', 'DRAFT'])
    })
  ])
)

export const imageLookupInputSchema = lazySchema(() =>
  z.strictObject({
    target: imageLookupTargetSchema,
    variantKind: z._default(mediaVariantKindSchema, 'DISPLAY')
  })
)

export type MediaImageProfile = z.infer<typeof mediaImageProfileSchema>
export type VttMapProfile = z.infer<typeof vttMapProfileSchema>
export type CreateVttMapUploadIntentInput = z.infer<typeof createVttMapUploadIntentInputSchema>
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
