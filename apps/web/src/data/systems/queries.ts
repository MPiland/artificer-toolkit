import { queryOptions, useSuspenseQuery } from '@tanstack/react-query'
import { api, type Api } from '#app/lib/api'
import { queryKeys } from '#app/lib/queryKeys'

export function getSystemList(client: Api = api) {
  return queryOptions({
    queryKey: queryKeys.systems.list(),
    queryFn: async () => await client.systems.list()
  })
}

export function useGetSystemList() {
  return useSuspenseQuery(getSystemList())
}

export function getSystem(id: string, client: Api = api) {
  return queryOptions({
    queryKey: queryKeys.systems.detail(id),
    queryFn: async () => await client.systems.get(id)
  })
}

export function useGetSystem(id: string) {
  return useSuspenseQuery(getSystem(id))
}
