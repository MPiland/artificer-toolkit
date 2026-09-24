import { z } from '../zod.js'
import { postgresUuidSchema } from '../shared/postgresUuid.js'
import { projectionChecksumSchema } from '../projections/identity.js'
import { sceneFogChunkDtoSchema } from './vttScenes.js'
import { sceneDefinitionEntityPageInputSchema } from './sceneDefinitionSave.js'
import { campaignListPageSchema } from './campaignList.js'
import { sceneSessionVisionCaptureInputSchema } from './sceneSessionVision.js'

const version = z.number().check(z.int()).check(z.nonnegative())
const ordinal = z.number().check(z.int()).check(z.gte(0)).check(z.lte(255))
const chunkIndex = z.number().check(z.int()).check(z.gte(0)).check(z.lte(65_535))
const dimension = z.number().check(z.int()).check(z.gte(1)).check(z.lte(512))
const chunkCount = z.number().check(z.int()).check(z.gte(0)).check(z.lte(256))
const pageSize = z.number().check(z.int()).check(z.gte(1)).check(z.lte(8))

export const sceneFogPatchInputSchema = z
  .strictObject({
    type: z.literal('PATCH_SCENE_FOG'),
    sceneId: postgresUuidSchema,
    commandId: postgresUuidSchema,
    expectedSceneVersion: version,
    session: z.optional(
      z.pick(sceneSessionVisionCaptureInputSchema, {
        sessionId: true,
        expectedSessionVersion: true,
        expectedPresentationVersion: true
      })
    ),
    layer: z.strictObject({
      ownerUserId: z.nullable(postgresUuidSchema),
      width: dimension,
      height: dimension
    }),
    chunkManifest: z
      .array(z.strictObject({ index: chunkIndex, checksum: projectionChecksumSchema }))
      .check(z.maxLength(256))
  })
  .check(
    z.superRefine((input, ctx) => {
      if (
        new Set(input.chunkManifest.map((chunk) => chunk.index)).size !== input.chunkManifest.length
      )
        ctx.addIssue({
          code: 'custom',
          path: ['chunkManifest'],
          message: 'Fog chunk indexes must be unique.'
        })
    })
  )

export const sceneFogAppendInputSchema = z.strictObject({
  saveId: postgresUuidSchema,
  offset: chunkCount,
  chunks: z.array(sceneFogChunkDtoSchema).check(z.minLength(1)).check(z.maxLength(8))
})
export const sceneFogSaveLookupSchema = z.strictObject({ saveId: postgresUuidSchema })
export const sceneFogSaveProgressSchema = z.strictObject({
  saveId: postgresUuidSchema,
  sceneId: postgresUuidSchema,
  commandId: postgresUuidSchema,
  status: z.enum(['RECEIVING', 'PUBLISHED', 'EXPIRED']),
  receivedChunks: chunkCount,
  totalChunks: chunkCount
})
export const sceneFogCommandResultSchema = z.strictObject({
  sceneId: postgresUuidSchema,
  commandId: postgresUuidSchema,
  version: z.number().check(z.int()).check(z.positive()),
  occurrence: z.null(),
  replayed: z.boolean(),
  patch: z.strictObject({
    saveId: postgresUuidSchema,
    ownerUserId: z.nullable(postgresUuidSchema),
    width: dimension,
    height: dimension,
    chunkCount
  })
})

export const sceneFogChunkReferenceSchema = z.strictObject({
  index: chunkIndex,
  saveId: postgresUuidSchema,
  ordinal,
  checksum: projectionChecksumSchema
})
export const sceneFogLayerHeaderSchema = z.strictObject({
  ownerUserId: z.nullable(postgresUuidSchema),
  width: dimension,
  height: dimension,
  chunkCount,
  ordinal: version
})
export const sceneFogLayersPageInputSchema = z.strictObject({
  sceneId: postgresUuidSchema,
  expectedVersion: z.nullable(version),
  paginationOpts: sceneDefinitionEntityPageInputSchema.shape.paginationOpts
})
export const sceneFogLayersPageSchema = z.extend(campaignListPageSchema, {
  version,
  page: z.array(sceneFogLayerHeaderSchema)
})
export const sceneFogChunksPageInputSchema = z.strictObject({
  sceneId: postgresUuidSchema,
  ownerUserId: z.nullable(postgresUuidSchema),
  expectedVersion: version,
  offset: chunkCount,
  numItems: pageSize
})
export const sceneFogChunksPageSchema = z.strictObject({
  version,
  ownerUserId: z.nullable(postgresUuidSchema),
  width: dimension,
  height: dimension,
  isDone: z.boolean(),
  nextOffset: chunkCount,
  page: z.array(sceneFogChunkDtoSchema).check(z.maxLength(8))
})
export const sceneFogCommandChunksInputSchema = z.strictObject({
  sceneId: postgresUuidSchema,
  commandId: postgresUuidSchema,
  offset: chunkCount,
  numItems: pageSize
})
export const sceneFogCommandChunksPageSchema = z.strictObject({
  result: sceneFogCommandResultSchema,
  isDone: z.boolean(),
  nextOffset: chunkCount,
  page: z.array(sceneFogChunkDtoSchema).check(z.maxLength(8))
})

export type SceneFogPatchInput = z.infer<typeof sceneFogPatchInputSchema>
export type SceneFogAppendInput = z.infer<typeof sceneFogAppendInputSchema>
export type SceneFogSaveProgress = z.infer<typeof sceneFogSaveProgressSchema>
export type SceneFogCommandResult = z.infer<typeof sceneFogCommandResultSchema>
export type SceneFogLayersPageInput = z.infer<typeof sceneFogLayersPageInputSchema>
export type SceneFogLayersPage = z.infer<typeof sceneFogLayersPageSchema>
export type SceneFogChunksPageInput = z.infer<typeof sceneFogChunksPageInputSchema>
export type SceneFogChunksPage = z.infer<typeof sceneFogChunksPageSchema>
export type SceneFogCommandChunksInput = z.infer<typeof sceneFogCommandChunksInputSchema>
export type SceneFogCommandChunksPage = z.infer<typeof sceneFogCommandChunksPageSchema>
