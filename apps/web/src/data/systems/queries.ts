import { queryOptions, useSuspenseQuery } from '@tanstack/react-query'
import { getSystemFn } from '@server/domains'
import { getSystemListFn } from '@server/domains'

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
    queryFn: async () => await getSystemListFn()
  })
}

export function useGetSystemList() {
  return useSuspenseQuery(getSystemList())
}

export function getSystem(id: string) {
  return queryOptions({
    queryKey: systemsKeys.single(id),
    queryFn: async () => await getSystemFn({
      data: id
    })
  })
}

export function useGetSystem(id: string) {
  return useSuspenseQuery(getSystem(id))
}
