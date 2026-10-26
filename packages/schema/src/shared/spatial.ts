import { z, lazySchema } from '../zod.js'

import { segmentsIntersect } from '@artificer-toolkit/shared/vtt/segments'

import { activationDtoSchema } from '../effects/activation.js'
import { checkChoiceDtoSchema, heldEscapeDcDtoSchema } from '../effects/check.js'
import { MAX_ENCOUNTER_ACTORS } from './authoredLimits.js'
import { manifestBlockingRuleSchema, manifestRequiredSightSchema } from './enums.js'
import { postgresUuidSchema } from './postgresUuid.js'
import {
  activeRuleEffectDefinitionDtoSchema,
  activeRuleEffectLifecycleDtoSchema
} from './activeRuleEffects.js'
import {
  MAX_SPATIAL_CANDIDATES,
  MAX_SPATIAL_PATH_POINTS,
  SPATIAL_TURN_TRIGGERS,
  spatialMovementKindDtoSchema,
  spatialPointDtoSchema,
  spatialPositiveDistanceDtoSchema,
  spatialTriggerDtoSchema,
  spatialTurnTriggerDtoSchema
} from './spatialFacts.js'

export {
  MAX_SPATIAL_CANDIDATES,
  MAX_SPATIAL_PATH_POINTS,
  SPATIAL_TURN_TRIGGERS,
  spatialMovementCandidateDtoSchema,
  spatialMovementKindDtoSchema,
  spatialPointDtoSchema,
  spatialPositiveDistanceDtoSchema,
  spatialTriggerDtoSchema,
  spatialTurnTriggerDtoSchema
} from './spatialFacts.js'
export type { SpatialMovementCandidateDto } from './spatialFacts.js'

const uuidSchema = postgresUuidSchema
const positiveDistanceSchema = spatialPositiveDistanceDtoSchema
const pointSchema = spatialPointDtoSchema
const triggerSchema = spatialTriggerDtoSchema
const turnTriggerSchema = spatialTurnTriggerDtoSchema
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

const spatialPolygonDtoSchema = lazySchema(() =>
  z
    .strictObject({
      kind: z.literal('POLYGON'),
      points: z.array(pointSchema).check(z.minLength(3)).check(z.maxLength(MAX_SPATIAL_POINTS))
    })
    .check(
      z.superRefine((polygon, context) => {
        const identities = new Set(polygon.points.map((point) => `${point.x}:${point.y}`))
        const doubledArea = polygon.points.reduce((area, point, index) => {
          const next = polygon.points[(index + 1) % polygon.points.length]!
          return area + point.x * next.y - next.x * point.y
        }, 0)
        if (identities.size !== polygon.points.length || Math.abs(doubledArea) <= Number.EPSILON)
          context.addIssue({
            code: 'custom',
            path: ['points'],
            message: 'Spatial polygons must have distinct non-collinear points.'
          })
        for (let left = 0; left < polygon.points.length; left += 1)
          for (let right = left + 1; right < polygon.points.length; right += 1) {
            const adjacent =
              right === left + 1 || (left === 0 && right === polygon.points.length - 1)
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
                code: 'custom',
                path: ['points'],
                message: 'Spatial polygons may not self-intersect.'
              })
          }
      })
    )
)

export const spatialGeometryDtoSchema = lazySchema(() =>
  z.discriminatedUnion('kind', [
    z.strictObject({
      kind: z.literal('CIRCLE'),
      center: pointSchema,
      radius: positiveDistanceSchema
    }),
    /** A hollow circle (D154): the band between the inner and the outer radius. */
    z
      .strictObject({
        kind: z.literal('RING'),
        center: pointSchema,
        outerRadius: positiveDistanceSchema,
        innerRadius: positiveDistanceSchema
      })
      .check(
        z.refine((ring) => ring.innerRadius < ring.outerRadius, {
          path: ['innerRadius'],
          message: 'A ring’s inner radius is less than its outer radius.'
        })
      ),
    spatialPolygonDtoSchema
  ])
)

