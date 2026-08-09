import { queryOptions } from '@tanstack/react-query'
import { api, type Api } from '#app/lib/api'
import { queryKeys } from '#app/lib/queryKeys'

export function getEncounter(encounterId: string, client: Api = api) {
  return queryOptions({
    queryKey: queryKeys.encounters.detail(encounterId),
    queryFn: () => client.encounters.get(encounterId),
    refetchInterval: 5_000
  })
}

export function getActiveEncounter(campaignId: string, client: Api = api) {
  return queryOptions({
    queryKey: queryKeys.encounters.active(campaignId),
    queryFn: () => client.encounters.active(campaignId),
    refetchInterval: 5_000
  })
}

export function getCampaignEncounters(campaignId: string, client: Api = api) {
  return queryOptions({
    queryKey: queryKeys.encounters.list(campaignId),
    queryFn: () => client.encounters.list(campaignId),
    refetchInterval: 5_000
  })
}

export function getEncounterTemplates(campaignId: string, client: Api = api) {
  return queryOptions({
    queryKey: queryKeys.encounters.templates(campaignId),
    queryFn: () => client.encounters.templates.list(campaignId),
    refetchInterval: 30_000
  })
}

export function getEncounterTimeline(encounterId: string, client: Api = api) {
  return queryOptions({
    queryKey: queryKeys.encounters.timeline(encounterId),
    queryFn: () => client.encounters.timeline({ encounterId, limit: 50 }),
    refetchInterval: 5_000
  })
}
