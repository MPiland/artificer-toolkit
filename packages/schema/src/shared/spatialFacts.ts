import { z, lazySchema } from '../zod.js'

import { VTT_SCENE_LIMITS, VTT_SPATIAL_LIMITS } from '@artificer-toolkit/shared/vtt/scene'

import { postgresUuidSchema } from './postgresUuid.js'

export const MAX_SPATIAL_PATH_POINTS = 256
export const MAX_SPATIAL_CANDIDATES = 256
/** The legal squares one chosen forced movement may offer: the square-grid geometry's interaction bound. */
export const MAX_FORCED_MOVEMENT_DESTINATIONS = 1_024

const coordinateSchema = lazySchema(() =>
  z
    .number()
    .check(z.gte(-VTT_SCENE_LIMITS.coordinateMagnitude))
    .check(z.lte(VTT_SCENE_LIMITS.coordinateMagnitude))
)

export const spatialPointDtoSchema = lazySchema(() =>
  z.strictObject({ x: coordinateSchema, y: coordinateSchema })
)
/**
 * Where an aimed area goes, without its Scene fence: the point it is centered on, or the origin and
 * the point a directed area extends toward.
 */
export const areaAimDtoSchema = lazySchema(() =>
  z.discriminatedUnion('kind', [
    z.strictObject({ kind: z.literal('POINT'), point: spatialPointDtoSchema }),
    z.strictObject({
      kind: z.literal('DIRECTED'),
      origin: spatialPointDtoSchema,
      toward: spatialPointDtoSchema
    })
  ])
)
export type AreaAimDto = z.infer<typeof areaAimDtoSchema>
export const spatialTriggerDtoSchema = lazySchema(() => z.enum(['ENTER', 'EXIT', 'CROSS']))
/**
 * The turn boundaries at which a creature standing in a zone is caught (not a movement), in
 * canonical order: the start or end of its own turn, or the start of the zone source's turn (D144).
 */
export const SPATIAL_TURN_TRIGGERS = [
  'START_OF_TURN',
  'END_OF_TURN',
  'START_OF_SOURCE_TURN'
] as const
export const spatialTurnTriggerDtoSchema = lazySchema(() => z.enum(SPATIAL_TURN_TRIGGERS))
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
    trigger: spatialTriggerDtoSchema,
    /** The 1-based whole step it completes, for a zone that catches per distance moved (D156). */
    step: z.optional(z.number().check(z.int()).check(z.positive()))
  })
)

/** A creature standing in a zone at a turn boundary: no path, no contact point. */
export const spatialTurnContactDtoSchema = lazySchema(() =>
  z.strictObject({
    effectId: postgresUuidSchema,
    sourceActorId: z.nullable(postgresUuidSchema),
    targetActorId: postgresUuidSchema,
    trigger: spatialTurnTriggerDtoSchema
  })
)

/** A zone of the hit creature that answers a melee hit, and the attacker it catches (D153). */
export const spatialMeleeRetaliationContactDtoSchema = lazySchema(() =>
  z.strictObject({
    effectId: postgresUuidSchema,
    sourceActorId: postgresUuidSchema,
    targetActorId: postgresUuidSchema
  })
)

export type SpatialPointDto = z.infer<typeof spatialPointDtoSchema>
export type SpatialMovementKindDto = z.infer<typeof spatialMovementKindDtoSchema>
export type SpatialMovementCandidateDto = z.infer<typeof spatialMovementCandidateDtoSchema>
