import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { CreatureAuthoringInputDto } from '@artificer-toolkit/schema/subjects/creature'
import { api } from '#app/lib/api'
import { queryKeys } from '#app/lib/queryKeys'

export function useActivateCreatureMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (creature: CreatureAuthoringInputDto) => api.content.creatures.activate(creature),
    onSuccess: async (response) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.content.creatures.all() })

      if (response?.item?.id) {
        queryClient.setQueryData(queryKeys.content.creatures.detail(response.item.id), response)
        await queryClient.invalidateQueries({
          queryKey: queryKeys.content.creatures.draft(response.item.id)
        })
      }
    }
  })
}

export function useSaveCreatureDraftMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (creature: CreatureAuthoringInputDto) => api.content.creatures.saveDraft(creature),
    onSuccess: async (draft) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.content.creatures.all() })
      await queryClient.invalidateQueries({
        queryKey: queryKeys.content.creatures.draft(draft.subjectId)
      })
    }
  })
}

export function useDiscardCreatureDraftMutation(creatureId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => api.content.creatures.discardDraft(creatureId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.content.creatures.all() })
      await queryClient.invalidateQueries({
        queryKey: queryKeys.content.creatures.draft(creatureId)
      })
    }
  })
}

export function useDuplicateCreatureMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (creatureId: string) => api.content.creatures.duplicate(creatureId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.content.creatures.all() })
    }
  })
}
