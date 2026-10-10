import { StaleCharacterActionError } from '@artificer-toolkit/rules-runtime/encounterErrors'
import {
  DOMAIN_REJECTION_MESSAGES,
  type DomainRejectionErrorData,
  type DomainRejectionReasonDto
} from '@artificer-toolkit/schema/api/domainRejections'

type PlainReason = Exclude<DomainRejectionReasonDto, 'RULE_WARNINGS'>

/**
 * An expected, user-safe refusal of an Encounter command. The package owns it so the code runs
 * without the Convex runtime; each host turns it into its own transport once, at its function
 * boundary (Convex: a `ConvexError` with this exact data, in `apps/apis/convex/lib`).
 */
export class EncounterDomainRejection extends Error {
  readonly data: DomainRejectionErrorData

  constructor(data: DomainRejectionErrorData) {
    // The message is the data's JSON, as a ConvexError's is, so logs and callers see one form.
    super(JSON.stringify(data))
    this.name = 'EncounterDomainRejection'
    this.data = data
  }
}

/** Refuses a Character action built on facts that have since changed; any other error passes through. */
export function refuseStaleCharacterAction(error: unknown): never {
  if (error instanceof StaleCharacterActionError)
    rejectDomain('VERSION_STALE', 'That action is no longer available; refresh and choose again.')
  throw error
}

/** Refuses an expected Encounter command. Integrity and unexpected failures throw plain errors. */
export function rejectDomain(reason: PlainReason, message?: string): never {
  throw new EncounterDomainRejection({
    code: 'DOMAIN_REJECTED',
    reason,
    message: message ?? DOMAIN_REJECTION_MESSAGES[reason]
  })
}
