import { z, lazySchema } from '../zod.js'

import { postgresUuidSchema } from '../shared/postgresUuid.js'
import { createBreakpointScalingDtoSchema } from '../shared/scaling.js'

/** A condition on the target that a result block, or a follow-up save's outcome branch, checks before its effects. */
export const resultBlockGateDtoSchema = lazySchema(() =>
  z.discriminatedUnion('kind', [
    z.object({
      kind: z.enum(['TARGET_HIT_POINTS_AT_MOST', 'TARGET_HIT_POINTS_AT_LEAST']),
      amount: z.number().check(z.int()).check(z.gte(1))
    }),
    z
      .object({
        kind: z.literal('TARGET_CHALLENGE_RATING_AT_MOST'),
        maxChallengeRating: z.optional(z.number().check(z.gte(0))),
        scaling: z.optional(
          createBreakpointScalingDtoSchema(
            z.object({ maxChallengeRating: z.number().check(z.gte(0)) })
          )
        )
      })
      .check(
        z.refine(
          (gate) => gate.maxChallengeRating !== undefined || gate.scaling !== undefined,
          'A challenge rating gate needs a maximum or a scaling.'
        )
      ),
    z.object({
      kind: z.literal('REDUCED_TO_ZERO_BY'),
      damageOutcomeId: postgresUuidSchema
    })
  ])
)
