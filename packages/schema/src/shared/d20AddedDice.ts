import { z, lazySchema } from '../zod.js'
import { ruleExecutionUuidSchema } from './ruleExecutionPrimitives.js'

import { MAX_ROLLED_DIE_COUNT, ROLLED_DIE_FACES } from '@artificer-toolkit/shared/core'

/** The most rolled-die sources one d20 test carries (Bless and Bane together are two). */
export const MAX_D20_ADDED_DICE = 16

/** How many dice of which size, added or subtracted: the rolled-die modifier's payload too. */
export const rolledDieShape = () => ({
  count: z.number().check(z.int()).check(z.gte(1)).check(z.lte(MAX_ROLLED_DIE_COUNT)),
  faces: z.literal(ROLLED_DIE_FACES),
  sign: z.enum(['ADD', 'SUBTRACT'])
})

const addedDieShape = () => ({
  /** The source the roller reads beside the die ("Bless"), or "Unseen source" for a hidden one. */
  label: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(500)),
  ...rolledDieShape()
})

/**
 * Dice a d20 test rolls beside its d20 and adds to, or subtracts from, the total after advantage or
 * disadvantage keeps one d20 (D156): "+1d4 Bless", "-1d4 Bane".
 */
export const d20AddedDieDtoSchema = lazySchema(() => z.strictObject(addedDieShape()))
export type D20AddedDieDto = z.infer<typeof d20AddedDieDtoSchema>

export const d20AddedDiceDtoSchema = lazySchema(() =>
  z.array(d20AddedDieDtoSchema).check(z.maxLength(MAX_D20_ADDED_DICE))
)

/**
 * Dice an attack or a spell rolls beside its damage and adds to, or takes from, it (D156): "+1d4
 * Divine Favor" radiant, "+1d6 Hunter's Mark" of the attack's own type, "-1d4 Reduce". A die with no
 * damage type takes the damage it joins; a subtracted die always does.
 */
export const damageAddedDieDtoSchema = lazySchema(() =>
  z.strictObject({ ...addedDieShape(), damageTypeId: z.nullable(ruleExecutionUuidSchema) })
)
export type DamageAddedDieDto = z.infer<typeof damageAddedDieDtoSchema>

export const damageAddedDiceDtoSchema = lazySchema(() =>
  z.array(damageAddedDieDtoSchema).check(z.maxLength(MAX_D20_ADDED_DICE))
)

/** The graph node prefix of the damage the `index`th added die deals: how its receipt names it. */
export function damageAddedDieNodePrefix(index: number): string {
  return `added-${index + 1}-`
}

/** The added die whose damage the graph node `sourceNodeId` dealt, if it dealt one. */
export function damageAddedDieOfNode(
  dice: readonly DamageAddedDieDto[] | undefined,
  sourceNodeId: string
): DamageAddedDieDto | undefined {
  return dice?.find((_, index) => sourceNodeId.startsWith(damageAddedDieNodePrefix(index)))
}

/** An added die as the receipt records it: the request's die with the faces it rolled. */
export const d20RolledAddedDieDtoSchema = lazySchema(() =>
  z
    .strictObject({
      ...addedDieShape(),
      /** The effect whose held die a d20 window spent on this roll (D168); its commit ends the effect. */
      spentEffectId: z.optional(ruleExecutionUuidSchema),
      rolledFaces: z
        .array(z.number().check(z.int()).check(z.gte(1)))
        .check(z.minLength(1))
        .check(z.maxLength(MAX_ROLLED_DIE_COUNT))
    })
    .check(
      z.superRefine((die, context) => {
        if (
          die.rolledFaces.length !== die.count ||
          die.rolledFaces.some((face) => face > die.faces)
        )
          context.addIssue({
            code: 'custom',
            path: ['rolledFaces'],
            message: 'An added die records one face per die, each within its size.'
          })
      })
    )
)
export type D20RolledAddedDieDto = z.infer<typeof d20RolledAddedDieDtoSchema>

export const d20RolledAddedDiceDtoSchema = lazySchema(() =>
  z.array(d20RolledAddedDieDtoSchema).check(z.maxLength(MAX_D20_ADDED_DICE))
)

/**
 * The faces of a request's added dice, die by die in the request's order: what a roller enters and
 * what an app roll records. The server checks their count and sizes against the request.
 */
export const d20AddedFacesDtoSchema = lazySchema(() =>
  z
    .array(
      z
        .number()
        .check(z.int())
        .check(z.gte(1))
        .check(z.lte(Math.max(...ROLLED_DIE_FACES)))
    )
    .check(z.minLength(1))
    .check(z.maxLength(MAX_D20_ADDED_DICE * MAX_ROLLED_DIE_COUNT))
)

/** The signed sum the rolled added dice contribute to a d20 test's total. */
export function d20AddedDiceTotal(dice: readonly D20RolledAddedDieDto[] | undefined): number {
  let total = 0
  for (const die of dice ?? []) {
    const sum = die.rolledFaces.reduce((faces, face) => faces + face, 0)
    total += die.sign === 'SUBTRACT' ? -sum : sum
  }
  return total
}
