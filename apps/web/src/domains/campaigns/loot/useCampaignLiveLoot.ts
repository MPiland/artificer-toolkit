import { useMemo } from 'react'
import { useQuery } from 'convex/react'
import { api as convexApi } from '@artificer-toolkit/apis/convex/api'
import type {
  EncounterGmProjectionDto,
  EncounterPlayerProjectionDto
} from '@artificer-toolkit/schema/api/encounters'
import { listDefeatedCreatureLoot, listSceneLootTables } from './CampaignLiveLootPanel.model'

/**
 * The GM's live loot: the panel's props and the defeated creatures' ids for the token marker.
 * `gmView` is false for players and a GM previewing as one, which never read loot (SCENE-4).
 */
export function useCampaignLiveLoot({
  campaignId,
  encounter,
  gmView,
  sceneDefinitionId
}: {
  campaignId: string
  encounter: EncounterGmProjectionDto | EncounterPlayerProjectionDto | null | undefined
  gmView: boolean
  sceneDefinitionId: string | undefined
}) {
  const live = useQuery(
    convexApi.loot.tables.live,
    gmView && sceneDefinitionId
      ? { campaignId, sceneDefinitionId, encounterId: encounter?.id ?? null }
      : 'skip'
  )
  const actors = encounter?.actors
  return useMemo(() => {
    const creatures = listDefeatedCreatureLoot(live, actors ?? [])
    return {
      creatures,
      lootActorIds: new Set(creatures.map(({ id }) => id)),
      sceneTables: listSceneLootTables(live),
      available: live !== undefined
    }
  }, [live, actors])
}
