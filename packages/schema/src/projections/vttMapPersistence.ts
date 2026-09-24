import { z } from '../zod.js'
import { mediaStoredAssetSchema, mediaStoredVariantSchema } from '../api/mediaAssets.js'
import {
  createVttMapUploadIntentInputSchema,
  finalizeImageUploadInputSchema,
  finalizeVttMapUploadOutputSchema
} from '../api/media.js'
import { postgresUuidSchema } from '../shared/postgresUuid.js'

const dimension = z.number().check(z.int()).check(z.positive()).check(z.lte(8192))
const tileIndex = z.number().check(z.int()).check(z.gte(0)).check(z.lte(7))
export const vttMapStoredVariantSchema = z.discriminatedUnion('kind', [
  z.extend(mediaStoredVariantSchema, { kind: z.literal('DISPLAY') }),
  z.extend(mediaStoredVariantSchema, { kind: z.literal('THUMBNAIL') }),
  z.extend(mediaStoredVariantSchema, {
    kind: z.literal('TILE'),
    row: tileIndex,
    column: tileIndex,
    width: z.number().check(z.int()).check(z.positive()).check(z.lte(1024)),
    height: z.number().check(z.int()).check(z.positive()).check(z.lte(1024))
  })
])
export const vttMapProcessingOperationSchema = z.strictObject({
  id: postgresUuidSchema,
  kind: z.literal('INITIAL'),
  expiresAt: z.number(),
  // Claim all possible output keys before Node work so interrupted writes are fenced.
  outputs: z
    .array(z.strictObject({ objectKey: z.string().check(z.minLength(1)) }))
    .check(z.minLength(66))
    .check(z.maxLength(66))
})
export const vttMapStoredAssetSchema = z.extend(
  z.omit(mediaStoredAssetSchema, {
    authoredTarget: true,
    characterTarget: true,
    copiedFromAssetId: true
  }),
  {
    profile: z.literal('VTT_MAP'),
    campaignId: postgresUuidSchema,
    hasSceneReferences: z.optional(z.boolean()),
    upload: z.strictObject({
      originalFileName: createVttMapUploadIntentInputSchema.shape.originalFileName,
      declaredMimeType: createVttMapUploadIntentInputSchema.shape.declaredMimeType,
      declaredBytes: createVttMapUploadIntentInputSchema.shape.declaredBytes,
      idempotencyKey: createVttMapUploadIntentInputSchema.shape.idempotencyKey
    }),
    width: z.nullable(dimension),
    height: z.nullable(dimension),
    variants: z.array(vttMapStoredVariantSchema).check(z.maxLength(66)),
    crop: z.null(),
    operation: z.nullable(vttMapProcessingOperationSchema)
  }
)
export const vttMapFinalizeInputSchema = z.extend(finalizeImageUploadInputSchema, {
  operationId: postgresUuidSchema,
  width: dimension,
  height: dimension,
  variants: z.array(vttMapStoredVariantSchema).check(z.minLength(3)).check(z.maxLength(66))
})
export const vttMapProcessClaimSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('CURRENT'),
    result: z.extend(finalizeVttMapUploadOutputSchema, {
      status: z.literal('READY')
    })
  }),
  z.strictObject({
    kind: z.literal('PROCESS'),
    asset: vttMapStoredAssetSchema,
    operation: vttMapProcessingOperationSchema
  })
])
export type VttMapStoredAsset = z.infer<typeof vttMapStoredAssetSchema>
export type VttMapStoredVariant = z.infer<typeof vttMapStoredVariantSchema>
export type VttMapProcessClaim = z.infer<typeof vttMapProcessClaimSchema>
