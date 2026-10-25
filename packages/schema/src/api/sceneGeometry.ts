import { VTT_SCENE_LIMITS } from '@artificer-toolkit/shared/vtt/scene'
import { encounterRuleOccurrenceSummaryDtoSchema } from '../shared/encounterRuleOccurrence.js'
import { z, lazySchema } from '../zod.js'
import {
  sceneBarrierDtoSchema,
  sceneTokenDtoSchema,
  sceneDeltaDtoSchema,
  sceneGeometryCommandInputDtoSchema,
  sceneTokenMovementCommandInputDtoSchema,
  sceneTokenFacingCommandInputDtoSchema,
  sceneFogLayerDtoSchema
} from './vttScenes.js'
import {
  sceneLiveStateEntityPageInputSchema,
  sceneLiveStateHeaderSchema
} from './sceneLiveState.js'
import { sceneFogCommandResultSchema } from './sceneFog.js'
import { postgresUuidSchema } from '../shared/postgresUuid.js'
import {
  sceneSessionVisionCaptureInputSchema,
  sceneSessionVisionScopeSchema
} from './sceneSessionVision.js'

const collection = lazySchema(() => z.enum(['tokens', 'barriers']))
const phase = lazySchema(() => z.enum(['BASE', 'APPENDED']))
const version = lazySchema(() => z.number().check(z.int()).check(z.nonnegative()))

/** Fences a command to the Campaign presentation that selected its Scene. */
export const scenePresentationFenceSchema = lazySchema(() =>
  z.pick(sceneSessionVisionCaptureInputSchema, {
    expectedPresentationVersion: true
  })
)
export const sceneNativeGeometryCommandInputSchema = lazySchema(() =>
  z.union([
    sceneGeometryCommandInputDtoSchema,
    sceneTokenMovementCommandInputDtoSchema,
    sceneTokenFacingCommandInputDtoSchema
  ])
)
export type SceneNativeGeometryCommandInput = z.infer<typeof sceneNativeGeometryCommandInputSchema>

export const sceneGeometryEntitySchema = lazySchema(() =>
  z.discriminatedUnion('collection', [
    z.strictObject({ collection: z.literal('tokens'), entity: sceneTokenDtoSchema }),
    z.strictObject({ collection: z.literal('barriers'), entity: sceneBarrierDtoSchema })
  ])
)
export const sceneGeometryPageInputSchema = lazySchema(() =>
  z.extend(z.omit(sceneLiveStateEntityPageInputSchema, { paginationOpts: true }), {
    collection,
    phase,
    afterOrdinal: z.nullable(version),
    numItems: sceneLiveStateEntityPageInputSchema.shape.paginationOpts.shape.numItems
  })
)
export const sceneGeometryPageEntrySchema = lazySchema(() =>
  z.strictObject({
    ordinal: version,
    value: sceneGeometryEntitySchema,
    doorState: z.nullable(z.enum(['OPEN', 'CLOSED', 'LOCKED']))
  })
)
export const sceneGeometryPageSchema = lazySchema(() =>
  z.strictObject({
    version,
    collection,
    page: z.array(sceneGeometryPageEntrySchema).check(z.maxLength(8)),
    // Follow this continuation even after an empty page; every request pins the same version.
    next: z.nullable(z.strictObject({ phase, afterOrdinal: z.nullable(version) }))
  })
)

export type SceneGeometryEntity = z.infer<typeof sceneGeometryEntitySchema>

const fogReplacement = lazySchema(() =>
  z.extend(sceneFogCommandResultSchema.shape.patch, {
    mode: z.literal('REPLACE')
  })
)
export const sceneGeometryCommandResultSchema = lazySchema(() =>
  z
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
)
const sceneGeometryBeginReadySchema = lazySchema(() =>
  z.strictObject({
    kind: z.literal('READY'),
    saveId: postgresUuidSchema,
    input: sceneNativeGeometryCommandInputSchema,
    header: sceneLiveStateHeaderSchema,
    /** The Encounter bound to the Scene, if any; its token moves carry Encounter rules. */
    encounterId: z.nullable(postgresUuidSchema),
    movementStartDistance: z.optional(z.number().check(z.nonnegative())),
    sessionVision: z.optional(sceneSessionVisionScopeSchema)
  })
)
export const sceneGeometryBeginResultSchema = lazySchema(() =>
  z.discriminatedUnion('kind', [
    z.strictObject({ kind: z.literal('REPLAY'), result: sceneGeometryCommandResultSchema }),
    sceneGeometryBeginReadySchema
  ])
)
const sceneGeometrySaveLookupSchema = lazySchema(() =>
  z.strictObject({ saveId: postgresUuidSchema })
)
export const sceneGeometryStageFogInputSchema = lazySchema(() =>
  z.extend(sceneGeometrySaveLookupSchema, {
    layer: sceneFogLayerDtoSchema
  })
)
/** Each entity's ordinal in the Scene definition save; null for an entity added during play. */
const sceneTokenOrdinalsSchema = lazySchema(() =>
  z
    .array(z.strictObject({ tokenId: postgresUuidSchema, baseOrdinal: z.nullable(version) }))
    .check(z.maxLength(VTT_SCENE_LIMITS.tokens))
)
export const sceneBaseOrdinalsSchema = lazySchema(() =>
  z.strictObject({
    tokens: sceneTokenOrdinalsSchema,
    barriers: z
      .array(z.strictObject({ barrierId: postgresUuidSchema, baseOrdinal: z.nullable(version) }))
      .check(z.maxLength(VTT_SCENE_LIMITS.barriers))
  })
)
export const sceneGeometryFinishInputSchema = lazySchema(() =>
  z.extend(sceneGeometrySaveLookupSchema, {
    baseOrdinal: z.nullable(version),
    tokenOrdinals: z.optional(sceneTokenOrdinalsSchema),
    /**
     * An Encounter-bound move's walked segment cost in Scene units, terrain included, measured by the
     * caller that holds the whole Scene (the room or the geometry action). Publication requires it for
     * a voluntary move and records it as the actor's turn movement (D38).
     */
    movementCost: z.optional(z.number().check(z.nonnegative())),
    /**
     * The cast whose teleport allowance a player's Encounter-bound TELEPORT spends, chosen by the
     * room when it admitted the move; publication spends it. Absent for the GM's ungated teleport.
     */
    teleportCastCommandId: z.optional(postgresUuidSchema)
  })
)

export type SceneGeometryCommandResult = z.infer<typeof sceneGeometryCommandResultSchema>
export type SceneGeometryBeginResult = z.infer<typeof sceneGeometryBeginResultSchema>
export type SceneBaseOrdinals = z.infer<typeof sceneBaseOrdinalsSchema>
