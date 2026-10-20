import {
  AmmunitionChoiceError,
  CastChoiceUnavailableError,
  HandReleaseRequiredError,
  StaleCharacterActionError,
  UnavailableCreatureActionError
} from '@artificer-toolkit/rules-runtime/encounterErrors'
import { rejectDomain } from './domainRejections.js'

/**
 * Refuses a Character action built on facts that have since changed, or a Creature action whose
 * authored mechanics cannot run, an attack whose weapon needs a hand held creatures fill, or a cast
 * whose pick its action does not offer, or an ammunition attack that names no fitting ammunition; any other error
 * passes through. It lives apart from `domainRejections` so hosts that only translate the
 * rejection (the Convex function builders, and so authoring reads) do not load Encounter rules
 * code.
 */
export function refuseStaleCharacterAction(error: unknown): never {
  if (error instanceof StaleCharacterActionError)
    rejectDomain('VERSION_STALE', 'That action is no longer available; refresh and choose again.')
  if (error instanceof UnavailableCreatureActionError || error instanceof HandReleaseRequiredError)
    rejectDomain('SOURCE_REQUIREMENTS_NOT_MET', error.message)
  if (error instanceof CastChoiceUnavailableError) rejectDomain('TARGET_UNAVAILABLE', error.message)
  if (error instanceof AmmunitionChoiceError)
    rejectDomain('SOURCE_REQUIREMENTS_NOT_MET', error.message)
  throw error
}
