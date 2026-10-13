import { z, lazySchema } from '../zod.js'
import { lengthUnitCodeSchema, shapeKindSchema } from './enums.js'
import { createBreakpointScalingDtoSchema } from './scaling.js'
import { authoredIdentifierSchema } from './authoredLimits.js'

export const shapeMeasurementDtoSchema = lazySchema(() =>
  z.object({
    amount: z.number(),
    unit: lengthUnitCodeSchema,
    scaling: z.optional(
      createBreakpointScalingDtoSchema(
        z.object({
          amount: z.number(),
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
