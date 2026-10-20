import { convexQuery } from '@convex-dev/react-query'
import { usePaginatedQuery } from 'convex/react'
import { api as convexApi } from '@artificer-toolkit/apis/convex/api'
import { useLoadAllPages } from '#app/data/useLoadAllPages'

export function getEncounter(encounterId: string | null) {
  return convexQuery(
    convexApi.encounters.projectionReads.get,
    encounterId ? { encounterId } : 'skip'
  )
}

export function getCampaignEncounters(campaignId: string) {
  return convexQuery(convexApi.encounters.projectionReads.list, { campaignId })
}

/** Every saved Blueprint for the System, read as a subscription so a created one appears at once. */
export function useEncounterBlueprints(gameSystemId: string, enabled: boolean) {
  const blueprints = usePaginatedQuery(
    convexApi.encounters.blueprints.list,
    enabled ? { gameSystemId } : 'skip',
    { initialNumItems: 48 }
  )
  useLoadAllPages(blueprints, 48, enabled)
  const isPending = enabled && blueprints.status !== 'Exhausted'
  return { data: enabled && !isPending ? blueprints.results : undefined, isPending }
}
