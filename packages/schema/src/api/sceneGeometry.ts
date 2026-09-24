import { VTT_SCENE_LIMITS } from '@artificer-toolkit/shared/vtt/scene'
import { encounterRuleOccurrenceSummaryDtoSchema } from '../shared/encounterRuleOccurrence.js'
import { z } from '../zod.js'
import {
  sceneBarrierDtoSchema,
  sceneTokenDtoSchema,
  sceneDeltaDtoSchema,
  sceneGeometryCommandInputDtoSchema,
  sceneTokenMovementCommandInputDtoSchema,
  sceneFogLayerDtoSchema
} from './vttScenes.js'
import {
  sceneLiveStateEntityPageInputSchema,
  sceneLiveStateHeaderSchema
} from './sceneLiveState.js'
import {
  sceneFogCommandResultSchema,
  sceneFogCommandChunksInputSchema,
  sceneFogCommandChunksPageSchema
} from './sceneFog.js'
import { postgresUuidSchema } from '../shared/postgresUuid.js'
import {
  sceneSessionVisionCaptureInputSchema,
  sceneSessionVisionScopeSchema,
  sceneSessionVisionCharacterRevisionsSchema
} from './sceneSessionVision.js'

const collection = z.enum(['tokens', 'barriers'])
const phase = z.enum(['BASE', 'APPENDED'])
const version = z.number().check(z.int()).check(z.nonnegative())

/** Fences a command to the Campaign presentation that selected its Scene. */
export const scenePresentationFenceSchema = z.pick(sceneSessionVisionCaptureInputSchema, {
  expectedPresentationVersion: true
})
export const sceneNativeGeometryCommandInputSchema = z.union([
  sceneGeometryCommandInputDtoSchema,
  sceneTokenMovementCommandInputDtoSchema
])
export const sceneGeometryExecuteInputSchema = z.strictObject({
  input: sceneNativeGeometryCommandInputSchema,
  presentation: z.optional(scenePresentationFenceSchema)
})
export type SceneGeometryExecuteInput = z.infer<typeof sceneGeometryExecuteInputSchema>
export type SceneNativeGeometryCommandInput = z.infer<typeof sceneNativeGeometryCommandInputSchema>
export const SCENE_GEOMETRY_STAGED_REQUIRED = 'SCENE_GEOMETRY_STAGED_REQUIRED' as const

export const sceneGeometryEntitySchema = z.discriminatedUnion('collection', [
  z.strictObject({ collection: z.literal('tokens'), entity: sceneTokenDtoSchema }),
  z.strictObject({ collection: z.literal('barriers'), entity: sceneBarrierDtoSchema })
])
export const sceneGeometryPageInputSchema = z.extend(
  z.omit(sceneLiveStateEntityPageInputSchema, { paginationOpts: true }),
  {
    collection,
    phase,
    afterOrdinal: z.nullable(version),
    numItems: sceneLiveStateEntityPageInputSchema.shape.paginationOpts.shape.numItems
  }
)
export const sceneGeometryPageEntrySchema = z.strictObject({
  ordinal: version,
  value: sceneGeometryEntitySchema,
  doorState: z.nullable(z.enum(['OPEN', 'CLOSED', 'LOCKED']))
})
export const sceneGeometryPageSchema = z.strictObject({
  version,
  collection,
  page: z.array(sceneGeometryPageEntrySchema).check(z.maxLength(8)),
  // Follow this continuation even after an empty page; every request pins the same version.
  next: z.nullable(z.strictObject({ phase, afterOrdinal: z.nullable(version) }))
})

export type SceneGeometryEntity = z.infer<typeof sceneGeometryEntitySchema>
export type SceneGeometryPageInput = z.infer<typeof sceneGeometryPageInputSchema>
export type SceneGeometryPage = z.infer<typeof sceneGeometryPageSchema>

const fogReplacement = z.extend(sceneFogCommandResultSchema.shape.patch, {
  mode: z.literal('REPLACE')
})
export const sceneGeometryCommandResultSchema = z
  .extend(z.omit(sceneFogCommandResultSchema, { patch: true }), {
    version,
    occurrence: z.nullable(encounterRuleOccurrenceSummaryDtoSchema),
    delta: z.nullable(sceneDeltaDtoSchema),
    fogPatches: z.array(fogReplacement).check(z.maxLength(101))
  })
  .check(
    z.superRefine((result, ctx) => {
      if (result.delta === null && result.occurrence === null)
        ctx.addIssue({
          code: 'custom',
          path: ['delta'],
          message: 'Only an Encounter occurrence may own movement without a Scene delta.'
        })
    })
  )
export const sceneGeometryBeginResultSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('REPLAY'), result: sceneGeometryCommandResultSchema }),
  z.strictObject({
    kind: z.literal('READY'),
    saveId: postgresUuidSchema,
    input: sceneNativeGeometryCommandInputSchema,
    header: sceneLiveStateHeaderSchema,
    movementStartDistance: z.optional(z.number().check(z.nonnegative())),
    sessionVision: z.optional(sceneSessionVisionScopeSchema)
  })
])
export const sceneGeometrySaveLookupSchema = z.strictObject({ saveId: postgresUuidSchema })
export const sceneGeometryStageFogInputSchema = z.extend(sceneGeometrySaveLookupSchema, {
  layer: sceneFogLayerDtoSchema
})
export const sceneGeometryFinishInputSchema = z.extend(sceneGeometrySaveLookupSchema, {
  baseOrdinal: z.nullable(version),
  tokenOrdinals: z.optional(
    z
      .array(z.strictObject({ tokenId: postgresUuidSchema, baseOrdinal: z.nullable(version) }))
      .check(z.maxLength(VTT_SCENE_LIMITS.tokens))
  )
})
export const sceneGeometryObserveInputSchema = z.extend(sceneGeometrySaveLookupSchema, {
  characterRevisions: sceneSessionVisionCharacterRevisionsSchema
})

export type SceneGeometryCommandResult = z.infer<typeof sceneGeometryCommandResultSchema>
export type SceneGeometryBeginResult = z.infer<typeof sceneGeometryBeginResultSchema>

export const sceneGeometryCommandChunksInputSchema = z.extend(sceneFogCommandChunksInputSchema, {
  ownerUserId: z.nullable(postgresUuidSchema)
})
export const sceneGeometryCommandChunksPageSchema = z.extend(sceneFogCommandChunksPageSchema, {
  result: sceneGeometryCommandResultSchema,
  patch: fogReplacement
})
