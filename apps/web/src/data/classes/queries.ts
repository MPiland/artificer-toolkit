import { queryOptions, useSuspenseQuery } from '@tanstack/react-query'
import { api, type Api } from '#app/lib/api'
import { queryKeys } from '#app/lib/queryKeys'

export function getClassList(client: Api = api) {
  return queryOptions({
    queryKey: queryKeys.content.classes.list(),
    queryFn: async () => await client.content.classes.list()
  })
}

export function useGetClassList() {
  return useSuspenseQuery(getClassList())
}

export function getClass(id: string, client: Api = api) {
  return queryOptions({
    queryKey: queryKeys.content.classes.detail(id),
    queryFn: async () => await client.content.classes.get(id)
  })
}

export function useGetClass(id: string) {
  return useSuspenseQuery(getClass(id))
}

export function getClassDraft(id: string, client: Api = api) {
  return queryOptions({
    queryKey: queryKeys.content.classes.draft(id),
    queryFn: async () => await client.content.classes.getDraft(id)
  })
}
