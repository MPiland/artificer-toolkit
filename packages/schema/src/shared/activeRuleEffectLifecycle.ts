import { z, lazySchema } from '../zod.js'

/** Mutable current lifecycle state. It never repeats immutable recurrence configuration. */
export const activeRuleEffectLifecycleDtoSchema = lazySchema(() =>
  z.strictObject({
    schemaVersion: z.literal(1),
    remainingTicks: z.nullable(z.number().check(z.int()).check(z.gte(1)).check(z.lte(10_000)))
  })
)

export type ActiveRuleEffectLifecycleDto = z.infer<typeof activeRuleEffectLifecycleDtoSchema>
