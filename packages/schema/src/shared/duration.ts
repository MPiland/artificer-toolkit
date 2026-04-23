import { z } from 'zod'
import { durationKindSchema } from './enums.js'
import { createBreakpointScalingDtoSchema } from './scaling.js'

export const durationDtoSchema = z.union([
  z.object({
    id: z.string(),
    durationKind: z.literal(durationKindSchema.enum.INSTANTANEOUS)
  }),
  z.object({
    id: z.string(),
    durationKind: z.literal(durationKindSchema.enum.UNTIL_DISPELLED)
  }),
  z.object({
    id: z.string(),
    durationKind: z.enum([
      durationKindSchema.enum.TURN,
      durationKindSchema.enum.ROUND,
      durationKindSchema.enum.MINUTE,
      durationKindSchema.enum.HOUR,
      durationKindSchema.enum.DAY,
      durationKindSchema.enum.WEEK,
      durationKindSchema.enum.MONTH,
      durationKindSchema.enum.YEAR
    ]),
    amount: z.number(),
    scaling: createBreakpointScalingDtoSchema(z.object({
      amount: z.number()
    })).optional()
  })
])

export type DurationDto = z.infer<typeof durationDtoSchema>
