import { queryOptions, useSuspenseQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'

const featsKeys = {
  all: [
    'feats'
  ] as const,
  lists: () => [
    ...featsKeys.all, 'list'
  ] as const,
  single: (id: string) => [
    ...featsKeys.all, 'single', id
  ] as const
}

export function getFeatList() {
  return queryOptions({
    queryKey: featsKeys.lists(),
    queryFn: async () => await api.content.feats.list()
  })
}

export function useGetFeatList() {
  return useSuspenseQuery(getFeatList())
}

export function getFeat(id: string) {
  return queryOptions({
    queryKey: featsKeys.single(id),
    queryFn: async () => await api.content.feats.get(id)
  })
}

export function useGetFeat(id: string) {
  return useSuspenseQuery(getFeat(id))
}
