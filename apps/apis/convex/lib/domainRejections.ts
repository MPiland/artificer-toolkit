import type {
  DomainRejectionErrorData,
  DomainRejectionReasonDto
} from '@artificer-toolkit/schema/api/domainRejections'
import type { EncounterRuleWarningDto } from '@artificer-toolkit/schema/shared/encounterRuleWarnings'
import { RULE_WARNINGS_MESSAGE } from '@artificer-toolkit/rules-runtime/encounterActionRuleWarnings'
import { ConvexError } from 'convex/values'

type PlainReason = Exclude<DomainRejectionReasonDto, 'RULE_WARNINGS'>

const defaultMessages: Record<PlainReason, string> = {
  ACTIVE_ENCOUNTER_EXISTS: 'Campaign already has an active Encounter.',
  CAMPAIGN_NOT_ACTIVE: 'Archived Campaigns are read-only.',
  COMMAND_ID_REUSED: 'Command ID was already used with different input.',
  DECISION_NOT_PENDING: 'This decision is already settled.',
  DECISION_REQUIRES_ANSWER: 'This decision must be answered before play can continue.',
  ENCOUNTER_NOT_ACTIVE: 'Completed Encounters are read-only.',
  NOT_ACTOR_CONTROLLER: "You don't control this actor.",
  NOT_CURRENT_ACTOR: 'The selected actor does not have the turn.',
  PENDING_DECISION: 'An Encounter rule occurrence is awaiting resolution.',
  REVERT_UNAVAILABLE: "The last action can't be undone; adjust manually.",
  ROLL_UNAVAILABLE: 'That roll no longer applies to this decision; roll again.',
  TARGET_UNAVAILABLE: 'The target is unavailable.',
  VERSION_STALE: 'Encounter version is stale.'
}

/**
 * Refuses an expected Encounter command. `ConvexError` data survives production error redaction
 * and nested `ctx.run*` calls, so the room and the web can show the user-safe message. Integrity
 * and unexpected failures keep throwing plain errors.
 */
export function rejectDomain(reason: PlainReason, message?: string): never {
  throw new ConvexError({
    code: 'DOMAIN_REJECTED',
    reason,
    message: message ?? defaultMessages[reason]
  } satisfies DomainRejectionErrorData)
}

/** Refuses an Assisted action whose overridable warnings were not all acknowledged. */
export function rejectRuleWarnings(warnings: EncounterRuleWarningDto[]): never {
  throw new ConvexError({
    code: 'DOMAIN_REJECTED',
    reason: 'RULE_WARNINGS',
    message: RULE_WARNINGS_MESSAGE,
    warnings
  } satisfies DomainRejectionErrorData)
}
