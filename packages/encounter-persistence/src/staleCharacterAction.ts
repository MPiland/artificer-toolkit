import { StaleCharacterActionError } from '@artificer-toolkit/rules-runtime/encounterErrors'
import { rejectDomain } from './domainRejections.js'

/**
 * Refuses a Character action built on facts that have since changed; any other error passes
 * through. It lives apart from `domainRejections` so hosts that only translate the rejection
 * (the Convex function builders, and so authoring reads) do not load Encounter rules code.
 */
export function refuseStaleCharacterAction(error: unknown): never {
  if (error instanceof StaleCharacterActionError)
    rejectDomain('VERSION_STALE', 'That action is no longer available; refresh and choose again.')
  throw error
}
