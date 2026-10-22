import { splitAbsoluteMinute } from '@artificer-toolkit/rules-runtime/campaignClock'
import type { ActiveGrantListingDto } from '@artificer-toolkit/schema/shared/activeGrantListing'

const HIDDEN_GRANT_SOURCE_LABEL = 'Hidden source'

export function activeGrantLabel(grant: ActiveGrantListingDto): string {
  return grant.label ?? HIDDEN_GRANT_SOURCE_LABEL
}

/** What is left of a grant: rounds during a Run, a Campaign-clock end once carried over, else open. */
export function activeGrantTimeLeft(grant: ActiveGrantListingDto): string {
  if (grant.remainingTicks !== null)
    return `${grant.remainingTicks} ${grant.remainingTicks === 1 ? 'round' : 'rounds'} left`
  if (grant.expiresAtCampaignMinute === null) return 'Until ended'
  const { day, minuteOfDay } = splitAbsoluteMinute(grant.expiresAtCampaignMinute)
  const hours = Math.floor(minuteOfDay / 60)
    .toString()
    .padStart(2, '0')
  const minutes = (minuteOfDay % 60).toString().padStart(2, '0')
  return `Until day ${day}, ${hours}:${minutes}`
}
