import { queryOptions, useSuspenseQuery } from '@tanstack/react-query'
import { getSpellFn } from '@server/domains'
import { getSpellListFn } from '@server/domains'

const spellsKeys = {
  all: [
    'spells'
  ] as const,
  lists: () => [
    ...spellsKeys.all, 'list'
  ] as const,
  single: (id: string) => [
    ...spellsKeys.all, 'single', id
  ] as const
}

export function getSpellList() {
  return queryOptions({
    queryKey: spellsKeys.lists(),
    queryFn: async () => await getSpellListFn()
  })
}

export function useGetSpellList() {
  return useSuspenseQuery(getSpellList())
}

export function getSpell(id: string) {
  return queryOptions({
    queryKey: spellsKeys.single(id),
    queryFn: async () => await getSpellFn({
      data: id
    })
  })
}

export function useGetSpell(id: string) {
  return useSuspenseQuery(getSpell(id))
}
