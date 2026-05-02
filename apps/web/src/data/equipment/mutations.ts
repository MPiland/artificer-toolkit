import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { EquipmentAuthoringInputDto } from '@artificer-toolkit/schema'
import { api } from '#app/lib/api'
import { queryKeys } from '#app/lib/queryKeys'

export function useActivateEquipmentMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (equipment: EquipmentAuthoringInputDto) => api.content.equipment.activate(equipment),
    onSuccess: async (response) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.content.equipment.all() })

      if (response?.item.id) {
        queryClient.setQueryData(queryKeys.content.equipment.detail(response.item.id), response)
        await queryClient.invalidateQueries({ queryKey: queryKeys.content.equipment.draft(response.item.id) })
      }
    }
  })
}

export function useSaveEquipmentDraftMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (equipment: EquipmentAuthoringInputDto) => api.content.equipment.saveDraft(equipment),
    onSuccess: async (draft) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.content.equipment.all() })
      await queryClient.invalidateQueries({ queryKey: queryKeys.content.equipment.draft(draft.subjectId) })
    }
  })
}

export function useDiscardEquipmentDraftMutation(equipmentId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => api.content.equipment.discardDraft(equipmentId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.content.equipment.all() })
      await queryClient.invalidateQueries({ queryKey: queryKeys.content.equipment.draft(equipmentId) })
    }
  })
}

export function useDuplicateEquipmentMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (equipmentId: string) => api.content.equipment.duplicate(equipmentId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.content.equipment.all() })
    }
  })
}
