import { actorOwnerChain } from '@artificer-toolkit/shared/campaign/actorOwnership'
import type { CampaignDetailDto } from '@artificer-toolkit/schema/api/campaignCore'
import type { EncounterPlayerProjectionDto } from '@artificer-toolkit/schema/api/encounters'

type EncounterActor = Pick<
  EncounterPlayerProjectionDto['actors'][number],
  'controllerUserIds' | 'id' | 'kind' | 'owner' | 'sourceId'
>

/**
 * Whether the viewer may act for a Run actor (ADR 0034 decision 1): the GM acts for everyone, a
 * player for actors the GM granted them and for their own assigned Character, and for a summon,
 * pet or companion whose owner chain reaches one of those (D200). The server enforces the same
 * predicate; this only decides which controls to offer.
 */
export function isEncounterActorMine(
  campaign: Pick<CampaignDetailDto, 'assignedCharacter' | 'role'>,
  currentUserId: string,
  actor: EncounterActor,
  actors: readonly EncounterActor[]
): boolean {
  return (
    campaign.role === 'OWNER' ||
    actorOwnerChain(actor, (id) => actors.find((candidate) => candidate.id === id)).some(
      (candidate) =>
        candidate.controllerUserIds.includes(currentUserId) ||
        (candidate.kind === 'CHARACTER' &&
          candidate.sourceId !== null &&
          candidate.sourceId === campaign.assignedCharacter?.id)
    )
  )
}
