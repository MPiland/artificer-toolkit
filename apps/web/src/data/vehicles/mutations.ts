import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useConvex } from 'convex/react'
import { createAuthoredOperations } from '#app/data/authoredOperations'
import { queryKeys } from '#app/lib/queryKeys'

export function useDuplicateVehicleMutation() {
  const queryClient = useQueryClient()
  const operations = createAuthoredOperations('VEHICLE', useConvex())

  return useMutation({
    mutationFn: operations.duplicate,
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.content.vehicles.all()
      })
    }
  })
}
