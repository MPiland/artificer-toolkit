import {
  serverContestCheckPendingContextDtoSchema,
  type ServerContestCheckPendingApplicationContextDto
} from '@artificer-toolkit/schema/shared/rulesExecution'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'

export type EncounterContestPendingContextInput = Omit<
  ServerContestCheckPendingApplicationContextDto,
  'kind' | 'schemaVersion'
>

/** Creates the sealed, non-executable evidence context from facts locked by its caller. */
export function prepareEncounterContestPendingContext(
  input: EncounterContestPendingContextInput
): ServerContestCheckPendingApplicationContextDto {
  return serverContestCheckPendingContextDtoSchema.parse({
    kind: 'ENCOUNTER_CONTEST_CHECK',
    schemaVersion: 1,
    ...input
  })
}

/** Returns whether a paused contest still has exactly the caller's locked currentness facts. */
export function isEncounterContestPendingContextCurrent(input: {
  pending: ServerContestCheckPendingApplicationContextDto
  current: EncounterContestPendingContextInput
}): boolean {
  const sealed = serverContestCheckPendingContextDtoSchema.parse(input.pending)
  const current = prepareEncounterContestPendingContext(input.current)
  return checksumRuleDocument(sealed) === checksumRuleDocument(current)
}
