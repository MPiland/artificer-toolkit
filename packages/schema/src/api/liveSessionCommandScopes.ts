import { z, lazySchema } from '../zod.js'
import { advanceEncounterTurnInputDtoSchema } from './encounters.js'
import {
  changeFacingInputDtoSchema,
  endHeldGrantInputDtoSchema,
  escapeRelationshipInputDtoSchema,
  moveHeldEffectInputDtoSchema,
  releaseRelationshipInputDtoSchema,
  resolveCheckActionInputDtoSchema,
  resolveEncounterActionInputDtoSchema,
  resolveRuleOccurrenceInputDtoSchema
} from './encounterRuleCommands.js'

/**
 * A CHECK action, an Escape, the end of a held grant, the move of a held effect, a facing change
 * or a relationship's release, or the answer to the check either of the first two started.
 */
export const liveSessionEncounterBasicActionCommandSchema = lazySchema(() =>
  z.discriminatedUnion('type', [
    resolveCheckActionInputDtoSchema,
    escapeRelationshipInputDtoSchema,
    endHeldGrantInputDtoSchema,
    moveHeldEffectInputDtoSchema,
    changeFacingInputDtoSchema,
    releaseRelationshipInputDtoSchema,
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
    /** A contest (Disarm, Grapple, Shove, a contested escape), or a participant's d20 for one. */
    z.strictObject({
      kind: z.literal('CONTEST'),
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
