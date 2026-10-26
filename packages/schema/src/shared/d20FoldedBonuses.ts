import { z, lazySchema } from '../zod.js'

/** The most labelled flat bonuses one d20 test folds into its operands (cover is one). */
export const MAX_D20_FOLDED_BONUSES = 8

/**
 * A labelled flat bonus already added to an operand of the d20 test: the target's armor class or
 * save DC (`defenseOrDc`), or the roller's modifier. The evidence's `modifier` and `defenseOrDc`
 * hold the folded values the roll used; this names where the difference came from ("Half cover +2").
 */
export const d20FoldedBonusDtoSchema = lazySchema(() =>
  z.strictObject({
    label: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(500)),
    amount: z.number().check(z.int()),
    operand: z.enum(['defenseOrDc', 'modifier'])
  })
)
export type D20FoldedBonusDto = z.infer<typeof d20FoldedBonusDtoSchema>

export const d20FoldedBonusesDtoSchema = lazySchema(() =>
  z.array(d20FoldedBonusDtoSchema).check(z.maxLength(MAX_D20_FOLDED_BONUSES))
)

/** The sum of the bonuses folded into one operand. */
export function d20FoldedBonusTotal(
  bonuses: readonly D20FoldedBonusDto[] | undefined,
  operand: D20FoldedBonusDto['operand']
): number {
  return (bonuses ?? []).reduce(
    (sum, bonus) => (bonus.operand === operand ? sum + bonus.amount : sum),
    0
  )
}

/** The roll card's line for one folded bonus: "Half cover +2", or "Half cover: target's defense +2". */
export function formatD20FoldedBonus(bonus: D20FoldedBonusDto): string {
  const signed = `${bonus.amount >= 0 ? '+' : ''}${bonus.amount}`
  return bonus.operand === 'modifier'
    ? `${bonus.label} ${signed}`
    : `${bonus.label}: target's defense ${signed}`
}
