import { z, lazySchema } from '../zod.js'

import { postgresUuidSchema } from '../shared/postgresUuid.js'

/** A condition on the target that a result block, or a follow-up save's outcome branch, checks before its effects. */
export const resultBlockGateDtoSchema = lazySchema(() =>
  z.discriminatedUnion('kind', [
    z.object({
      kind: z.enum(['TARGET_HIT_POINTS_AT_MOST', 'TARGET_HIT_POINTS_AT_LEAST']),
      amount: z.number().check(z.int()).check(z.gte(1))
    }),
    z.object({
      kind: z.literal('REDUCED_TO_ZERO_BY'),
      damageOutcomeId: postgresUuidSchema
    })
  ])
)
