import {
  serverOptionalCombatContestPendingContextDtoSchema,
  type ServerOptionalCombatContestPendingApplicationContextDto
} from '@artificer-toolkit/schema/shared/rulesExecution'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'

type PreparedOptionalCombatContestContext = Omit<
  ServerOptionalCombatContestPendingApplicationContextDto,
  'kind' | 'schemaVersion'
>

/** Creates the sealed, non-executable evidence context from facts locked by its caller. */
export function prepareDnd5eOptionalCombatContestPendingContext(
  input: PreparedOptionalCombatContestContext
): ServerOptionalCombatContestPendingApplicationContextDto {
  return serverOptionalCombatContestPendingContextDtoSchema.parse({
    kind: 'ENCOUNTER_OPTIONAL_COMBAT_CONTEST',
    schemaVersion: 1,
    ...input
  })
}

/** Returns whether a paused contest still has exactly the caller's locked currentness facts. */
export function isDnd5eOptionalCombatContestPendingContextCurrent(input: {
  pending: ServerOptionalCombatContestPendingApplicationContextDto
  current: PreparedOptionalCombatContestContext
}): boolean {
  const sealed = serverOptionalCombatContestPendingContextDtoSchema.parse(input.pending)
  const current = prepareDnd5eOptionalCombatContestPendingContext(input.current)
  return checksumRuleDocument(sealed) === checksumRuleDocument(current)
}
