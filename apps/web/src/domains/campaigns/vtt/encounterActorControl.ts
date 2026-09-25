import type { CampaignDetailDto } from '@artificer-toolkit/schema/api/campaignCore'
import type { EncounterPlayerProjectionDto } from '@artificer-toolkit/schema/api/encounters'

/**
 * Whether the viewer may act for a Run actor (ADR 0034 decision 1): the GM acts for everyone, a
 * player for actors the GM granted them and for their own assigned Character. The server enforces
 * the same predicate; this only decides which controls to offer.
 */
export function isEncounterActorMine(
  campaign: Pick<CampaignDetailDto, 'assignedCharacter' | 'role'>,
  currentUserId: string,
  actor: Pick<
    EncounterPlayerProjectionDto['actors'][number],
    'controllerUserIds' | 'kind' | 'sourceId'
  >
): boolean {
  return (
    campaign.role === 'OWNER' ||
    actor.controllerUserIds.includes(currentUserId) ||
    (actor.kind === 'CHARACTER' &&
      actor.sourceId !== null &&
      actor.sourceId === campaign.assignedCharacter?.id)
  )
}
