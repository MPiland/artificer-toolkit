import { z, lazySchema } from '../zod.js'

import { VTT_SCENE_LIMITS, VTT_SPATIAL_LIMITS } from '@artificer-toolkit/shared/vtt/scene'

import { postgresUuidSchema } from './postgresUuid.js'

export const MAX_SPATIAL_PATH_POINTS = 256
export const MAX_SPATIAL_CANDIDATES = 256

const coordinateSchema = lazySchema(() =>
  z
    .number()
    .check(z.gte(-VTT_SCENE_LIMITS.coordinateMagnitude))
    .check(z.lte(VTT_SCENE_LIMITS.coordinateMagnitude))
)

export const spatialPointDtoSchema = lazySchema(() =>
  z.strictObject({ x: coordinateSchema, y: coordinateSchema })
)
export const spatialTriggerDtoSchema = lazySchema(() => z.enum(['ENTER', 'EXIT', 'CROSS']))
export const spatialMovementKindDtoSchema = lazySchema(() =>
  z.enum(['VOLUNTARY', 'FORCED', 'TELEPORT'])
)
export const spatialPositiveDistanceDtoSchema = lazySchema(() =>
  z
    .number()
    .check(z.gte(VTT_SPATIAL_LIMITS.minimumDistance))
    .check(z.lte(VTT_SCENE_LIMITS.coordinateMagnitude))
)

/** A factual contact collected from an authoritative Scene path; it carries no effect execution. */
export const spatialMovementCandidateDtoSchema = lazySchema(() =>
  z.strictObject({
    contact: spatialPointDtoSchema,
    effectId: postgresUuidSchema,
    pathDistance: z.number().check(z.nonnegative()),
    sourceActorId: z.nullable(postgresUuidSchema),
    sourceMoved: z.boolean(),
    targetActorId: postgresUuidSchema,
    trigger: spatialTriggerDtoSchema
  })
)

export type SpatialPointDto = z.infer<typeof spatialPointDtoSchema>
export type SpatialMovementKindDto = z.infer<typeof spatialMovementKindDtoSchema>
export type SpatialMovementCandidateDto = z.infer<typeof spatialMovementCandidateDtoSchema>
