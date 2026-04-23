import { queryOptions, useSuspenseQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'

const racesKeys = {
  all: [
    'races'
  ] as const,
  lists: () => [
    ...racesKeys.all, 'list'
  ] as const,
  single: (id: string) => [
    ...racesKeys.all, 'single', id
  ] as const
}

export function getRaceList() {
  return queryOptions({
    queryKey: racesKeys.lists(),
    queryFn: async () => await api.content.races.list()
  })
}

export function useGetRaceList() {
  return useSuspenseQuery(getRaceList())
}

export function getRace(id: string) {
  return queryOptions({
    queryKey: racesKeys.single(id),
    queryFn: async () => await api.content.races.get(id)
  })
}

export function useGetRace(id: string) {
  return useSuspenseQuery(getRace(id))
}
