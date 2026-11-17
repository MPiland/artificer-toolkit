import { useMemo } from 'react'
import type { CampaignDetailDto } from '@artificer-toolkit/schema/api/campaignCore'
import type { CampaignSceneStateDto } from '@artificer-toolkit/schema/api/vttScenes'
import type { PendingEncounterRuleOccurrenceSummaryDto } from '@artificer-toolkit/schema/shared/encounterRuleOccurrence'
import { isEncounterActorMine } from './encounterActorControl'
import { forcedMovementDestinationPick } from './vttForcedMovementPick.model'

/**
 * A forced movement waiting on its source (D157): the pending occurrence, and the destination pick
 * the board offers the viewer when they act for that source (null for anyone else).
 */
export function useForcedMovementDestination({
  actorIdByTokenId,
  actors,
  campaign,
  currentUserId,
  pendingOccurrence,
  scene
}: {
  actorIdByTokenId: ReadonlyMap<string, string>
  actors: Parameters<typeof isEncounterActorMine>[3]
  campaign: CampaignDetailDto
  currentUserId: string
  pendingOccurrence: PendingEncounterRuleOccurrenceSummaryDto | null | undefined
  scene: Pick<CampaignSceneStateDto, 'grid' | 'tokens'> | null | undefined
}) {
  const pending =
    pendingOccurrence?.kind === 'FORCED_MOVEMENT_DESTINATION' ? pendingOccurrence : null
  const source = actors.find(({ id }) => id === pending?.sourceActorId)
  const targetTokenId = [...actorIdByTokenId].find(
    ([, actorId]) => actorId === pending?.targetActorId
  )?.[0]
  const pick = useMemo(
    () =>
      pending &&
      scene &&
      targetTokenId &&
      source &&
      isEncounterActorMine(campaign, currentUserId, source, actors)
        ? forcedMovementDestinationPick({ pending, scene, targetTokenId })
        : null,
    [actors, campaign, currentUserId, pending, scene, source, targetTokenId]
  )
  return { pending, pick }
}
