import { MAX_ROLLED_DIE_COUNT } from '@artificer-toolkit/shared/core'

import { z, lazySchema } from '../zod.js'

/** The natural d20 that scores a critical hit when no source lowers it. */
export const DEFAULT_CRITICAL_HIT_THRESHOLD = 20

/**
 * What a source's grants change about the critical hits of one attack: the lowest natural d20 that
 * scores one (Improved Critical's 19) and the extra rolls of the attack's own damage die a critical
 * hit adds (Brutal Critical). The `attackCriticalRules` source fact its attack graphs read.
 */
export const attackCriticalRulesDtoSchema = lazySchema(() =>
  z.strictObject({
    threshold: z.number().check(z.int()).check(z.gte(2)).check(z.lte(DEFAULT_CRITICAL_HIT_THRESHOLD)),
    extraDice: z.number().check(z.int()).check(z.gte(0)).check(z.lte(MAX_ROLLED_DIE_COUNT))
  })
)
export type AttackCriticalRulesDto = z.infer<typeof attackCriticalRulesDtoSchema>

/**
 * The critical rules of the grants that apply to an attack: the lowest threshold wins and extra
 * dice add. `thresholds` and `extraDice` are the amounts those grants carry.
 */
export function attackCriticalRules(
  thresholds: readonly number[],
  extraDice: readonly number[]
): AttackCriticalRulesDto {
  return {
    threshold: Math.min(DEFAULT_CRITICAL_HIT_THRESHOLD, ...thresholds),
    extraDice: extraDice.reduce((sum, amount) => sum + amount, 0)
  }
}
