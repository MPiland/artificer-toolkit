import { z, lazySchema } from '../zod.js'

/** Mutable current lifecycle state. It never repeats immutable recurrence configuration. */
export const activeRuleEffectLifecycleDtoSchema = lazySchema(() =>
  z.strictObject({
    schemaVersion: z.literal(1),
    remainingTicks: z.nullable(z.number().check(z.int()).check(z.gte(1)).check(z.lte(10_000))),
    /**
     * Set once a grant is carried out of its Run (D99): it ends when the Campaign clock reaches this
     * absolute minute, or, `null` without a Campaign clock, when the GM ends it.
     */
    expiresAtCampaignMinute: z.optional(
      z.nullable(z.number().check(z.int()).check(z.gte(0)).check(z.lte(Number.MAX_SAFE_INTEGER)))
    )
  })
)

export type ActiveRuleEffectLifecycleDto = z.infer<typeof activeRuleEffectLifecycleDtoSchema>
