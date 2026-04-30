import { queryOptions, useSuspenseQuery } from '@tanstack/react-query'
import { api, type Api } from '#app/lib/api'
import { queryKeys } from '#app/lib/queryKeys'

export function getRaceList(client: Api = api) {
  return queryOptions({
    queryKey: queryKeys.content.races.list(),
    queryFn: async () => await client.content.races.list()
  })
}

export function useGetRaceList() {
  return useSuspenseQuery(getRaceList())
}

export function getRace(id: string, client: Api = api) {
  return queryOptions({
    queryKey: queryKeys.content.races.detail(id),
    queryFn: async () => await client.content.races.get(id)
  })
}

export function useGetRace(id: string) {
  return useSuspenseQuery(getRace(id))
}

export function getRaceDraft(id: string, client: Api = api) {
  return queryOptions({
    queryKey: queryKeys.content.races.draft(id),
    queryFn: async () => await client.content.races.getDraft(id)
  })
}
