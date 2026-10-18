import {
  serverContestCheckPendingContextDtoSchema,
  type ServerContestCheckPendingApplicationContextDto
} from '@artificer-toolkit/schema/shared/rulesExecution'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'

type PreparedOptionalCombatContestContext = Omit<
  ServerContestCheckPendingApplicationContextDto,
  'kind' | 'schemaVersion'
>

/** Creates the sealed, non-executable evidence context from facts locked by its caller. */
export function prepareDnd5eOptionalCombatContestPendingContext(
  input: PreparedOptionalCombatContestContext
): ServerContestCheckPendingApplicationContextDto {
  return serverContestCheckPendingContextDtoSchema.parse({
    kind: 'ENCOUNTER_CONTEST_CHECK',
    schemaVersion: 1,
    ...input
  })
}

/** Returns whether a paused contest still has exactly the caller's locked currentness facts. */
export function isDnd5eOptionalCombatContestPendingContextCurrent(input: {
  pending: ServerContestCheckPendingApplicationContextDto
  current: PreparedOptionalCombatContestContext
}): boolean {
  const sealed = serverContestCheckPendingContextDtoSchema.parse(input.pending)
  const current = prepareDnd5eOptionalCombatContestPendingContext(input.current)
  return checksumRuleDocument(sealed) === checksumRuleDocument(current)
}
