import { queryOptions, useSuspenseQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'

const systemsKeys = {
  all: [
    'systems'
  ] as const,
  lists: () => [
    ...systemsKeys.all, 'list'
  ] as const,
  single: (id: string) => [
    ...systemsKeys.all, 'single', id
  ] as const
}

export function getSystemList() {
  return queryOptions({
    queryKey: systemsKeys.lists(),
    queryFn: async () => await api.systems.list()
  })
}

export function useGetSystemList() {
  return useSuspenseQuery(getSystemList())
}

export function getSystem(id: string) {
  return queryOptions({
    queryKey: systemsKeys.single(id),
    queryFn: async () => await api.systems.get(id)
  })
}

export function useGetSystem(id: string) {
  return useSuspenseQuery(getSystem(id))
}
