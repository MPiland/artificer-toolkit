import { useMutation, useQueryClient } from '@tanstack/react-query'
import type {
  CharacterBuilderDraftSaveRequestDto,
  CharacterBuilderResolveRequestDto,
  CharacterBuilderCommitRequestDto,
  CharacterBuilderSaveRequestDto,
  CharacterDraftRequestDto
} from '#app/lib/api'
import { api } from '#app/lib/api'
import { queryKeys } from '#app/lib/queryKeys'

export function useCreateCharacterDraftMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: CharacterDraftRequestDto) => api.characters.draft(input),
    onSuccess: async (response) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.characters.all() })
      queryClient.setQueryData(queryKeys.characters.detail(response.character.id), response)
      await queryClient.invalidateQueries({ queryKey: queryKeys.characters.draft(response.character.id) })
    }
  })
}

export function useSaveCharacterDraftMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: CharacterBuilderDraftSaveRequestDto) => api.characters.saveDraft(input.character.id, input),
    onSuccess: async (draft) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.characters.all() })
      queryClient.setQueryData(queryKeys.characters.draft(draft.characterId), draft)
    }
  })
}

export function useDiscardCharacterDraftMutation(characterId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => api.characters.discardDraft(characterId),
    onSuccess: async () => {
      queryClient.setQueryData(queryKeys.characters.draft(characterId), null)
      await queryClient.invalidateQueries({ queryKey: queryKeys.characters.all() })
      await queryClient.refetchQueries({ queryKey: queryKeys.characters.draft(characterId), exact: true })
    }
  })
}

export function useResolveCharacterBuilderMutation() {
  return useMutation({
    mutationFn: (input: CharacterBuilderResolveRequestDto) => api.characters.resolve(input)
  })
}

export function usePreviewCharacterSaveMutation() {
  return useMutation({
    mutationFn: (input: CharacterBuilderSaveRequestDto) => api.characters.previewSave(input)
  })
}

export function useCommitCharacterBuilderMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: CharacterBuilderCommitRequestDto) => api.characters.upsert(input),
    onSuccess: async (response) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.characters.all() })
      queryClient.setQueryData(queryKeys.characters.detail(response.character.id), response)
      await queryClient.invalidateQueries({ queryKey: queryKeys.characters.draft(response.character.id) })
    }
  })
}
