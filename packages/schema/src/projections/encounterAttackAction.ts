import { z, lazySchema } from '../zod.js'
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
      total: z.number().check(z.int()).check(z.gte(1)).check(z.lte(MAX_ATTACKS_PER_ATTACK_ACTION)),
      attacks: z
        .array(
          z.strictObject({
            actionId: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(240)),
            /** Empty for an attack aimed at a square no one stands on. */
            targetIds: z.array(postgresUuidSchema).check(z.maxLength(16))
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
