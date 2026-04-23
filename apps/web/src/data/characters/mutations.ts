import { useMutation, useQueryClient } from '@tanstack/react-query'
import { previewCharacterBuilderSaveFn, resolveCharacterBuilderFn, upsertCharacterBuilderFn } from '@server/domains'
import type { AuthoredRecordStatus, CharacterAuthored } from '@artificer-toolkit/shared'

import { characterKeys } from './queries'

export function useResolveCharacterBuilder() {
  return useMutation({
    mutationFn: async (payload: { character: CharacterAuthored, mode: 'create' | 'edit' }) =>
      await resolveCharacterBuilderFn({ data: payload })
  })
}

export function usePreviewCharacterBuilderSave() {
  return useMutation({
    mutationFn: async (payload: {
      character: CharacterAuthored
      mode: 'create' | 'edit'
      targetStatus?: AuthoredRecordStatus
    }) => await previewCharacterBuilderSaveFn({ data: payload })
  })
}

export function useUpsertCharacterBuilder() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: {
      character: CharacterAuthored
      mode: 'create' | 'edit'
      targetStatus?: AuthoredRecordStatus
    }) =>
      await upsertCharacterBuilderFn({ data: payload }),
    onSuccess: async (payload) => {
      queryClient.setQueryData(characterKeys.builder(payload.character.id), payload)
      await queryClient.invalidateQueries({ queryKey: characterKeys.list() })
    }
  })
}