export const spatialPersistedGeometryDtoSchema = lazySchema(() =>
  z.strictObject({
    frame: z.enum(['SCENE_ABSOLUTE', 'TOKEN_LOCAL']),
    shape: spatialGeometryDtoSchema
  })
)

/** The authored name of a placed zone, shown wherever the zone is listed or drawn. */
export const spatialZoneLabelSchema = lazySchema(() =>
  z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(240))
)

/**
 * What moving through a zone costs every mover, per unit walked inside it (D154); the highest of
 * the terrain, zone and careful-doubling multipliers applies, never their product.
 */
export const zoneMovementCostMultiplierSchema = lazySchema(() =>
  z.number().check(z.gt(1)).check(z.lte(100))
)

/** What a zone blocks, projected for consumers such as cover (D154); absent when nothing. */
export const zoneBlockingRulesSchema = lazySchema(() =>
  z
    .array(manifestBlockingRuleSchema)
    .check(z.minLength(1))
    .check(z.maxLength(manifestBlockingRuleSchema.options.length))
    .check(
      z.refine((rules) => new Set(rules).size === rules.length, 'Zone blocking rules are unique.')
    )
)

/** The sight an occupant needs to be put through a zone; absent when it needs none. */
export const zoneRequiredSightSchema = lazySchema(() =>
  z
    .array(manifestRequiredSightSchema)
    .check(z.minLength(1))
    .check(z.maxLength(manifestRequiredSightSchema.options.length))
    .check(
      z.refine(
        (sights) => new Set(sights).size === sights.length,
        'Zone required sights are unique.'
      )
    )
)

/**
 * The condition a zone holds on a creature that fails its save (D146), with the escape it offers:
 * a placed zone pins the escape DC (`dcSchema` is a number there), a compiled one may name its
 * source's save DC.
 */
export function spatialHeldConditionDtoSchema<TDc extends z.ZodMiniType>(dcSchema: TDc) {
  return z.strictObject({
    conditionId: uuidSchema,
    /** The condition ends when the creature leaves the zone's area. */
    endsOnLeavingArea: z.optional(z.literal(true)),
    /** The condition ends at the end of its holder's own turn, whether or not the zone lasts. */
    endsAtEndOfHolderTurn: z.optional(z.literal(true)),
    /** The condition records the zone's source as the creature that applied it. */
    recordsSource: z.optional(z.literal(true)),
    escape: z.optional(
      z.strictObject({
        activation: activationDtoSchema,
        checks: checkChoiceDtoSchema,
        dc: dcSchema
      })
    )
  })
}

/** A compiled zone's held condition; its escape DC may be its source's save DC. */
export const compiledSpatialHeldConditionDtoSchema = lazySchema(() =>
  spatialHeldConditionDtoSchema(heldEscapeDcDtoSchema)
)

/**
 * Immutable Encounter/Scene placement. Trigger and movement arrays are already
 * canonical when persisted; parsing never silently changes execution order.
 */
