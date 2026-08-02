import { z } from 'zod'
import { measurementUnitCodeSchema, rangeKindSchema } from './enums.js'
import { createBreakpointScalingDtoSchema } from './scaling.js'
import { authoredIdentifierSchema } from './authoredLimits.js'

const rangeMeasurementDtoSchema = z.object({
  amount: z.number(),
  unit: measurementUnitCodeSchema
})

export const rangeDtoSchema = z.union([
  z.object({
    id: authoredIdentifierSchema,
    rangeKind: z.enum([
      rangeKindSchema.enum.SELF,
      rangeKindSchema.enum.TOUCH,
      rangeKindSchema.enum.SIGHT,
      rangeKindSchema.enum.SPECIAL,
      rangeKindSchema.enum.UNLIMITED
    ])
  }),
  z.object({
    id: authoredIdentifierSchema,
    rangeKind: z.literal(rangeKindSchema.enum.DISTANCE),
    amount: z.number(),
    unit: measurementUnitCodeSchema,
    scaling: createBreakpointScalingDtoSchema(rangeMeasurementDtoSchema).optional()
  })
])

export type RangeDto = z.infer<typeof rangeDtoSchema>
