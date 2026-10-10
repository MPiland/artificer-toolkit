import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import type { CharacterSheetCommandInputDto } from '@artificer-toolkit/schema/api/characterSheetCommandInputs'
import { getCharacterConcentrationRoomRoute } from '#app/data/characters/queries'
import { useCampaignLiveSession } from '#app/domains/campaigns/vtt/useCampaignLiveSession'

/**
 * The live room that ends a caster's Concentration for the Characters its Encounter still holds
 * (SPELLS-5.11), or null when Convex settles the end itself. The mutation sends Convex's command
 * first and this one after it, under the same command id. The caster is not held, so the room only
 * ends the held holders' grants.
 */
export function useConcentrationRoomRoute(
  characterId: string,
  campaignId: string | null | undefined
) {
  const route = useQuery(getCharacterConcentrationRoomRoute(characterId, campaignId))
  const encounterId = route.data?.encounterId
  const { commandReady, sendCharacterSheetCommand } = useCampaignLiveSession({
    campaignId: campaignId ?? '',
    enabled: Boolean(campaignId && encounterId)
  })
  return useMemo(
    () =>
      encounterId && commandReady
        ? (command: Extract<CharacterSheetCommandInputDto, { type: 'END_CONCENTRATION' }>) =>
            sendCharacterSheetCommand({ characterId, encounterId, command })
        : null,
    [characterId, commandReady, encounterId, sendCharacterSheetCommand]
  )
}
