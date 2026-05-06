import {
  useMutation,
  useQueryClient
} from '@tanstack/react-query'
import type { FeatAuthoringInputDto } from '@artificer-toolkit/schema/subjects/feat'
import { api } from '#app/lib/api'
import { queryKeys } from '#app/lib/queryKeys'

export function useActivateFeatMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (feat: FeatAuthoringInputDto) => api.content.feats.activate(feat),
    onSuccess: async (response) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.content.feats.all() })

      if (response?.item.id) {
        queryClient.setQueryData(queryKeys.content.feats.detail(response.item.id), response)
        await queryClient.invalidateQueries({ queryKey: queryKeys.content.feats.draft(response.item.id) })
      }
    }
  })
}

export function useSaveFeatDraftMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (feat: FeatAuthoringInputDto) => api.content.feats.saveDraft(feat),
    onSuccess: async (draft) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.content.feats.all() })
      await queryClient.invalidateQueries({ queryKey: queryKeys.content.feats.draft(draft.subjectId) })
    }
  })
}

export function useDiscardFeatDraftMutation(featId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => api.content.feats.discardDraft(featId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.content.feats.all() })
      await queryClient.invalidateQueries({ queryKey: queryKeys.content.feats.draft(featId) })
    }
  })
}

export function useDuplicateFeatMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (featId: string) => api.content.feats.duplicate(featId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.content.feats.all() })
    }
  })
}
