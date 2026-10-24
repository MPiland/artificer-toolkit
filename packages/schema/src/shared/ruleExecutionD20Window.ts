import { z, lazySchema } from '../zod.js'
import { encounterPauseVariants } from './encounterPause.js'
import { encounterCheckActionPendingContextDtoSchema } from './ruleExecutionCheckAction.js'
import {
  encounterConcealmentCheckPendingContextDtoSchema,
  encounterEscapeCheckPendingContextDtoSchema
} from './ruleExecutionDirectActionPendingContexts.js'
import {
  ruleExecutionChecksumSchema as checksumSchema,
  ruleExecutionUuidSchema as uuidSchema
} from './ruleExecutionPrimitives.js'

/**
 * The d20 test a window follows. Each kind freezes the check the roller already rolled; a later
 * kind adds a member here and its settle, never a second pause.
 */
export const d20WindowSourceDtoSchema = lazySchema(() =>
  z.discriminatedUnion('kind', [
    z.strictObject({
      kind: z.literal('CHECK_ACTION'),
      context: encounterCheckActionPendingContextDtoSchema
    }),
    z.strictObject({
      kind: z.literal('CONCEALMENT_CHECK'),
      context: encounterConcealmentCheckPendingContextDtoSchema
    }),
    z.strictObject({
      kind: z.literal('ESCAPE_CHECK'),
      context: encounterEscapeCheckPendingContextDtoSchema
    })
  ])
)

export const encounterD20WindowPendingContextDtoSchema = lazySchema(() =>
  z.strictObject({
    kind: z.literal('ENCOUNTER_D20_WINDOW'),
    schemaVersion: z.literal(1),
    commandId: uuidSchema,
    commandFingerprint: checksumSchema,
    source: d20WindowSourceDtoSchema,
    pause: encounterPauseVariants().D20_WINDOW
  })
)

export type EncounterD20WindowPendingContextDto = z.infer<
  typeof encounterD20WindowPendingContextDtoSchema
>
