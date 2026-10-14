import type { FacetDto } from '@artificer-toolkit/schema/shared/facet'
import { normalizeCharacterGrantRestrictions } from './character/characterGrantFoldRestrictionFacts.js'
import { holderStateRestrictionsHold, type EncounterHolderState } from './encounterActiveGrants.js'

/**
 * Whether an actor meets a basic action's authored facet `restrictions`: no restriction means every
 * actor; otherwise some group must hold, and every condition in it is decided from the holder's
 * live state. A condition an Encounter cannot decide here fails closed.
 */
export function encounterBasicActionRestrictionsHold(
  restrictions: FacetDto | null | undefined,
  holderState: EncounterHolderState
): boolean {
  return holderStateRestrictionsHold(
    normalizeCharacterGrantRestrictions(restrictions ?? undefined),
    holderState
  )
}
