import { z, lazySchema } from '../zod.js'
import { lengthUnitCodeSchema, rangeKindSchema } from './enums.js'
import { createBreakpointScalingDtoSchema } from './scaling.js'
import { authoredIdentifierSchema, authoredLengthAmountSchema } from './authoredLimits.js'

const rangeMeasurementDtoSchema = lazySchema(() =>
  z.object({
    amount: authoredLengthAmountSchema,
    unit: lengthUnitCodeSchema
  })
)

export const unlimitedRangeDtoSchema = lazySchema(() =>
  z.object({
    id: authoredIdentifierSchema,
    rangeKind: z.literal(rangeKindSchema._zod.def.entries.UNLIMITED)
  })
)

export const distanceRangeDtoSchema = lazySchema(() =>
  z
    .object({
      id: authoredIdentifierSchema,
      rangeKind: z.literal(rangeKindSchema._zod.def.entries.DISTANCE),
      amount: authoredLengthAmountSchema,
      /** A ranged weapon attack's long range ("range 80/320 ft."): beyond `amount` it has disadvantage. */
      longAmount: z.optional(authoredLengthAmountSchema),
      unit: lengthUnitCodeSchema,
      scaling: z.optional(createBreakpointScalingDtoSchema(rangeMeasurementDtoSchema))
    })
    .check(
      z.refine(
        (range) => range.longAmount === undefined || range.longAmount > range.amount,
        'Long range must be greater than the normal range.'
      )
    )
)

export const rangeDtoSchema = lazySchema(() =>
  z.union([
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
    distanceRangeDtoSchema
  ])
)

export type RangeDto = z.infer<typeof rangeDtoSchema>
