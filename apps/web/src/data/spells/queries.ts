import { queryOptions, useSuspenseQuery } from '@tanstack/react-query'
import { api, type Api } from '../../lib/api'
import { queryKeys } from '../../lib/queryKeys'

export function getSpellList(client: Api = api) {
  return queryOptions({
    queryKey: queryKeys.content.spells.list(),
    queryFn: async () => await client.content.spells.list()
  })
}

export function useGetSpellList() {
  return useSuspenseQuery(getSpellList())
}

export function getSpell(id: string, client: Api = api) {
  return queryOptions({
    queryKey: queryKeys.content.spells.detail(id),
    queryFn: async () => await client.content.spells.get(id)
  })
}

export function useGetSpell(id: string) {
  return useSuspenseQuery(getSpell(id))
}

export function getSpellDraft(id: string, client: Api = api) {
  return queryOptions({
    queryKey: queryKeys.content.spells.draft(id),
    queryFn: async () => await client.content.spells.getDraft(id)
  })
}
