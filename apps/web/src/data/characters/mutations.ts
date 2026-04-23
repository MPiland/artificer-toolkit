import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { CharacterBuilderSaveRequestDto, CharacterBuilderResolveRequestDto } from '@artificer-toolkit/schema'
import { api } from '../../lib/api'

import { characterKeys } from './queries'

export function useResolveCharacterBuilder() {
  return useMutation({
    mutationFn: async (payload: CharacterBuilderResolveRequestDto) =>
      await api.characters.resolve(payload)
  })
}

export function usePreviewCharacterBuilderSave() {
  return useMutation({
    mutationFn: async (payload: CharacterBuilderSaveRequestDto) =>
      await api.characters.previewSave(payload)
  })
}

export function useUpsertCharacterBuilder() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: CharacterBuilderSaveRequestDto) =>
      await api.characters.upsert(payload),
    onSuccess: async (payload) => {
      queryClient.setQueryData(characterKeys.builder(payload.character.id), payload)
      await queryClient.invalidateQueries({ queryKey: characterKeys.list() })
    }
  })
}
