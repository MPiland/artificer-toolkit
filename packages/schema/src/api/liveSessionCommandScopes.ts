import { z } from '../zod.js'
import { advanceEncounterTurnInputDtoSchema } from './encounters.js'
import {
  resolveEncounterActionInputDtoSchema,
  resolveRuleOccurrenceInputDtoSchema
} from './encounterRuleCommands.js'

/**
 * A player's admitted Encounter action or action response (ADR 0034 decision 1). Every capture that
 * carries it re-admits the command, so later rules reads run for that player.
 */
export const liveSessionActionCaptureScopeSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('ACTION_COMMAND'),
    command: resolveEncounterActionInputDtoSchema
  }),
  z.strictObject({
    kind: z.literal('ACTION_RESPONSE'),
    response: resolveRuleOccurrenceInputDtoSchema
  })
])
export type LiveSessionActionCaptureScope = z.infer<typeof liveSessionActionCaptureScopeSchema>

/** A player's admitted turn command: ending their actor's turn or declaring its initiative. */
export const liveSessionTurnCaptureScopeSchema = z.discriminatedUnion('type', [
  advanceEncounterTurnInputDtoSchema,
  resolveRuleOccurrenceInputDtoSchema
])
