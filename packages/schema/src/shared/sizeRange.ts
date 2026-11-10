import { z, lazySchema } from '../zod.js'

const sizeCodeSchema = lazySchema(() =>
  z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(80))
)

/**
 * A closed range of System sizes, either bound optional and inclusive. At least one bound is
 * required: an empty range would match every creature and say nothing.
 */
export const sizeRangeDtoSchema = lazySchema(() =>
  z
    .strictObject({
      minimumSizeCode: z.optional(sizeCodeSchema),
      maximumSizeCode: z.optional(sizeCodeSchema)
    })
    .check(
      z.refine(
        (range) => range.minimumSizeCode !== undefined || range.maximumSizeCode !== undefined,
        'A size range needs a minimum, a maximum, or both.'
      )
    )
)
