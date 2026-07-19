import { useMutation, useQueryClient } from '@tanstack/react-query'
import type {
  CharacterBuilderDraftSaveRequestDto,
  CharacterBuilderResolveRequestDto,
  CharacterBuilderCommitRequestDto,
  CharacterBuilderSaveRequestDto,
  CharacterDraftRequestDto,
  CharacterSheetCommandInputDto
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
      await queryClient.invalidateQueries({ queryKey: queryKeys.characters.sheet(response.character.id) })
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
    mutationFn: ({ request, signal }: {
      request: CharacterBuilderResolveRequestDto
      signal?: AbortSignal
    }) => api.characters.resolve(request, { signal })
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
      await queryClient.invalidateQueries({ queryKey: queryKeys.characters.sheet(response.character.id) })
    }
  })
}

export function useCharacterSheetCommandMutation(characterId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: CharacterSheetCommandInputDto) => api.characters.command(characterId, input),
    onSuccess: async (response) => {
      queryClient.setQueryData(queryKeys.characters.sheet(characterId), response.sheet)
      await queryClient.invalidateQueries({ queryKey: queryKeys.characters.detail(characterId), exact: true })
      await queryClient.invalidateQueries({ queryKey: queryKeys.characters.list() })
    },
    onError: async () => {
      await queryClient.refetchQueries({ queryKey: queryKeys.characters.sheet(characterId), exact: true })
    }
  })
}
