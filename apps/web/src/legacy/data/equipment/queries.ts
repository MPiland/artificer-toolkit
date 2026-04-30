import { queryOptions, useSuspenseQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'

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
    queryFn: async () => await api.content.equipment.list()
  })
}

export function useGetEquipmentList() {
  return useSuspenseQuery(getEquipmentList())
}

export function getEquipment(id: string) {
  return queryOptions({
    queryKey: equipmentsKeys.single(id),
    queryFn: async () => await api.content.equipment.get(id)
  })
}

export function useGetEquipment(id: string) {
  return useSuspenseQuery(getEquipment(id))
}
