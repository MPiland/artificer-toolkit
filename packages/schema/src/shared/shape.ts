import { z } from 'zod'
import { measurementUnitCodeSchema, shapeKindSchema } from './enums.js'

const shapeMeasurementDtoSchema = z.object({
  amount: z.number(),
  unit: measurementUnitCodeSchema
})

export const shapeDtoSchema = z.discriminatedUnion('shapeKind', [
  z.object({
    id: z.string(),
    shapeKind: z.literal(shapeKindSchema.enum.LINE),
    length: shapeMeasurementDtoSchema
  }),
  z.object({
    id: z.string(),
    shapeKind: z.literal(shapeKindSchema.enum.CONE),
    length: shapeMeasurementDtoSchema
  }),
  z.object({
    id: z.string(),
    shapeKind: z.literal(shapeKindSchema.enum.CUBE),
    edgeLength: shapeMeasurementDtoSchema
  }),
  z.object({
    id: z.string(),
    shapeKind: z.literal(shapeKindSchema.enum.CYLINDER),
    height: shapeMeasurementDtoSchema.optional(),
    radius: shapeMeasurementDtoSchema
  }),
  z.object({
    id: z.string(),
    shapeKind: z.literal(shapeKindSchema.enum.SPHERE),
    radius: shapeMeasurementDtoSchema
  }),
  z.object({
    id: z.string(),
    shapeKind: z.literal(shapeKindSchema.enum.WALL),
    length: shapeMeasurementDtoSchema,
    height: shapeMeasurementDtoSchema,
    thickness: shapeMeasurementDtoSchema.optional()
  }),
  z.object({
    id: z.string(),
    shapeKind: z.literal(shapeKindSchema.enum.CIRCLE),
    radius: shapeMeasurementDtoSchema
  }),
  z.object({
    id: z.string(),
    shapeKind: z.literal(shapeKindSchema.enum.DOME),
    radius: shapeMeasurementDtoSchema
  })
])

export type ShapeDto = z.infer<typeof shapeDtoSchema>
