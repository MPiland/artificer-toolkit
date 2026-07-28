import { useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query'
import type {
  CharacterBuilderDraftSaveRequestDto,
  CharacterBuilderResolveRequestDto,
  CharacterBuilderCommitRequestDto,
  CharacterBuilderSaveRequestDto,
  CharacterDraftRequestDto,
  CharacterSheetCommandInputDto,
  CharacterSheetPanelDto,
  CharacterSheetResponseDto,
  CharacterRestPreviewRequestDto
} from '#app/lib/api'
import { api } from '#app/lib/api'
import { queryKeys } from '#app/lib/queryKeys'
import {
  projectOptimisticCharacterSheet,
  projectOptimisticCharacterSheetPanel
} from './optimisticSheet'

export function useCreateCharacterDraftMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: CharacterDraftRequestDto) => api.characters.draft(input),
    onSuccess: async (response) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.characters.all() })
      queryClient.setQueryData(queryKeys.characters.detail(response.character.id), response)
      await queryClient.invalidateQueries({
        queryKey: queryKeys.characters.draft(response.character.id)
      })
      await queryClient.invalidateQueries({
        queryKey: queryKeys.characters.sheet(response.character.id)
      })
    }
  })
}

export function useSaveCharacterDraftMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: CharacterBuilderDraftSaveRequestDto) =>
      api.characters.saveDraft(input.character.id, input),
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
      await queryClient.refetchQueries({
        queryKey: queryKeys.characters.draft(characterId),
        exact: true
      })
    }
  })
}

export function useResolveCharacterBuilderMutation() {
  return useMutation({
    mutationFn: ({
      request,
      signal
    }: {
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
      await queryClient.invalidateQueries({
        queryKey: queryKeys.characters.draft(response.character.id)
      })
      await queryClient.invalidateQueries({
        queryKey: queryKeys.characters.sheet(response.character.id)
      })
    }
  })
}

export function useCharacterSheetCommandMutation(characterId: string) {
  const queryClient = useQueryClient()
  const sheetKey = queryKeys.characters.sheet(characterId)
  const panelsKey = queryKeys.characters.panels(characterId)

  return useMutation({
    mutationKey: ['characters', 'sheet', 'command', characterId],
    mutationFn: (input: CharacterSheetCommandInputDto) =>
      api.characters.command(characterId, input),
    onMutate: async (input) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: sheetKey, exact: true }),
        queryClient.cancelQueries({ queryKey: panelsKey })
      ])
      const previousSheet = queryClient.getQueryData<CharacterSheetResponseDto>(sheetKey)
      const previousPanels = queryClient.getQueriesData<CharacterSheetPanelDto>({
        queryKey: panelsKey
      })

      if (previousSheet) {
        queryClient.setQueryData(sheetKey, projectOptimisticCharacterSheet(previousSheet, input))
      }
      queryClient.setQueriesData<CharacterSheetPanelDto>({ queryKey: panelsKey }, (panel) =>
        panel ? projectOptimisticCharacterSheetPanel(panel, input) : panel
      )

      return { previousPanels, previousSheet }
    },
    onSuccess: async (response) => {
      queryClient.setQueryData(sheetKey, response.sheet)
      await queryClient.invalidateQueries({
        queryKey: panelsKey,
        refetchType: 'none'
      })
      for (const panel of response.panels ?? []) {
        queryClient.setQueryData(queryKeys.characters.panel(characterId, panel.target), panel)
      }
      await queryClient.invalidateQueries({
        queryKey: queryKeys.characters.detail(characterId),
        exact: true
      })
      await queryClient.invalidateQueries({ queryKey: queryKeys.characters.list() })
    },
    onError: async (_error, _input, context) => {
      if (context?.previousSheet) {
        queryClient.setQueryData(sheetKey, context.previousSheet)
      }
      for (const [queryKey, panel] of context?.previousPanels ?? []) {
        queryClient.setQueryData(queryKey as QueryKey, panel)
      }
      await Promise.all([
        queryClient.refetchQueries({
          queryKey: sheetKey,
          exact: true
        }),
        queryClient.refetchQueries({ queryKey: panelsKey })
      ])
    }
  })
}

export function useCharacterRestPreviewMutation(characterId: string) {
  return useMutation({
    mutationKey: ['characters', 'sheet', 'rest-preview', characterId],
    mutationFn: (input: CharacterRestPreviewRequestDto) =>
      api.characters.restPreview(characterId, input)
  })
}
