import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { RaceAuthoringInputDto } from '@artificer-toolkit/schema/subjects/race'
import { api } from '#app/lib/api'
import { queryKeys } from '#app/lib/queryKeys'

export function useActivateRaceMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (race: RaceAuthoringInputDto) => api.content.races.activate(race),
    onSuccess: async (response) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.content.races.all() })

      if (response?.item?.id) {
        queryClient.setQueryData(queryKeys.content.races.detail(response.item.id), response)
        await queryClient.invalidateQueries({
          queryKey: queryKeys.content.races.draft(response.item.id)
        })
      }
    }
  })
}

export function useSaveRaceDraftMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (race: RaceAuthoringInputDto) => api.content.races.saveDraft(race),
    onSuccess: async (draft) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.content.races.all() })
      await queryClient.invalidateQueries({
        queryKey: queryKeys.content.races.draft(draft.subjectId)
      })
    }
  })
}

export function useDiscardRaceDraftMutation(raceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => api.content.races.discardDraft(raceId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.content.races.all() })
      await queryClient.invalidateQueries({ queryKey: queryKeys.content.races.draft(raceId) })
    }
  })
}

export function useDuplicateRaceMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (raceId: string) => api.content.races.duplicate(raceId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.content.races.all() })
    }
  })
}
