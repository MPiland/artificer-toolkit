import { z } from 'zod'

import { VTT_SCENE_LIMITS, VTT_SPATIAL_LIMITS } from '@artificer-toolkit/shared/vtt'

import { postgresUuidSchema } from './postgresUuid.js'

export const MAX_SPATIAL_PATH_POINTS = 256
export const MAX_SPATIAL_CANDIDATES = 256

const coordinateSchema = z
  .number()
  .finite()
  .min(-VTT_SCENE_LIMITS.coordinateMagnitude)
  .max(VTT_SCENE_LIMITS.coordinateMagnitude)

export const spatialPointDtoSchema = z.strictObject({ x: coordinateSchema, y: coordinateSchema })
export const spatialTriggerDtoSchema = z.enum(['ENTER', 'EXIT', 'CROSS'])
export const spatialMovementKindDtoSchema = z.enum(['VOLUNTARY', 'FORCED', 'TELEPORT'])
export const spatialPositiveDistanceDtoSchema = z
  .number()
  .finite()
  .min(VTT_SPATIAL_LIMITS.minimumDistance)
  .max(VTT_SCENE_LIMITS.coordinateMagnitude)

/** A factual contact collected from an authoritative Scene path; it carries no effect execution. */
export const spatialMovementCandidateDtoSchema = z.strictObject({
  contact: spatialPointDtoSchema,
  effectId: postgresUuidSchema,
  pathDistance: z.number().finite().nonnegative(),
  sourceActorId: postgresUuidSchema.nullable(),
  sourceMoved: z.boolean(),
  targetActorId: postgresUuidSchema,
  trigger: spatialTriggerDtoSchema
})

export type SpatialPointDto = z.infer<typeof spatialPointDtoSchema>
export type SpatialMovementKindDto = z.infer<typeof spatialMovementKindDtoSchema>
export type SpatialMovementCandidateDto = z.infer<typeof spatialMovementCandidateDtoSchema>
