import { z } from 'zod'
import { measurementUnitCodeSchema, rangeKindSchema } from './enums.js'
import { createBreakpointScalingDtoSchema } from './scaling.js'

const rangeMeasurementDtoSchema = z.object({
  amount: z.number(),
  unit: measurementUnitCodeSchema
})

export const rangeDtoSchema = z.union([
  z.object({
    id: z.string(),
    rangeKind: z.enum([
      rangeKindSchema.enum.SELF,
      rangeKindSchema.enum.TOUCH,
      rangeKindSchema.enum.SIGHT,
      rangeKindSchema.enum.SPECIAL,
      rangeKindSchema.enum.UNLIMITED
    ])
  }),
  z.object({
    id: z.string(),
    rangeKind: z.literal(rangeKindSchema.enum.DISTANCE),
    amount: z.number(),
    unit: measurementUnitCodeSchema,
    scaling: createBreakpointScalingDtoSchema(rangeMeasurementDtoSchema).optional()
  })
])

export type RangeDto = z.infer<typeof rangeDtoSchema>
