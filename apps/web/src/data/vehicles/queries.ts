import { queryOptions, useSuspenseQuery } from '@tanstack/react-query'
import { api, type Api } from '#app/lib/api'
import { queryKeys } from '#app/lib/queryKeys'

export function getVehicleList(client: Api = api) {
  return queryOptions({
    queryKey: queryKeys.content.vehicles.list(),
    queryFn: async () => await client.content.vehicles.list()
  })
}

export function useGetVehicleList() {
  return useSuspenseQuery(getVehicleList())
}

export function getVehicle(id: string, client: Api = api) {
  return queryOptions({
    queryKey: queryKeys.content.vehicles.detail(id),
    queryFn: async () => await client.content.vehicles.get(id)
  })
}

export function useGetVehicle(id: string) {
  return useSuspenseQuery(getVehicle(id))
}

export function getVehicleDraft(id: string, client: Api = api) {
  return queryOptions({
    queryKey: queryKeys.content.vehicles.draft(id),
    queryFn: async () => await client.content.vehicles.getDraft(id)
  })
}
