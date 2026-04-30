import { queryOptions, useSuspenseQuery } from '@tanstack/react-query'
import { api, type Api } from '#app/lib/api'
import { queryKeys } from '#app/lib/queryKeys'

export function getEquipmentList(client: Api = api) {
  return queryOptions({
    queryKey: queryKeys.content.equipment.list(),
    queryFn: async () => await client.content.equipment.list()
  })
}

export function useGetEquipmentList() {
  return useSuspenseQuery(getEquipmentList())
}

export function getEquipment(id: string, client: Api = api) {
  return queryOptions({
    queryKey: queryKeys.content.equipment.detail(id),
    queryFn: async () => await client.content.equipment.get(id)
  })
}

export function useGetEquipment(id: string) {
  return useSuspenseQuery(getEquipment(id))
}

export function getEquipmentDraft(id: string, client: Api = api) {
  return queryOptions({
    queryKey: queryKeys.content.equipment.draft(id),
    queryFn: async () => await client.content.equipment.getDraft(id)
  })
}
