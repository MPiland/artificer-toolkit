import { ENTITLEMENT_LIMITS } from '@artificer-toolkit/shared/account/entitlements'
import type { EncounterDocument, EncounterQueryInitializer } from './store.js'

/** Both hosts validate the same bounded roster before choosing a message's access timestamp. */
export async function readActiveCampaignMembers(
  query: EncounterQueryInitializer<'campaignMemberships'>,
  campaign: EncounterDocument<'campaigns'>
) {
  const maxPlayers = Math.max(
    ...Object.values(ENTITLEMENT_LIMITS).map((tier) => tier.playerSeatsPerCampaign)
  )
  const members = await query
    .withIndex('by_campaignId_status', (q) =>
      q.eq('campaignId', campaign.id).eq('status', 'ACTIVE')
    )
    .take(maxPlayers + 2)
  if (members.length > maxPlayers + 1) throw new Error('Campaign player capacity exceeded.')
  const owners = members.filter((member) => member.role === 'OWNER')
  if (
    owners.length !== 1 ||
    owners[0]!.userId !== campaign.ownerUserId ||
    new Set(members.map((member) => member.userId)).size !== members.length
  )
    throw new Error('Stored Campaign membership authority mismatch.')
  return members.sort(
    (left, right) =>
      (left.role === right.role ? 0 : left.role === 'OWNER' ? -1 : 1) ||
      left.joinedAt.localeCompare(right.joinedAt) ||
      left.userId.localeCompare(right.userId)
  )
}