export const spatialRuleEffectPlacementDtoSchema = lazySchema(() =>
  z
    .strictObject({
      schemaVersion: z.literal(1),
      anchorKind: z.enum(['FIXED', 'TOKEN']),
      sourceTokenId: z.nullable(uuidSchema),
      geometry: spatialPersistedGeometryDtoSchema,
      triggerModes: z.array(triggerSchema).check(z.maxLength(triggerOrder.length)),
      /**
       * Turn boundaries at which a creature inside is caught. A zone with no movement, turn or
       * melee-hit trigger is one no creature interacts with (D154 amendment).
       */
      turnTriggers: z.optional(
        z
          .array(turnTriggerSchema)
          .check(z.minLength(1))
          .check(z.maxLength(SPATIAL_TURN_TRIGGERS.length))
      ),
      movementKinds: z
        .array(movementSchema)
        .check(z.minLength(1))
        .check(z.maxLength(movementOrder.length)),
      activation: z.enum(['ONE_SHOT', 'REPEATABLE']),
      visibility: z.enum(['PUBLIC', 'HIDDEN']),
      revealOnTrigger: z.boolean(),
      label: z.optional(spatialZoneLabelSchema),
      /** A voluntary mover moving carefully crosses the field at double cost and makes no entry save. */
      bypassAtHalfSpeed: z.optional(z.boolean()),
      /** Creatures the caster designated at cast; the zone never catches them. Absent when none. */
      unaffectedActorIds: z.optional(
        z.array(uuidSchema).check(z.minLength(1)).check(z.maxLength(MAX_ENCOUNTER_ACTORS))
      ),
      /** How many times the zone may catch one creature in one turn; absent for no limit. */
      maxApplicationsPerTurn: z.optional(z.number().check(z.int()).check(z.positive())),
      /** At a turn boundary the zone catches only a creature wholly inside it; absent for overlap. */
      requiresFullyWithin: z.optional(z.boolean()),
      /** The occupant is put through the zone only with this sight between it and the source. */
      requiredSight: z.optional(zoneRequiredSightSchema),
      movementCostMultiplier: z.optional(zoneMovementCostMultiplierSchema),
      /** The zone catches a mover once per whole step (Scene distance units) it moves inside (D156). */
      distanceStep: z.optional(positiveDistanceSchema),
      blockingRules: z.optional(zoneBlockingRulesSchema),
      /** A creature failing the zone's save at the start of its turn loses its Action for that turn. */
      failedSaveLosesAction: z.optional(z.boolean()),
      /** The condition the zone holds on a creature failing its save, its escape DC pinned. */
      heldCondition: z.optional(
        spatialHeldConditionDtoSchema(z.number().check(z.int()).check(z.positive()))
      ),
      /** The zone catches a creature inside it that hits its source token with a melee attack (D153). */
      retaliatesMeleeHits: z.optional(z.literal(true)),
      /**
       * The bonus to every saving throw the zone lends its source and the source's allies inside it
       * (D155), its amount resolved against the source and pinned at placement. Such a zone has no
       * trigger.
       */
      occupantSaveBonus: z.optional(
        z.strictObject({
          domain: z.literal('EVERY_SAVING_THROW'),
          dispositionFilter: z.literal('ALLIES_AND_SOURCE'),
          amount: z.number().check(z.int()).check(z.minimum(-5)).check(z.maximum(30))
        })
      )
    })
    .check(
      z.superRefine((placement, context) => {
        const triggered =
          placement.triggerModes.length > 0 ||
          placement.turnTriggers !== undefined ||
          placement.retaliatesMeleeHits === true
        if (placement.occupantSaveBonus && (triggered || placement.anchorKind !== 'TOKEN'))
          context.addIssue({
            code: 'custom',
            path: ['occupantSaveBonus'],
            message: 'A zone lending a save bonus is untriggered and anchored to its source token.'
          })
        if (placement.retaliatesMeleeHits && placement.anchorKind !== 'TOKEN')
          context.addIssue({
            code: 'custom',
            path: ['retaliatesMeleeHits'],
            message: 'Only a zone anchored to its source token answers melee hits.'
          })
        if (
          placement.turnTriggers &&
          !sortedUniqueEnum(placement.turnTriggers, SPATIAL_TURN_TRIGGERS)
        )
          context.addIssue({
            code: 'custom',
            path: ['turnTriggers'],
            message:
              'Spatial turn triggers must be unique and use START_OF_TURN, END_OF_TURN order.'
          })
        if (!sortedUniqueEnum(placement.triggerModes, triggerOrder))
          context.addIssue({
            code: 'custom',
            path: ['triggerModes'],
            message:
              'Spatial trigger modes must be unique and use canonical ENTER, EXIT, CROSS order.'
          })
        if (!sortedUniqueEnum(placement.movementKinds, movementOrder))
          context.addIssue({
            code: 'custom',
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
            code: 'custom',
            path: ['geometry'],
            message: 'Spatial anchor, source token, and geometry frame must agree.'
          })
        // A public effect is already visible; reveal-on-trigger only applies to hidden effects.
        if (placement.visibility === 'PUBLIC' && placement.revealOnTrigger)
          context.addIssue({
            code: 'custom',
            path: ['revealOnTrigger'],
            message: 'Public spatial effects cannot use hidden-only reveal-on-trigger behavior.'
          })
      })
    )
)

