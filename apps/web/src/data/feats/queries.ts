import { queryOptions, useSuspenseQuery } from '@tanstack/react-query'
import { api, type Api } from '#app/lib/api'
import { queryKeys } from '#app/lib/queryKeys'

export function getFeatList(client: Api = api) {
  return queryOptions({
    queryKey: queryKeys.content.feats.list(),
    queryFn: async () => await client.content.feats.list()
  })
}

export function useGetFeatList() {
  return useSuspenseQuery(getFeatList())
}

export function getFeat(id: string, client: Api = api) {
  return queryOptions({
    queryKey: queryKeys.content.feats.detail(id),
    queryFn: async () => await client.content.feats.get(id)
  })
}

export function useGetFeat(id: string) {
  return useSuspenseQuery(getFeat(id))
}
