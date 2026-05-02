import { queryOptions, useSuspenseQuery } from '@tanstack/react-query'
import { api, type Api } from '#app/lib/api'
import { queryKeys } from '#app/lib/queryKeys'

export function getCreatureList(client: Api = api) {
  return queryOptions({
    queryKey: queryKeys.content.creatures.list(),
    queryFn: async () => await client.content.creatures.list()
  })
}

export function useGetCreatureList() {
  return useSuspenseQuery(getCreatureList())
}

export function getCreature(id: string, client: Api = api) {
  return queryOptions({
    queryKey: queryKeys.content.creatures.detail(id),
    queryFn: async () => await client.content.creatures.get(id)
  })
}

export function useGetCreature(id: string) {
  return useSuspenseQuery(getCreature(id))
}

export function getCreatureDraft(id: string, client: Api = api) {
  return queryOptions({
    queryKey: queryKeys.content.creatures.draft(id),
    queryFn: async () => await client.content.creatures.getDraft(id)
  })
}
