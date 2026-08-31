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

export function getSystemRuleCapability(id: string, client: Api = api) {
  return queryOptions({
    queryKey: [...queryKeys.systems.detail(id), 'rule-capability'],
    queryFn: async () => await client.systems.capability(id)
  })
}

export function getSystemDefinitions(id: string, client: Api = api) {
  return queryOptions({
    queryKey: queryKeys.systems.definitions(id),
    queryFn: async () => await client.systems.definitions.list(id)
  })
}

export function getSystemDefinition(definitionId: string, client: Api = api) {
  return queryOptions({
    queryKey: queryKeys.systems.definition(definitionId),
    queryFn: async () => await client.systems.definitions.get(definitionId)
  })
}
