import { queryOptions, useSuspenseQuery } from '@tanstack/react-query'
import { api, type Api } from '#app/lib/api'
import { queryKeys } from '#app/lib/queryKeys'

export function getCharacterList(client: Api = api) {
  return queryOptions({
    queryKey: queryKeys.characters.list(),
    queryFn: async () => await client.characters.list()
  })
}

export function useGetCharacterList() {
  return useSuspenseQuery(getCharacterList())
}

export function getCharacter(id: string, client: Api = api) {
  return queryOptions({
    queryKey: queryKeys.characters.detail(id),
    queryFn: async () => await client.characters.get(id)
  })
}

export function getCharacterDraft(id: string, client: Api = api) {
  return queryOptions({
    queryKey: queryKeys.characters.draft(id),
    queryFn: async () => await client.characters.getDraft(id)
  })
}

export function getCharacterSheet(id: string, client: Api = api) {
  return queryOptions({
    queryKey: queryKeys.characters.sheet(id),
    queryFn: async () => await client.characters.sheet(id)
  })
}

export function getCharacterHistory(id: string, client: Api = api) {
  return queryOptions({
    queryKey: queryKeys.characters.history(id),
    queryFn: async () => await client.characters.history(id)
  })
}