/**
 * A placed zone's spot or disarm DC (MOVE-3.3), which the GM types: a flat number, or the result of
 * the placer's roll (Stealth to hide it, Sleight of Hand to make it hard to disarm).
 */
export const zoneDcDtoSchema = lazySchema(() =>
  z.strictObject({
    value: z.number().check(z.int()).check(z.positive()),
    source: z.enum(['FLAT', 'PLACER_ROLL'])
  })
)

/**
 * Mutable presentation state; execution lifecycle remains separately frozen. A zone with
 * `concealment` is drawn and listed only for the GM and the Characters in `knownByActorIds`; one
 * without it is in plain sight (MOVE-3.3).
 */
export const spatialRuleEffectStateDtoSchema = lazySchema(() =>
  z.strictObject({
    schemaVersion: z.literal(1),
    revealed: z.boolean(),
    concealment: z.optional(
      z.strictObject({
        spotDc: zoneDcDtoSchema,
        /** The Characters that know of the zone: its placer, sorted. */
        knownByActorIds: z.array(uuidSchema).check(z.maxLength(MAX_ENCOUNTER_ACTORS))
      })
    ),
    /** Shown only to the GM. */
    disarmDc: z.optional(zoneDcDtoSchema)
  })
)

/**
 * Aggregate-owned spatial root state. A target actor is intentionally absent
 * until a contact candidate is evaluated by the shared effect executor.
 */
export const spatialRuleEffectCurrentStateDtoSchema = lazySchema(() =>
  z
    .strictObject({
      definition: activeRuleEffectDefinitionDtoSchema,
      lifecycle: activeRuleEffectLifecycleDtoSchema,
      placement: spatialRuleEffectPlacementDtoSchema,
      spatialState: spatialRuleEffectStateDtoSchema
    })
    .check(
      z.superRefine((current, context) => {
        if (current.placement.visibility === 'PUBLIC' && !current.spatialState.revealed)
          context.addIssue({
            code: 'custom',
            path: ['spatialState', 'revealed'],
            message: 'Public spatial effects must remain revealed.'
          })
        const { concealment, disarmDc } = current.spatialState
        if ((concealment || disarmDc) && current.placement.anchorKind !== 'FIXED')
          context.addIssue({
            code: 'custom',
            path: ['spatialState'],
            message: 'Only a zone fixed to the Scene has a spot or disarm DC.'
          })
        if (
          concealment?.knownByActorIds.some(
            (id, index) => index > 0 && concealment.knownByActorIds[index - 1]! >= id
          )
        )
          context.addIssue({
            code: 'custom',
            path: ['spatialState', 'concealment', 'knownByActorIds'],
            message: 'The Characters that know of a zone must be unique and sorted.'
          })
      })
    )
)

export const spatialEffectInstanceDtoSchema = lazySchema(() =>
  z
    .strictObject({
      effectId: uuidSchema,
      sourceActorId: z.nullable(uuidSchema),
      sourceTokenId: z.nullable(uuidSchema),
      anchorKind: z.enum(['FIXED', 'TOKEN']),
      geometry: spatialPersistedGeometryDtoSchema,
      triggerModes: z.array(triggerSchema).check(z.maxLength(3)),
      turnTriggers: z.optional(
        z
          .array(turnTriggerSchema)
          .check(z.minLength(1))
          .check(z.maxLength(SPATIAL_TURN_TRIGGERS.length))
      ),
      movementKinds: z.array(movementSchema).check(z.minLength(1)).check(z.maxLength(3)),
      bypassAtHalfSpeed: z.optional(z.boolean()),
      unaffectedActorIds: z.optional(
        z.array(uuidSchema).check(z.minLength(1)).check(z.maxLength(MAX_ENCOUNTER_ACTORS))
      ),
      maxApplicationsPerTurn: z.optional(z.number().check(z.int()).check(z.positive())),
      requiresFullyWithin: z.optional(z.boolean()),
      retaliatesMeleeHits: z.optional(z.literal(true)),
      distanceStep: z.optional(positiveDistanceSchema)
    })
    .check(
      z.superRefine((effect, context) => {
        if (effect.turnTriggers && new Set(effect.turnTriggers).size !== effect.turnTriggers.length)
          context.addIssue({
            code: 'custom',
            path: ['turnTriggers'],
            message: 'Spatial turn triggers must be unique.'
          })
        if (new Set(effect.triggerModes).size !== effect.triggerModes.length)
          context.addIssue({
            code: 'custom',
            path: ['triggerModes'],
            message: 'Spatial trigger modes must be unique.'
          })
        if (new Set(effect.movementKinds).size !== effect.movementKinds.length)
          context.addIssue({
            code: 'custom',
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
            code: 'custom',
            path: ['geometry'],
            message: 'Spatial anchor, source token, and geometry frame must agree.'
          })
      })
    )
)

