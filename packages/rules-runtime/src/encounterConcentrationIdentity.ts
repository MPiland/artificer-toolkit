import { v5 as uuidv5 } from 'uuid'
import type { encounterConcentrationDamageCheckPendingContextDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionDirectActionPendingContexts'

type NativeConcentrationContext = ReturnType<
  typeof encounterConcentrationDamageCheckPendingContextDtoSchema.parse
>

// Retains the established deterministic child/command identity from the prior backend.
const concentrationNamespace = 'd4b06f4e-c014-49b6-8e39-3a2c790f8d57'
export function concentrationOccurrenceId(
  parentOccurrenceId: string,
  application: NativeConcentrationContext['application']
) {
  return uuidv5(
    `${parentOccurrenceId}:${application.ordinal}:${application.sourceNodeId}:${application.sourceOperationKey}:${application.targetActorId}:concentration-damage-check`,
    concentrationNamespace
  )
}
/** One CONCENTRATION_END child per ended maintained state of a parent commit. */
export function concentrationEndOccurrenceId(
  parentOccurrenceId: string,
  maintainedStateId: string
) {
  return uuidv5(
    `${parentOccurrenceId}:${maintainedStateId}:concentration-end`,
    concentrationNamespace
  )
}
/** The chat entry that tells the table a holder's state ended this grant; a replay reuses it. */
export function grantEndNoticeId(occurrenceId: string, grantId: string) {
  return uuidv5(`${occurrenceId}:${grantId}:grant-end-notice`, concentrationNamespace)
}
export function concentrationCommandId(occurrenceId: string) {
  return uuidv5(`${occurrenceId}:command`, concentrationNamespace)
}
