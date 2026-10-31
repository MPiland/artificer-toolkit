import { z, lazySchema } from '../zod.js'

/**
 * The share of its hit point maximum a holder keeps under its conditions' `HIT_POINT_MAXIMUM`
 * mechanics (SPELLS-10.T1b), at most 1. Stored on the holder; absent means the whole maximum.
 */
export const hitPointMaximumFractionDtoSchema = lazySchema(() =>
  z.strictObject({
    numerator: z.number().check(z.int()).check(z.positive()),
    denominator: z.number().check(z.int()).check(z.positive())
  })
)

export type HitPointMaximumFractionDto = z.infer<typeof hitPointMaximumFractionDtoSchema>