export const spatialSceneTokenDtoSchema = lazySchema(() =>
  z.strictObject({
    id: uuidSchema,
    actorId: z.nullable(uuidSchema),
    position: pointSchema,
    width: positiveDistanceSchema,
    height: positiveDistanceSchema
  })
)

export const spatialMovementCandidateInputDtoSchema = lazySchema(() =>
  z
    .strictObject({
      effects: z.array(spatialEffectInstanceDtoSchema).check(z.maxLength(MAX_SPATIAL_CANDIDATES)),
      movementKind: movementSchema,
      path: z.array(pointSchema).check(z.minLength(2)).check(z.maxLength(MAX_SPATIAL_PATH_POINTS)),
      tokens: z
        .array(spatialSceneTokenDtoSchema)
        .check(z.minLength(1))
        .check(z.maxLength(MAX_SPATIAL_CANDIDATES)),
      movingTokenId: uuidSchema
    })
    .check(
      z.superRefine((input, context) => {
        if (new Set(input.effects.map((effect) => effect.effectId)).size !== input.effects.length)
          context.addIssue({
            code: 'custom',
            path: ['effects'],
            message: 'Spatial effect IDs must be unique.'
          })
        if (new Set(input.tokens.map((token) => token.id)).size !== input.tokens.length)
          context.addIssue({
            code: 'custom',
            path: ['tokens'],
            message: 'Spatial token IDs must be unique.'
          })
        const tokenIds = new Set(input.tokens.map((token) => token.id))
        if (!tokenIds.has(input.movingTokenId))
          context.addIssue({
            code: 'custom',
            path: ['movingTokenId'],
            message: 'Spatial movement must identify a supplied scene token.'
          })
        for (const [index, effect] of input.effects.entries())
          if (effect.sourceTokenId !== null && !tokenIds.has(effect.sourceTokenId))
            context.addIssue({
              code: 'custom',
              path: ['effects', index, 'sourceTokenId'],
              message: 'Token-anchored spatial effects must reference a supplied scene token.'
            })
        if (input.movementKind === 'TELEPORT' && input.path.length !== 2)
          context.addIssue({
            code: 'custom',
            path: ['path'],
            message: 'Teleport movement requires exactly its origin and destination.'
          })
      })
    )
)

export type SpatialGeometryDto = z.infer<typeof spatialGeometryDtoSchema>
export type SpatialPersistedGeometryDto = z.infer<typeof spatialPersistedGeometryDtoSchema>
export type SpatialRuleEffectPlacementDto = z.infer<typeof spatialRuleEffectPlacementDtoSchema>
export type SpatialRuleEffectStateDto = z.infer<typeof spatialRuleEffectStateDtoSchema>
export type ZoneDcDto = z.infer<typeof zoneDcDtoSchema>
export type SpatialRuleEffectCurrentStateDto = z.infer<
  typeof spatialRuleEffectCurrentStateDtoSchema
>
export type SpatialEffectInstanceDto = z.infer<typeof spatialEffectInstanceDtoSchema>
export type SpatialSceneTokenDto = z.infer<typeof spatialSceneTokenDtoSchema>
export type SpatialMovementCandidateInputDto = z.infer<
  typeof spatialMovementCandidateInputDtoSchema
>
