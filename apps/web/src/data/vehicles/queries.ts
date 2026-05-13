import type { Api, AuthoredDetailRequestDto } from '#app/lib/api'
import { queryKeys } from '#app/lib/queryKeys'
import { createAuthoredContentQueries } from '#app/data/authoredContentQueries'

type DetailInput = string | AuthoredDetailRequestDto

const vehicleQueries = createAuthoredContentQueries(
  (client) => client.content.vehicles,
  queryKeys.content.vehicles
)

export function getVehicleList(client?: Api) {
  return vehicleQueries.getList(client)
}

export function useGetVehicleList() {
  return vehicleQueries.useList()
}

export function getVehicle(input: DetailInput, client?: Api) {
  return vehicleQueries.getDetail(input, client)
}

export function useGetVehicle(input: DetailInput) {
  return vehicleQueries.useDetail(input)
}

export function getVehicleDraft(id: string, client?: Api) {
  return vehicleQueries.getDraft(id, client)
}
