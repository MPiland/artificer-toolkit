import type { Api, AuthoredDetailRequestDto } from '#app/lib/api'
import { queryKeys } from '#app/lib/queryKeys'
import { createAuthoredContentQueries } from '#app/data/authoredContentQueries'

type DetailInput = string | AuthoredDetailRequestDto

const equipmentQueries = createAuthoredContentQueries(
  (client) => client.content.equipment,
  queryKeys.content.equipment
)

export function getEquipmentList(client?: Api) {
  return equipmentQueries.getList(client)
}

export function useGetEquipmentList() {
  return equipmentQueries.useList()
}

export function getEquipment(input: DetailInput, client?: Api) {
  return equipmentQueries.getDetail(input, client)
}

export function useGetEquipment(input: DetailInput) {
  return equipmentQueries.useDetail(input)
}

export function getEquipmentDraft(id: string, client?: Api) {
  return equipmentQueries.getDraft(id, client)
}
