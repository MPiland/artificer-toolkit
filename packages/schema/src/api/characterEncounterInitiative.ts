import { z, lazySchema } from '../zod.js'
import { characterMechanicsReadInputSchema } from './characterMechanicsRead.js'
import { characterInitiativeActorFactsSchema } from '../projections/characterInitiativeFacts.js'
import { characterRulePolicyOutputSchema } from './characterRules.js'

/** A same-transaction read; the loaded Character's stream version is returned, not expected. */
export const characterEncounterInitiativeInputSchema = lazySchema(() =>
  z.omit(characterMechanicsReadInputSchema, {
    streamVersion: true
  })
)

/** Server mechanics only; this result is never exposed as a viewer projection. */
export const characterEncounterInitiativeResultSchema = lazySchema(() =>
  z.strictObject({
    streamVersion: z.number().check(z.int()).check(z.nonnegative()),
    initiativeActorFacts: characterInitiativeActorFactsSchema,
    rulePolicyOutput: characterRulePolicyOutputSchema
  })
)

export type CharacterEncounterInitiativeInput = z.infer<
  typeof characterEncounterInitiativeInputSchema
>
export type CharacterEncounterInitiativeResult = z.infer<
  typeof characterEncounterInitiativeResultSchema
>
