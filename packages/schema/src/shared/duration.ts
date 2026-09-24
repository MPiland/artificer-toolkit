import { z } from '../zod.js'
import { durationKindSchema } from './enums.js'
import { createBreakpointScalingDtoSchema } from './scaling.js'
import { authoredIdentifierSchema } from './authoredLimits.js'

export const durationDtoSchema = z.union([
  z.object({
    id: authoredIdentifierSchema,
    durationKind: z.literal(durationKindSchema._zod.def.entries.INSTANTANEOUS)
  }),
  z.object({
    id: authoredIdentifierSchema,
    durationKind: z.literal(durationKindSchema._zod.def.entries.UNTIL_DISPELLED)
  }),
  z.object({
    id: authoredIdentifierSchema,
    durationKind: z.enum([
      durationKindSchema._zod.def.entries.TURN,
      durationKindSchema._zod.def.entries.ROUND,
      durationKindSchema._zod.def.entries.MINUTE,
      durationKindSchema._zod.def.entries.HOUR,
      durationKindSchema._zod.def.entries.DAY,
      durationKindSchema._zod.def.entries.WEEK,
      durationKindSchema._zod.def.entries.MONTH,
      durationKindSchema._zod.def.entries.YEAR
    ]),
    amount: z.number(),
    scaling: z.optional(
      createBreakpointScalingDtoSchema(
        z.object({
          amount: z.number()
        })
      )
    )
  })
])

export type DurationDto = z.infer<typeof durationDtoSchema>
