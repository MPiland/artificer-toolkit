import type { CampaignSessionAttendanceDto } from '@artificer-toolkit/schema/api/campaignSessions'
import type { CampaignDetailDto } from '@artificer-toolkit/schema/api/campaignCore'

export function attendanceCanSupplyEncounterSystem(
  attendance: CampaignSessionAttendanceDto[] | undefined,
  memberships: CampaignDetailDto['memberships']
) {
  const presentCharacterIds = new Set(
    attendance?.filter((entry) => entry.present).map((entry) => entry.characterId)
  )
  return memberships.some(
    (membership) =>
      membership.assignedCharacter !== null &&
      presentCharacterIds.has(membership.assignedCharacter.id)
  )
}
