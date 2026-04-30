import { queryOptions, useSuspenseQuery } from '@tanstack/react-query'
import { api, type Api } from '#app/lib/api'
import { queryKeys } from '#app/lib/queryKeys'

export function getBackgroundList(client: Api = api) {
  return queryOptions({
    queryKey: queryKeys.content.backgrounds.list(),
    queryFn: async () => await client.content.backgrounds.list()
  })
}

export function useGetBackgroundList() {
  return useSuspenseQuery(getBackgroundList())
}

export function getBackground(id: string, client: Api = api) {
  return queryOptions({
    queryKey: queryKeys.content.backgrounds.detail(id),
    queryFn: async () => await client.content.backgrounds.get(id)
  })
}

export function useGetBackground(id: string) {
  return useSuspenseQuery(getBackground(id))
}

export function getBackgroundDraft(id: string, client: Api = api) {
  return queryOptions({
    queryKey: queryKeys.content.backgrounds.draft(id),
    queryFn: async () => await client.content.backgrounds.getDraft(id)
  })
}
