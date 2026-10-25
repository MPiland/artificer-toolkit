import { z, lazySchema } from '../zod.js'
import { d20AddedDiceTotal, type D20RolledAddedDieDto } from './d20AddedDice.js'
import { ruleExecutionIdentifierSchema } from './ruleExecutionPrimitives.js'

/**
 * The d20 floor a test applies to the face it kept (Glibness's 15, Reliable Talent's 10): the
 * amount, the source the roller reads beside it ("Glibness", or "Unseen source" for a hidden one)
 * and the active effect or Character grant source that gave it. Several floors on one test reduce
 * to the highest.
 */
export const d20MinimumRollDtoSchema = lazySchema(() =>
  z.strictObject({
    amount: z.number().check(z.int()).check(z.gte(2)).check(z.lte(20)),
    label: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(500)),
    sourceId: ruleExecutionIdentifierSchema
  })
)
export type D20MinimumRollDto = z.infer<typeof d20MinimumRollDtoSchema>

/**
 * The d20 a check counts after its floor: the kept face, raised to the floor when it is lower. The
 * floor applies to the kept face, so rolling it per die and keeping one gives the same number.
 */
export function d20CountedNatural(
  selectedNatural: number,
  minimumRoll: Pick<D20MinimumRollDto, 'amount'> | undefined
): number {
  return Math.max(selectedNatural, minimumRoll?.amount ?? selectedNatural)
}

/** A check's total: the counted d20, its modifier and its signed added dice (D156). */
export function d20CheckTotal(d20: {
  selectedNatural: number
  modifier: number
  addedDice?: readonly D20RolledAddedDieDto[] | undefined
  minimumRoll?: Pick<D20MinimumRollDto, 'amount'> | undefined
}): number {
  return (
    d20CountedNatural(d20.selectedNatural, d20.minimumRoll) +
    d20.modifier +
    d20AddedDiceTotal(d20.addedDice)
  )
}
