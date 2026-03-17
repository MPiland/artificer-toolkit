import { z } from 'zod'
import { measurementUnitCodeSchema, rangeKindSchema } from './enums.js'

export const rangeDtoSchema = z.union([
  z.object({
    id: z.string(),
    rangeKind: z.enum([
      rangeKindSchema.enum.SELF,
      rangeKindSchema.enum.TOUCH,
      rangeKindSchema.enum.SIGHT,
      rangeKindSchema.enum.UNLIMITED
    ])
  }),
  z.object({
    id: z.string(),
    rangeKind: z.literal(rangeKindSchema.enum.DISTANCE),
    amount: z.number(),
    unit: measurementUnitCodeSchema
  })
])

export type RangeDto = z.infer<typeof rangeDtoSchema>
