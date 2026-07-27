import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { BackgroundAuthoringInputDto } from '@artificer-toolkit/schema/subjects/background'
import { api } from '#app/lib/api'
import { queryKeys } from '#app/lib/queryKeys'

export function useActivateBackgroundMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (background: BackgroundAuthoringInputDto) =>
      api.content.backgrounds.activate(background),
    onSuccess: async (response) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.content.backgrounds.all() })

      if (response?.item?.id) {
        queryClient.setQueryData(queryKeys.content.backgrounds.detail(response.item.id), response)
        await queryClient.invalidateQueries({
          queryKey: queryKeys.content.backgrounds.draft(response.item.id)
        })
      }
    }
  })
}

export function useSaveBackgroundDraftMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (background: BackgroundAuthoringInputDto) =>
      api.content.backgrounds.saveDraft(background),
    onSuccess: async (draft) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.content.backgrounds.all() })
      await queryClient.invalidateQueries({
        queryKey: queryKeys.content.backgrounds.draft(draft.subjectId)
      })
    }
  })
}

export function useDiscardBackgroundDraftMutation(backgroundId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => api.content.backgrounds.discardDraft(backgroundId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.content.backgrounds.all() })
      await queryClient.invalidateQueries({
        queryKey: queryKeys.content.backgrounds.draft(backgroundId)
      })
    }
  })
}

export function useDuplicateBackgroundMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (backgroundId: string) => api.content.backgrounds.duplicate(backgroundId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.content.backgrounds.all() })
    }
  })
}
