import { queryOptions, useSuspenseQuery } from '@tanstack/react-query'
import { getBackgroundFn } from '@server/domains'
import { getBackgroundListFn } from '@server/domains'

const backgroundsKeys = {
  all: ['backgrounds'] as const,
  lists: () => [...backgroundsKeys.all, 'list'] as const,
  single: (id: string) => [...backgroundsKeys.all, 'single', id] as const
}

export function getBackgroundList() {
  return queryOptions({
    queryKey: backgroundsKeys.lists(),
    queryFn: async () => await getBackgroundListFn()
  })
}

export function useGetBackgroundList() {
  return useSuspenseQuery(getBackgroundList())
}

export function getBackground(id: string) {
  return queryOptions({
    queryKey: backgroundsKeys.single(id),
    queryFn: async () => await getBackgroundFn({
      data: id
    })
  })
}

export function useGetBackground(id: string) {
  return useSuspenseQuery(getBackground(id))
}
