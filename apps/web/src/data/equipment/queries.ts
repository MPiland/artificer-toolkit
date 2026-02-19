import { queryOptions, useSuspenseQuery } from '@tanstack/react-query'
import { getEquipmentFn } from '@server/domains'
import { getEquipmentListFn } from '@server/domains'

const equipmentsKeys = {
  all: [
    'equipments'
  ] as const,
  lists: () => [
    ...equipmentsKeys.all, 'list'
  ] as const,
  single: (id: string) => [
    ...equipmentsKeys.all, 'single', id
  ] as const
}

export function getEquipmentList() {
  return queryOptions({
    queryKey: equipmentsKeys.lists(),
    queryFn: async () => await getEquipmentListFn()
  })
}

export function useGetEquipmentList() {
  return useSuspenseQuery(getEquipmentList())
}

export function getEquipment(id: string) {
  return queryOptions({
    queryKey: equipmentsKeys.single(id),
    queryFn: async () => await getEquipmentFn({
      data: id
    })
  })
}

export function useGetEquipment(id: string) {
  return useSuspenseQuery(getEquipment(id))
}
