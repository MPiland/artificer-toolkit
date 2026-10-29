import { z, lazySchema } from '../zod.js'
import { lengthUnitCodeSchema, shapeKindSchema } from './enums.js'
import { createBreakpointScalingDtoSchema } from './scaling.js'
import { authoredIdentifierSchema, authoredLengthAmountSchema } from './authoredLimits.js'

export const shapeMeasurementDtoSchema = lazySchema(() =>
  z.object({
    amount: authoredLengthAmountSchema,
    unit: lengthUnitCodeSchema,
    scaling: z.optional(
      createBreakpointScalingDtoSchema(
        z.object({
          amount: authoredLengthAmountSchema,
          unit: lengthUnitCodeSchema
        })
      )
    )
  })
)

export const shapeDtoSchema = lazySchema(() =>
  z.discriminatedUnion('shapeKind', [
    z.object({
      id: authoredIdentifierSchema,
      shapeKind: z.literal(shapeKindSchema._zod.def.entries.LINE),
      length: shapeMeasurementDtoSchema,
      width: z.optional(shapeMeasurementDtoSchema)
    }),
    z.object({
      id: authoredIdentifierSchema,
      shapeKind: z.literal(shapeKindSchema._zod.def.entries.CONE),
      length: shapeMeasurementDtoSchema
    }),
    z.object({
      id: authoredIdentifierSchema,
      shapeKind: z.literal(shapeKindSchema._zod.def.entries.CUBE),
      edgeLength: shapeMeasurementDtoSchema
    }),
    z.object({
      id: authoredIdentifierSchema,
      shapeKind: z.literal(shapeKindSchema._zod.def.entries.CYLINDER),
      height: shapeMeasurementDtoSchema,
      radius: shapeMeasurementDtoSchema
    }),
    z.object({
      id: authoredIdentifierSchema,
      shapeKind: z.literal(shapeKindSchema._zod.def.entries.SPHERE),
      radius: shapeMeasurementDtoSchema
    }),
    z.object({
      id: authoredIdentifierSchema,
      shapeKind: z.literal(shapeKindSchema._zod.def.entries.WALL),
      length: shapeMeasurementDtoSchema,
      height: shapeMeasurementDtoSchema,
      thickness: z.optional(shapeMeasurementDtoSchema)
    }),
    z.object({
      id: authoredIdentifierSchema,
      shapeKind: z.literal(shapeKindSchema._zod.def.entries.CIRCLE),
      radius: shapeMeasurementDtoSchema
    }),
    z.object({
      id: authoredIdentifierSchema,
      shapeKind: z.literal(shapeKindSchema._zod.def.entries.DOME),
      radius: shapeMeasurementDtoSchema
    })
  ])
)

export type ShapeDto = z.infer<typeof shapeDtoSchema>

/** An area centered on a point the client picks, as the client previews it. */
export const pointAreaTargetDtoSchema = lazySchema(() =>
  z.strictObject({
    kind: z.literal('POINT'),
    area: z.discriminatedUnion('kind', [
      z.strictObject({ kind: z.literal('RADIUS'), radius: shapeMeasurementDtoSchema }),
      z.strictObject({ kind: z.literal('CUBE'), edgeLength: shapeMeasurementDtoSchema })
    ])
  })
)

/**
 * An area that starts on the caster's own token and extends toward a direction: a cone, a line, or
 * a cube from the caster's side (a cube authored with a Self range).
 */
export const directedAreaTargetDtoSchema = lazySchema(() =>
  z.strictObject({
    kind: z.literal('DIRECTED'),
    area: z.discriminatedUnion('kind', [
      z.strictObject({ kind: z.literal('CONE'), length: shapeMeasurementDtoSchema }),
      z.strictObject({
        kind: z.literal('LINE'),
        length: shapeMeasurementDtoSchema,
        width: z.optional(shapeMeasurementDtoSchema)
      }),
      z.strictObject({ kind: z.literal('CUBE_FROM_SIDE'), edgeLength: shapeMeasurementDtoSchema })
    ])
  })
)
