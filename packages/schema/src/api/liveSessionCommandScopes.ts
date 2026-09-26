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
  }),
  /** The source actor's controller choosing or declining the next Cleaving target. */
  z.strictObject({
    kind: z.literal('CLEAVING_RESPONSE'),
    response: resolveRuleOccurrenceInputDtoSchema
  }),
  /** A Disarm, or a participant's d20 for one. */
  z.strictObject({
    kind: z.literal('DISARM'),
    command: z.discriminatedUnion('type', [
      resolveEncounterActionInputDtoSchema,
      resolveRuleOccurrenceInputDtoSchema
    ])
  })
])
export type LiveSessionActionCaptureScope = z.infer<typeof liveSessionActionCaptureScopeSchema>

/** A player's admitted turn command: ending their actor's turn or declaring its initiative. */
export const liveSessionTurnCaptureScopeSchema = z.discriminatedUnion('type', [
  advanceEncounterTurnInputDtoSchema,
  resolveRuleOccurrenceInputDtoSchema
])
