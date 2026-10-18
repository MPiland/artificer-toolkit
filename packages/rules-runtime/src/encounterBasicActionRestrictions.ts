import type { FacetDto } from '@artificer-toolkit/schema/shared/facet'
import { normalizeCharacterGrantRestrictions } from './character/characterGrantFoldRestrictionFacts.js'
import { holderStateRestrictionsHold, type EncounterHolderState } from './encounterActiveGrants.js'

/**
 * Whether an actor meets a basic action's authored facet `restrictions`: no restriction means every
 * actor; otherwise some group must hold, and every condition in it is decided from the holder's
 * live state. A condition an Encounter cannot decide here fails closed. When only a free hand is
 * missing and the holder can stow a held weapon for free, the action is offered with that stow
 * (D152), which the submitter must accept.
 */
export function encounterBasicActionAdmission(
  restrictions: FacetDto | null | undefined,
  holderState: EncounterHolderState
): { kind: 'MET' } | { kind: 'STOW_HELD_WEAPON'; itemInstanceId: string } | { kind: 'UNMET' } {
  const normalized = normalizeCharacterGrantRestrictions(restrictions ?? undefined)
  if (holderStateRestrictionsHold(normalized, holderState)) return { kind: 'MET' }
  const itemInstanceId = holderState.stowableHeldItemInstanceId
  return itemInstanceId !== null &&
    holderStateRestrictionsHold(normalized, { ...holderState, freeHand: true })
    ? { kind: 'STOW_HELD_WEAPON', itemInstanceId }
    : { kind: 'UNMET' }
}
