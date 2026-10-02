import { z, lazySchema } from '../zod.js'
import { postgresUuidSchema } from '../shared/postgresUuid.js'
import { projectionChecksumSchema } from '../projections/identity.js'
import { sceneFogChunkDtoSchema } from './vttScenes.js'
import { sceneDefinitionEntityPageInputSchema } from './sceneDefinitionSave.js'
import { campaignListPageSchema } from './campaignList.js'
import { sceneSessionVisionCaptureInputSchema } from './sceneSessionVision.js'

const version = lazySchema(() => z.number().check(z.int()).check(z.nonnegative()))
const ordinal = lazySchema(() => z.number().check(z.int()).check(z.gte(0)).check(z.lte(255)))
const chunkIndex = lazySchema(() => z.number().check(z.int()).check(z.gte(0)).check(z.lte(65_535)))
const dimension = lazySchema(() => z.number().check(z.int()).check(z.gte(1)).check(z.lte(512)))
const chunkCount = lazySchema(() => z.number().check(z.int()).check(z.gte(0)).check(z.lte(256)))
const pageSize = lazySchema(() => z.number().check(z.int()).check(z.gte(1)).check(z.lte(8)))

export const sceneFogPatchInputSchema = lazySchema(() =>
  z
    .strictObject({
      type: z.literal('PATCH_SCENE_FOG'),
      sceneId: postgresUuidSchema,
      commandId: postgresUuidSchema,
      expectedSceneVersion: version,
      presentation: z.optional(
        z.pick(sceneSessionVisionCaptureInputSchema, { expectedPresentationVersion: true })
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
          new Set(input.chunkManifest.map((chunk) => chunk.index)).size !==
          input.chunkManifest.length
        )
          ctx.addIssue({
            code: 'custom',
            path: ['chunkManifest'],
            message: 'Fog chunk indexes must be unique.'
          })
      })
    )
)

export const sceneFogAppendInputSchema = lazySchema(() =>
  z.strictObject({
    saveId: postgresUuidSchema,
    offset: chunkCount,
    chunks: z.array(sceneFogChunkDtoSchema).check(z.minLength(1)).check(z.maxLength(8))
  })
)
/**
 * The live room's journaled publication of a fog patch the GM staged over the socket with
 * `SCENE_FOG_BEGIN` and `SCENE_FOG_APPEND`; it carries the begin's Scene, command and version.
 */
export const sceneFogPublishCommandInputSchema = lazySchema(() =>
  z.strictObject({
    type: z.literal('PUBLISH_SCENE_FOG_PATCH'),
    sceneId: postgresUuidSchema,
    commandId: postgresUuidSchema,
    expectedSceneVersion: version,
    saveId: postgresUuidSchema
  })
)
export const sceneFogSaveLookupSchema = lazySchema(() =>
  z.strictObject({ saveId: postgresUuidSchema })
)
export const sceneFogSaveProgressSchema = lazySchema(() =>
  z.strictObject({
    saveId: postgresUuidSchema,
    sceneId: postgresUuidSchema,
    commandId: postgresUuidSchema,
    status: z.enum(['RECEIVING', 'PUBLISHED', 'EXPIRED']),
    receivedChunks: chunkCount,
    totalChunks: chunkCount
  })
)
export const sceneFogCommandResultSchema = lazySchema(() =>
  z.strictObject({
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
)

export const sceneFogChunkReferenceSchema = lazySchema(() =>
  z.strictObject({
    index: chunkIndex,
    saveId: postgresUuidSchema,
    ordinal,
    checksum: projectionChecksumSchema
  })
)
export const sceneFogLayerHeaderSchema = lazySchema(() =>
  z.strictObject({
    ownerUserId: z.nullable(postgresUuidSchema),
    width: dimension,
    height: dimension,
    chunkCount,
    ordinal: version
  })
)
export const sceneFogLayersPageInputSchema = lazySchema(() =>
  z.strictObject({
    sceneId: postgresUuidSchema,
    expectedVersion: z.nullable(version),
    paginationOpts: sceneDefinitionEntityPageInputSchema.shape.paginationOpts
  })
)
export const sceneFogLayersPageSchema = lazySchema(() =>
  z.extend(campaignListPageSchema, {
    version,
    page: z.array(sceneFogLayerHeaderSchema)
  })
)
export const sceneFogChunksPageInputSchema = lazySchema(() =>
  z.strictObject({
    sceneId: postgresUuidSchema,
    ownerUserId: z.nullable(postgresUuidSchema),
    expectedVersion: version,
    offset: chunkCount,
    numItems: pageSize
  })
)
export const sceneFogChunksPageSchema = lazySchema(() =>
  z.strictObject({
    version,
    ownerUserId: z.nullable(postgresUuidSchema),
    width: dimension,
    height: dimension,
    isDone: z.boolean(),
    nextOffset: chunkCount,
    page: z.array(sceneFogChunkDtoSchema).check(z.maxLength(8))
  })
)
export const sceneFogCommandChunksInputSchema = lazySchema(() =>
  z.strictObject({
    sceneId: postgresUuidSchema,
    commandId: postgresUuidSchema,
    offset: chunkCount,
    numItems: pageSize
  })
)
export const sceneFogCommandChunksPageSchema = lazySchema(() =>
  z.strictObject({
    result: sceneFogCommandResultSchema,
    isDone: z.boolean(),
    nextOffset: chunkCount,
    page: z.array(sceneFogChunkDtoSchema).check(z.maxLength(8))
  })
)

export type SceneFogPatchInput = z.infer<typeof sceneFogPatchInputSchema>
export type SceneFogAppendInput = z.infer<typeof sceneFogAppendInputSchema>
export type SceneFogPublishCommandInput = z.infer<typeof sceneFogPublishCommandInputSchema>
export type SceneFogSaveProgress = z.infer<typeof sceneFogSaveProgressSchema>
export type SceneFogCommandResult = z.infer<typeof sceneFogCommandResultSchema>
export type SceneFogLayersPageInput = z.infer<typeof sceneFogLayersPageInputSchema>
export type SceneFogLayersPage = z.infer<typeof sceneFogLayersPageSchema>
export type SceneFogChunksPageInput = z.infer<typeof sceneFogChunksPageInputSchema>
export type SceneFogChunksPage = z.infer<typeof sceneFogChunksPageSchema>
export type SceneFogCommandChunksInput = z.infer<typeof sceneFogCommandChunksInputSchema>
export type SceneFogCommandChunksPage = z.infer<typeof sceneFogCommandChunksPageSchema>
