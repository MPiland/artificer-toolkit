import {
  useMutation,
  useQueryClient } from '@tanstack/react-query'
import type { ClassAuthoringInputDto } from '@artificer-toolkit/schema/subjects/class'
import { api } from '#app/lib/api'
import { queryKeys } from '#app/lib/queryKeys'

export function useActivateClassMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (classRecord: ClassAuthoringInputDto) => api.content.classes.activate(classRecord),
    onSuccess: async (response) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.content.classes.all() })

      if (response?.item?.id) {
        queryClient.setQueryData(queryKeys.content.classes.detail(response.item.id), response)
        await queryClient.invalidateQueries({ queryKey: queryKeys.content.classes.draft(response.item.id) })
      }
    }
  })
}

export function useSaveClassDraftMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (classRecord: ClassAuthoringInputDto) => api.content.classes.saveDraft(classRecord),
    onSuccess: async (draft) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.content.classes.all() })
      await queryClient.invalidateQueries({ queryKey: queryKeys.content.classes.draft(draft.subjectId) })
    }
  })
}

export function useDiscardClassDraftMutation(classId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => api.content.classes.discardDraft(classId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.content.classes.all() })
      await queryClient.invalidateQueries({ queryKey: queryKeys.content.classes.draft(classId) })
    }
  })
}

export function useDuplicateClassMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (classId: string) => api.content.classes.duplicate(classId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.content.classes.all() })
    }
  })
}
