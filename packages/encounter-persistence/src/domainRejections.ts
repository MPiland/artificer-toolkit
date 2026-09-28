import {
  DOMAIN_REJECTION_MESSAGES,
  type DomainRejectionErrorData,
  type DomainRejectionReasonDto
} from '@artificer-toolkit/schema/api/domainRejections'
import { ConvexError } from 'convex/values'

type PlainReason = Exclude<DomainRejectionReasonDto, 'RULE_WARNINGS'>

/**
 * Refuses an expected Encounter command. `ConvexError` data survives production error redaction
 * and nested `ctx.run*` calls, so the room and the web can show the user-safe message. Integrity
 * and unexpected failures keep throwing plain errors.
 */
export function rejectDomain(reason: PlainReason, message?: string): never {
  throw new ConvexError({
    code: 'DOMAIN_REJECTED',
    reason,
    message: message ?? DOMAIN_REJECTION_MESSAGES[reason]
  } satisfies DomainRejectionErrorData)
}
