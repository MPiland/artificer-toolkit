import { z } from 'zod'

import { segmentsIntersect } from '@artificer-toolkit/shared/vtt'

import { postgresUuidSchema } from './postgresUuid.js'
import {
  activeRuleEffectDefinitionDtoSchema,
  activeRuleEffectLifecycleDtoSchema
} from './rulesExecution.js'
import {
  MAX_SPATIAL_CANDIDATES,
  MAX_SPATIAL_PATH_POINTS,
  spatialMovementKindDtoSchema,
  spatialPointDtoSchema,
  spatialPositiveDistanceDtoSchema,
  spatialTriggerDtoSchema
} from './spatialFacts.js'

export {
  MAX_SPATIAL_CANDIDATES,
  MAX_SPATIAL_PATH_POINTS,
  spatialMovementCandidateDtoSchema,
  spatialMovementKindDtoSchema,
  spatialPointDtoSchema,
  spatialPositiveDistanceDtoSchema,
  spatialTriggerDtoSchema
} from './spatialFacts.js'
export type { SpatialMovementCandidateDto } from './spatialFacts.js'

const uuidSchema = postgresUuidSchema
const positiveDistanceSchema = spatialPositiveDistanceDtoSchema
const pointSchema = spatialPointDtoSchema
const triggerSchema = spatialTriggerDtoSchema
const movementSchema = spatialMovementKindDtoSchema
const MAX_SPATIAL_POINTS = 128

/** The bounded aggregate-owned spatial current-state limit for one Encounter Scene. */
export const MAX_SPATIAL_RULE_EFFECTS_PER_SCENE = 64

const triggerOrder = ['ENTER', 'EXIT', 'CROSS'] as const
const movementOrder = ['VOLUNTARY', 'FORCED', 'TELEPORT'] as const

function sortedUniqueEnum<T extends string>(values: readonly T[], order: readonly T[]): boolean {
  return values.every(
    (value, index) =>
      (index === 0 || order.indexOf(values[index - 1]!) < order.indexOf(value)) &&
      order.includes(value)
  )
}

const spatialPolygonDtoSchema = z
  .strictObject({
    kind: z.literal('POLYGON'),
    points: z.array(pointSchema).min(3).max(MAX_SPATIAL_POINTS)
  })
  .superRefine((polygon, context) => {
    const identities = new Set(polygon.points.map((point) => `${point.x}:${point.y}`))
    const doubledArea = polygon.points.reduce((area, point, index) => {
      const next = polygon.points[(index + 1) % polygon.points.length]!
      return area + point.x * next.y - next.x * point.y
    }, 0)
    if (identities.size !== polygon.points.length || Math.abs(doubledArea) <= Number.EPSILON)
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['points'],
        message: 'Spatial polygons must have distinct non-collinear points.'
      })
    for (let left = 0; left < polygon.points.length; left += 1)
      for (let right = left + 1; right < polygon.points.length; right += 1) {
        const adjacent = right === left + 1 || (left === 0 && right === polygon.points.length - 1)
        if (adjacent) continue
        if (
          segmentsIntersect(
            polygon.points[left]!,
            polygon.points[(left + 1) % polygon.points.length]!,
            polygon.points[right]!,
            polygon.points[(right + 1) % polygon.points.length]!
          )
        )
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['points'],
            message: 'Spatial polygons may not self-intersect.'
          })
      }
  })

export const spatialGeometryDtoSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('CIRCLE'),
    center: pointSchema,
    radius: positiveDistanceSchema
  }),
  spatialPolygonDtoSchema
])

export const spatialPersistedGeometryDtoSchema = z.strictObject({
  frame: z.enum(['SCENE_ABSOLUTE', 'TOKEN_LOCAL']),
  shape: spatialGeometryDtoSchema
})

/**
 * Immutable Encounter/Scene placement. Trigger and movement arrays are already
 * canonical when persisted; parsing never silently changes execution order.
 */
export const spatialRuleEffectPlacementDtoSchema = z
  .strictObject({
    schemaVersion: z.literal(1),
    anchorKind: z.enum(['FIXED', 'TOKEN']),
    sourceTokenId: uuidSchema.nullable(),
    geometry: spatialPersistedGeometryDtoSchema,
    triggerModes: z.array(triggerSchema).min(1).max(triggerOrder.length),
    movementKinds: z.array(movementSchema).min(1).max(movementOrder.length),
    activation: z.enum(['ONE_SHOT', 'REPEATABLE']),
    visibility: z.enum(['PUBLIC', 'HIDDEN']),
    revealOnTrigger: z.boolean()
  })
  .superRefine((placement, context) => {
    if (!sortedUniqueEnum(placement.triggerModes, triggerOrder))
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['triggerModes'],
        message: 'Spatial trigger modes must be unique and use canonical ENTER, EXIT, CROSS order.'
      })
    if (!sortedUniqueEnum(placement.movementKinds, movementOrder))
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['movementKinds'],
        message:
          'Spatial movement kinds must be unique and use canonical VOLUNTARY, FORCED, TELEPORT order.'
      })
    if (
      (placement.anchorKind === 'FIXED' &&
        (placement.sourceTokenId !== null || placement.geometry.frame !== 'SCENE_ABSOLUTE')) ||
      (placement.anchorKind === 'TOKEN' &&
        (placement.sourceTokenId === null || placement.geometry.frame !== 'TOKEN_LOCAL'))
    )
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['geometry'],
        message: 'Spatial anchor, source token, and geometry frame must agree.'
      })
    // A public effect is already visible; reveal-on-trigger only applies to hidden effects.
    if (placement.visibility === 'PUBLIC' && placement.revealOnTrigger)
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['revealOnTrigger'],
        message: 'Public spatial effects cannot use hidden-only reveal-on-trigger behavior.'
      })
  })

