import { z } from '../zod.js'
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
      rangeKindSchema._zod.def.entries.SELF,
      rangeKindSchema._zod.def.entries.TOUCH,
      rangeKindSchema._zod.def.entries.SIGHT,
      rangeKindSchema._zod.def.entries.SPECIAL,
      rangeKindSchema._zod.def.entries.UNLIMITED
    ])
  }),
  z
    .object({
      id: authoredIdentifierSchema,
      rangeKind: z.literal(rangeKindSchema._zod.def.entries.DISTANCE),
      amount: z.number(),
      /** A ranged weapon attack's long range ("range 80/320 ft."): beyond `amount` it has disadvantage. */
      longAmount: z.optional(z.number()),
      unit: measurementUnitCodeSchema,
      scaling: z.optional(createBreakpointScalingDtoSchema(rangeMeasurementDtoSchema))
    })
    .check(
      z.refine(
        (range) => range.longAmount === undefined || range.longAmount > range.amount,
        'Long range must be greater than the normal range.'
      )
    )
])

export type RangeDto = z.infer<typeof rangeDtoSchema>
