import { z, lazySchema } from '../zod.js'
import { attackSlotSetDtoSchema } from '../features/attackSlots.js'
import { systemCoreCodeSchema } from '../shared/systemCoreCode.js'
import { postgresUuidSchema } from '../shared/postgresUuid.js'

/** Most attacks one Attack action can make; bounds the stored state. */
const MAX_ATTACKS_PER_ATTACK_ACTION = 10

/**
 * The Attack action an actor has opened this turn and the attacks it has made so far. It lives in the
 * Encounter actor's `resources.attackAction`; it is stale once `turnSequence` is no longer the run's
 * current turn. Spending the turn's Action opens it; later attacks of the same kind fill it instead
 * of spending another Action.
 */
export const encounterAttackActionStateDtoSchema = lazySchema(() =>
  z.discriminatedUnion('kind', [
    z.strictObject({
      kind: z.literal('ATTACK_ACTION'),
      turnSequence: z.number().check(z.int()).check(z.nonnegative()),
      /** The ways this Attack action may be spent, fixed when it opened (D93). */
      alternatives: attackSlotSetDtoSchema.shape.alternatives,
      attacks: z
        .array(
          z.strictObject({
            actionId: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(240)),
            /** The Creature Feature the attack came from; absent for a Character's. */
            featureId: z.optional(
              z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(240))
            ),
            /** Whether it is an Attack-action attack rather than a Feature that only fills a slot. */
            attack: z.boolean(),
            targetIds: z.array(postgresUuidSchema).check(z.minLength(1)).check(z.maxLength(16)),
            /** The target's size when known; a slot's size predicate reads it. */
            targetSize: z.optional(systemCoreCodeSchema),
            /** Whether the attack roll hit, once settled; absent for an action without one. */
            hit: z.optional(z.boolean()),
            /** The item the attack was made with and its property codes; absent for an unarmed strike. */
            item: z.optional(
              z.strictObject({
                itemInstanceId: z
                  .string()
                  .check(z.trim())
                  .check(z.minLength(1))
                  .check(z.maxLength(240)),
                properties: z
                  .array(z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(100)))
                  .check(z.maxLength(100))
              })
            )
          })
        )
        .check(z.minLength(1))
        .check(z.maxLength(MAX_ATTACKS_PER_ATTACK_ACTION))
    })
  ])
)
export type EncounterAttackActionStateDto = z.infer<typeof encounterAttackActionStateDtoSchema>

/** What one attack changed in the actor's open Attack action; undo restores `before`. */
export const encounterAttackActionTransitionDtoSchema = lazySchema(() =>
  z.strictObject({
    before: z.nullable(encounterAttackActionStateDtoSchema),
    after: encounterAttackActionStateDtoSchema
  })
)
export type EncounterAttackActionTransitionDto = z.infer<
  typeof encounterAttackActionTransitionDtoSchema
>
