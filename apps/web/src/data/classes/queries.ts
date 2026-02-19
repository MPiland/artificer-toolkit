import { queryOptions, useSuspenseQuery } from '@tanstack/react-query'
import { getClassFn } from '@server/domains'
import { getClassListFn } from '@server/domains'

const classsKeys = {
  all: ['classs'] as const,
  lists: () => [...classsKeys.all, 'list'] as const,
  single: (id: string) => [...classsKeys.all, 'single', id] as const
}

export function getClassList() {
  return queryOptions({
    queryKey: classsKeys.lists(),
    queryFn: async () => await getClassListFn()
  })
}

export function useGetClassList() {
  return useSuspenseQuery(getClassList())
}

export function getClass(id: string) {
  return queryOptions({
    queryKey: classsKeys.single(id),
    queryFn: async () => await getClassFn({
      data: id
    })
  })
}

export function useGetClass(id: string) {
  return useSuspenseQuery(getClass(id))
}
