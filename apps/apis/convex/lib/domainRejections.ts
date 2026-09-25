import type {
  DomainRejectionErrorData,
  DomainRejectionReasonDto
} from '@artificer-toolkit/schema/api/domainRejections'
import { ConvexError } from 'convex/values'

const defaultMessages: Record<DomainRejectionReasonDto, string> = {
  ACTIVE_ENCOUNTER_EXISTS: 'Campaign already has an active Encounter.',
  CAMPAIGN_NOT_ACTIVE: 'Archived Campaigns are read-only.',
  COMMAND_ID_REUSED: 'Command ID was already used with different input.',
  DECISION_NOT_PENDING: 'This decision is already settled.',
  DECISION_REQUIRES_ANSWER: 'This decision must be answered before play can continue.',
  ENCOUNTER_NOT_ACTIVE: 'Completed Encounters are read-only.',
  NOT_CURRENT_ACTOR: 'The selected actor does not have the turn.',
  PENDING_DECISION: 'An Encounter rule occurrence is awaiting resolution.',
  TARGET_UNAVAILABLE: 'The target is unavailable.',
  VERSION_STALE: 'Encounter version is stale.'
}

/**
 * Refuses an expected Encounter command. `ConvexError` data survives production error redaction
 * and nested `ctx.run*` calls, so the room and the web can show the user-safe message. Integrity
 * and unexpected failures keep throwing plain errors.
 */
export function rejectDomain(reason: DomainRejectionReasonDto, message?: string): never {
  throw new ConvexError({
    code: 'DOMAIN_REJECTED',
    reason,
    message: message ?? defaultMessages[reason]
  } satisfies DomainRejectionErrorData)
}
