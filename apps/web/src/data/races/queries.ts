import { queryOptions, useSuspenseQuery } from '@tanstack/react-query'
import { getRaceFn } from '@server/domains'
import { getRaceListFn } from '@server/domains'

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
    queryFn: async () => await getRaceListFn()
  })
}

export function useGetRaceList() {
  return useSuspenseQuery(getRaceList())
}

export function getRace(id: string) {
  return queryOptions({
    queryKey: racesKeys.single(id),
    queryFn: async () => await getRaceFn({
      data: id
    })
  })
}

export function useGetRace(id: string) {
  return useSuspenseQuery(getRace(id))
}
