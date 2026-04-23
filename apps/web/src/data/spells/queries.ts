import { queryOptions, useSuspenseQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'

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
    queryFn: async () => await api.content.spells.list()
  })
}

export function useGetSpellList() {
  return useSuspenseQuery(getSpellList())
}

export function getSpell(id: string) {
  return queryOptions({
    queryKey: spellsKeys.single(id),
    queryFn: async () => await api.content.spells.get(id)
  })
}

export function useGetSpell(id: string) {
  return useSuspenseQuery(getSpell(id))
}
