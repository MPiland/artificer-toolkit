import { z, lazySchema } from '../zod.js'
import { advanceEncounterTurnInputDtoSchema } from './encounters.js'
import {
  escapeRelationshipInputDtoSchema,
  resolveEncounterActionInputDtoSchema,
  resolveRuleOccurrenceInputDtoSchema
} from './encounterRuleCommands.js'

/** A CHECK action or an Escape, or the answer to the check either started (First Aid, Escape). */
export const liveSessionEncounterBasicActionCommandSchema = lazySchema(() =>
  z.discriminatedUnion('type', [
    resolveEncounterActionInputDtoSchema,
    escapeRelationshipInputDtoSchema,
    resolveRuleOccurrenceInputDtoSchema
  ])
)
export type LiveSessionEncounterBasicActionCommand = z.infer<
  typeof liveSessionEncounterBasicActionCommandSchema
>

/**
 * A player's admitted Encounter action or action response (ADR 0034 decision 1). Every capture that
 * carries it re-admits the command, so later rules reads run for that player.
 */
export const liveSessionActionCaptureScopeSchema = lazySchema(() =>
  z.discriminatedUnion('kind', [
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
    }),
    /** One of the System's basic actions (Q11), or the helper's d20 for its check. */
    z.strictObject({
      kind: z.literal('BASIC_ACTION'),
      command: liveSessionEncounterBasicActionCommandSchema
    })
  ])
)
export type LiveSessionActionCaptureScope = z.infer<typeof liveSessionActionCaptureScopeSchema>

/** A player's admitted turn command: ending their actor's turn or declaring its initiative. */
export const liveSessionTurnCaptureScopeSchema = lazySchema(() =>
  z.discriminatedUnion('type', [
    advanceEncounterTurnInputDtoSchema,
    resolveRuleOccurrenceInputDtoSchema
  ])
)
