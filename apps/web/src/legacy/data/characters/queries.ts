import { queryOptions, useQuery, useSuspenseQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'

export const characterKeys = {
  all: ['characters'] as const,
  list: () => [...characterKeys.all, 'list'] as const,
  builder: (id: string) => [...characterKeys.all, 'builder', id] as const,
  sheet: (id: string) => [...characterKeys.all, 'sheet', id] as const,
  draft: (id: string, systemId?: string) => [...characterKeys.all, 'draft', id, systemId ?? 'none'] as const
}

export function getCharacterList() {
  return queryOptions({
    queryKey: characterKeys.list(),
    queryFn: async () => await api.characters.list()
  })
}

export function useGetCharacterList() {
  return useSuspenseQuery(getCharacterList())
}

export function getCharacterBuilder(id: string) {
  return queryOptions({
    queryKey: characterKeys.builder(id),
    queryFn: async () => await api.characters.get(id)
  })
}

export function useGetCharacterBuilder(id: string, enabled = Boolean(id)) {
  return useQuery({
    ...getCharacterBuilder(id),
    enabled
  })
}

export function getCharacterSheet(id: string) {
  return queryOptions({
    queryKey: characterKeys.sheet(id),
    queryFn: async () => await api.characters.sheet(id)
  })
}

export function useGetCharacterSheet(id: string, enabled = Boolean(id)) {
  return useQuery({
    ...getCharacterSheet(id),
    enabled
  })
}

export function getCharacterDraft(id: string, systemId?: string) {
  return queryOptions({
    queryKey: characterKeys.draft(id, systemId),
    queryFn: async () => await api.characters.draft({ id, systemId })
  })
}

export function useGetCharacterDraft(id: string, systemId?: string, enabled = Boolean(id && systemId)) {
  return useQuery({
    ...getCharacterDraft(id, systemId),
    enabled
  })
}
