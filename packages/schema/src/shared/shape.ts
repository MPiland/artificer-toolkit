import { z } from 'zod'
import { measurementUnitCodeSchema, shapeKindSchema } from './enums.js'
import { createBreakpointScalingDtoSchema } from './scaling.js'
import { authoredIdentifierSchema } from './authoredLimits.js'

const shapeMeasurementDtoSchema = z.object({
  amount: z.number(),
  unit: measurementUnitCodeSchema,
  scaling: createBreakpointScalingDtoSchema(
    z.object({
      amount: z.number(),
      unit: measurementUnitCodeSchema
    })
  ).optional()
})

export const shapeDtoSchema = z.discriminatedUnion('shapeKind', [
  z.object({
    id: authoredIdentifierSchema,
    shapeKind: z.literal(shapeKindSchema.enum.LINE),
    length: shapeMeasurementDtoSchema,
    width: shapeMeasurementDtoSchema.optional()
  }),
  z.object({
    id: authoredIdentifierSchema,
    shapeKind: z.literal(shapeKindSchema.enum.CONE),
    length: shapeMeasurementDtoSchema
  }),
  z.object({
    id: authoredIdentifierSchema,
    shapeKind: z.literal(shapeKindSchema.enum.CUBE),
    edgeLength: shapeMeasurementDtoSchema
  }),
  z.object({
    id: authoredIdentifierSchema,
    shapeKind: z.literal(shapeKindSchema.enum.CYLINDER),
    height: shapeMeasurementDtoSchema.optional(),
    radius: shapeMeasurementDtoSchema
  }),
  z.object({
    id: authoredIdentifierSchema,
    shapeKind: z.literal(shapeKindSchema.enum.SPHERE),
    radius: shapeMeasurementDtoSchema
  }),
  z.object({
    id: authoredIdentifierSchema,
    shapeKind: z.literal(shapeKindSchema.enum.WALL),
    length: shapeMeasurementDtoSchema,
    height: shapeMeasurementDtoSchema,
    thickness: shapeMeasurementDtoSchema.optional()
  }),
  z.object({
    id: authoredIdentifierSchema,
    shapeKind: z.literal(shapeKindSchema.enum.CIRCLE),
    radius: shapeMeasurementDtoSchema
  }),
  z.object({
    id: authoredIdentifierSchema,
    shapeKind: z.literal(shapeKindSchema.enum.DOME),
    radius: shapeMeasurementDtoSchema
  })
])

export type ShapeDto = z.infer<typeof shapeDtoSchema>