/** Mutable presentation state; execution lifecycle remains separately frozen. */
export const spatialRuleEffectStateDtoSchema = z.strictObject({
  schemaVersion: z.literal(1),
  revealed: z.boolean()
})

/**
 * Aggregate-owned spatial root state. A target actor is intentionally absent
 * until a contact candidate is evaluated by the shared effect executor.
 */
export const spatialRuleEffectCurrentStateDtoSchema = z
  .strictObject({
    definition: activeRuleEffectDefinitionDtoSchema,
    lifecycle: activeRuleEffectLifecycleDtoSchema,
    placement: spatialRuleEffectPlacementDtoSchema,
    spatialState: spatialRuleEffectStateDtoSchema
  })
  .superRefine((current, context) => {
    if (current.placement.visibility === 'PUBLIC' && !current.spatialState.revealed)
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['spatialState', 'revealed'],
        message: 'Public spatial effects must remain revealed.'
      })
  })

export const spatialEffectInstanceDtoSchema = z
  .strictObject({
    effectId: uuidSchema,
    sourceActorId: uuidSchema.nullable(),
    sourceTokenId: uuidSchema.nullable(),
    anchorKind: z.enum(['FIXED', 'TOKEN']),
    geometry: spatialPersistedGeometryDtoSchema,
    triggerModes: z.array(triggerSchema).min(1).max(3),
    movementKinds: z.array(movementSchema).min(1).max(3)
  })
  .superRefine((effect, context) => {
    if (new Set(effect.triggerModes).size !== effect.triggerModes.length)
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['triggerModes'],
        message: 'Spatial trigger modes must be unique.'
      })
    if (new Set(effect.movementKinds).size !== effect.movementKinds.length)
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['movementKinds'],
        message: 'Spatial movement kinds must be unique.'
      })
    if (
      (effect.anchorKind === 'FIXED' &&
        (effect.sourceTokenId !== null || effect.geometry.frame !== 'SCENE_ABSOLUTE')) ||
      (effect.anchorKind === 'TOKEN' &&
        (effect.sourceTokenId === null || effect.geometry.frame !== 'TOKEN_LOCAL'))
    )
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['geometry'],
        message: 'Spatial anchor, source token, and geometry frame must agree.'
      })
  })

export const spatialSceneTokenDtoSchema = z.strictObject({
  id: uuidSchema,
  actorId: uuidSchema.nullable(),
  position: pointSchema,
  width: positiveDistanceSchema,
  height: positiveDistanceSchema
})

export const spatialMovementCandidateInputDtoSchema = z
  .strictObject({
    effects: z.array(spatialEffectInstanceDtoSchema).max(MAX_SPATIAL_CANDIDATES),
    movementKind: movementSchema,
    path: z.array(pointSchema).min(2).max(MAX_SPATIAL_PATH_POINTS),
    tokens: z.array(spatialSceneTokenDtoSchema).min(1).max(MAX_SPATIAL_CANDIDATES),
    movingTokenId: uuidSchema
  })
  .superRefine((input, context) => {
    if (new Set(input.effects.map((effect) => effect.effectId)).size !== input.effects.length)
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['effects'],
        message: 'Spatial effect IDs must be unique.'
      })
    if (new Set(input.tokens.map((token) => token.id)).size !== input.tokens.length)
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['tokens'],
        message: 'Spatial token IDs must be unique.'
      })
    const tokenIds = new Set(input.tokens.map((token) => token.id))
    if (!tokenIds.has(input.movingTokenId))
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['movingTokenId'],
        message: 'Spatial movement must identify a supplied scene token.'
      })
    for (const [index, effect] of input.effects.entries())
      if (effect.sourceTokenId !== null && !tokenIds.has(effect.sourceTokenId))
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['effects', index, 'sourceTokenId'],
          message: 'Token-anchored spatial effects must reference a supplied scene token.'
        })
    if (input.movementKind === 'TELEPORT' && input.path.length !== 2)
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['path'],
        message: 'Teleport movement requires exactly its origin and destination.'
      })
  })

export type SpatialGeometryDto = z.infer<typeof spatialGeometryDtoSchema>
export type SpatialPersistedGeometryDto = z.infer<typeof spatialPersistedGeometryDtoSchema>
export type SpatialRuleEffectPlacementDto = z.infer<typeof spatialRuleEffectPlacementDtoSchema>
export type SpatialRuleEffectStateDto = z.infer<typeof spatialRuleEffectStateDtoSchema>
export type SpatialRuleEffectCurrentStateDto = z.infer<
  typeof spatialRuleEffectCurrentStateDtoSchema
>
export type SpatialEffectInstanceDto = z.infer<typeof spatialEffectInstanceDtoSchema>
export type SpatialSceneTokenDto = z.infer<typeof spatialSceneTokenDtoSchema>
export type SpatialMovementCandidateInputDto = z.infer<
  typeof spatialMovementCandidateInputDtoSchema
>
