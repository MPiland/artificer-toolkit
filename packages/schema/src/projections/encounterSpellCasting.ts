import { z, lazySchema } from '../zod.js'

/**
 * What an actor has cast this turn that limits its next spell: it lives in the Encounter actor's
 * `resources.spellCasting` and is stale once `turnSequence` is no longer the run's current turn.
 * `bonusActionSpell` is set by a spell cast with a bonus action; `actionSpell` by a spell other than a
 * cantrip cast with an action.
 */
export const encounterSpellCastingStateDtoSchema = lazySchema(() =>
  z.strictObject({
    turnSequence: z.number().check(z.int()).check(z.nonnegative()),
    bonusActionSpell: z.boolean(),
    actionSpell: z.boolean()
  })
)
export type EncounterSpellCastingStateDto = z.infer<typeof encounterSpellCastingStateDtoSchema>

/** What one spell cast changed in the actor's spell-casting record; undo restores `before`. */
export const encounterSpellCastingTransitionDtoSchema = lazySchema(() =>
  z.strictObject({
    before: z.nullable(encounterSpellCastingStateDtoSchema),
    after: encounterSpellCastingStateDtoSchema
  })
)
export type EncounterSpellCastingTransitionDto = z.infer<
  typeof encounterSpellCastingTransitionDtoSchema
>
