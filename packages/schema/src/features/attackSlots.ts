import { z, lazySchema } from '../zod.js'

import { authoredIdentifierSchema } from '../shared/authoredLimits.js'
import { systemCoreCodeSchema } from '../shared/systemCoreCode.js'

/** Most slots one alternative holds, most alternatives one set holds, and most attacks one slot counts. */
export const MAX_ATTACK_SLOT_ALTERNATIVES = 8
export const MAX_ATTACK_SLOTS_PER_ALTERNATIVE = 10
export const MAX_ATTACK_SLOT_COUNT = 10

/** What fills a slot: one of the Creature's own action Features, or any attack of the Attack action. */
export const attackSlotFillerDtoSchema = lazySchema(() =>
  z.discriminatedUnion('kind', [
    z.strictObject({ kind: z.literal('FEATURE'), featureId: authoredIdentifierSchema }),
    z.strictObject({ kind: z.literal('ANY_ATTACK') })
  ])
)
export type AttackSlotFillerDto = z.infer<typeof attackSlotFillerDtoSchema>

/** A predicate a slot holds only while true, over the attacks made before it and the attack's target. */
export const attackSlotConditionDtoSchema = lazySchema(() =>
  z.discriminatedUnion('kind', [
    z.strictObject({ kind: z.literal('EARLIER_SLOTS_HIT_SAME_TARGET') }),
    z.strictObject({ kind: z.literal('TARGET_SIZE_AT_MOST'), size: systemCoreCodeSchema })
  ])
)
export type AttackSlotConditionDto = z.infer<typeof attackSlotConditionDtoSchema>

export const attackSlotDtoSchema = lazySchema(() =>
  z.strictObject({
    /** How many attacks the slot takes. */
    count: z.number().check(z.int()).check(z.gte(1)).check(z.lte(MAX_ATTACK_SLOT_COUNT)),
    fillers: z.array(attackSlotFillerDtoSchema).check(z.minLength(1)).check(z.maxLength(8)),
    /** An optional slot may stay empty when its alternative ends. */
    optional: z.optional(z.boolean()),
    /** A comes-first slot is filled before any other slot of its alternative. */
    comesFirst: z.optional(z.boolean()),
    condition: z.optional(attackSlotConditionDtoSchema)
  })
)
export type AttackSlotDto = z.infer<typeof attackSlotDtoSchema>

/**
 * The attacks an action that grants attack slots (Multiattack) opens: alternatives of slots, each
 * alternative a way the action may be spent (D93). A swap ("replace one attack with a bite") is
 * another alternative.
 */
export const attackSlotSetDtoSchema = lazySchema(() =>
  z.strictObject({
    alternatives: z
      .array(
        z.strictObject({
          slots: z
            .array(attackSlotDtoSchema)
            .check(z.minLength(1))
            .check(z.maxLength(MAX_ATTACK_SLOTS_PER_ALTERNATIVE))
        })
      )
      .check(z.minLength(1))
      .check(z.maxLength(MAX_ATTACK_SLOT_ALTERNATIVES))
  })
)
export type AttackSlotSetDto = z.infer<typeof attackSlotSetDtoSchema>
