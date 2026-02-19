import { useQueryClient, useMutation } from '@tanstack/react-query'
import { useServerFn } from '@tanstack/react-start'
import { deleteEquipmentFn, upsertEquipmentFn } from '@server/domains'
import type { EquipmentInput } from '@types'

const equipmentsKeys = {
  all: ['equipments'] as const,
  lists: () => [...equipmentsKeys.all, 'list'] as const,
  single: (id: string) => [...equipmentsKeys.all, 'single', id] as const
}

export function useDeleteEquipment() {
  const queryClient = useQueryClient()
  const deleteFn = useServerFn(deleteEquipmentFn)

  return useMutation({
    mutationFn: (id: string) => deleteFn({ data: id }),
    onSuccess: async (_, id) => {
      queryClient.removeQueries({ queryKey: equipmentsKeys.single(id) })
      await queryClient.invalidateQueries({ queryKey: equipmentsKeys.lists() })
    }
  })
}

export function useUpsertEquipment() {
  const queryClient = useQueryClient()
  const upsertFn = useServerFn(upsertEquipmentFn)

  return useMutation({
    mutationFn: (data: EquipmentInput) => upsertFn({ data }),
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: equipmentsKeys.lists() })

      queryClient.setQueryData(
        equipmentsKeys.single(data.id),
        data
      )
    }
  })
}
