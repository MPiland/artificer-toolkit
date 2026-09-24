import { z } from '../zod.js'
import { characterMechanicsReadInputSchema } from './characterMechanicsRead.js'
import { characterInitiativeActorFactsSchema } from '../projections/characterInitiativeFacts.js'
import { characterRulePolicyOutputSchema } from './characterRules.js'

export const characterEncounterInitiativeInputSchema = characterMechanicsReadInputSchema

/** Server mechanics only; this result is never exposed as a viewer projection. */
export const characterEncounterInitiativeResultSchema = z.strictObject({
  initiativeActorFacts: characterInitiativeActorFactsSchema,
  rulePolicyOutput: characterRulePolicyOutputSchema
})

export type CharacterEncounterInitiativeInput = z.infer<
  typeof characterEncounterInitiativeInputSchema
>
export type CharacterEncounterInitiativeResult = z.infer<
  typeof characterEncounterInitiativeResultSchema
>
