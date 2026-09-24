import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useConvex } from 'convex/react'
import { createAuthoredOperations } from '#app/data/authoredOperations'
import { queryKeys } from '#app/lib/queryKeys'

export function useDuplicateEquipmentMutation() {
  const queryClient = useQueryClient()
  const operations = createAuthoredOperations('EQUIPMENT', useConvex())

  return useMutation({
    mutationFn: operations.duplicate,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.content.equipment.all() })
    }
  })
}
