import {
  useMutation,
  useQueryClient } from '@tanstack/react-query'
import type { VehicleAuthoringInputDto } from '@artificer-toolkit/schema/subjects/vehicle'
import { api } from '#app/lib/api'
import { queryKeys } from '#app/lib/queryKeys'

export function useActivateVehicleMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (vehicle: VehicleAuthoringInputDto) => api.content.vehicles.activate(vehicle),
    onSuccess: async (response) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.content.vehicles.all() })

      if (response?.item.id) {
        queryClient.setQueryData(queryKeys.content.vehicles.detail(response.item.id), response)
        await queryClient.invalidateQueries({ queryKey: queryKeys.content.vehicles.draft(response.item.id) })
      }
    }
  })
}

export function useSaveVehicleDraftMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (vehicle: VehicleAuthoringInputDto) => api.content.vehicles.saveDraft(vehicle),
    onSuccess: async (draft) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.content.vehicles.all() })
      await queryClient.invalidateQueries({ queryKey: queryKeys.content.vehicles.draft(draft.subjectId) })
    }
  })
}

export function useDiscardVehicleDraftMutation(vehicleId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => api.content.vehicles.discardDraft(vehicleId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.content.vehicles.all() })
      await queryClient.invalidateQueries({ queryKey: queryKeys.content.vehicles.draft(vehicleId) })
    }
  })
}

export function useDuplicateVehicleMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (vehicleId: string) => api.content.vehicles.duplicate(vehicleId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.content.vehicles.all() })
    }
  })
}
