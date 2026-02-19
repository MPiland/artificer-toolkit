import { useQueryClient, useMutation } from '@tanstack/react-query'
import { useServerFn } from '@tanstack/react-start'
import { deleteRaceFn, upsertRaceFn } from '@server/domains'
import type { RaceInput } from '@types'

const racesKeys = {
  all: ['races'] as const,
  lists: () => [...racesKeys.all, 'list'] as const,
  single: (id: string) => [...racesKeys.all, 'single', id] as const
}

export function useDeleteRace() {
  const queryClient = useQueryClient()
  const deleteFn = useServerFn(deleteRaceFn)

  return useMutation({
    mutationFn: (id: string) => deleteFn({ data: id }),
    onSuccess: async (_, id) => {
      queryClient.removeQueries({ queryKey: racesKeys.single(id) })
      await queryClient.invalidateQueries({ queryKey: racesKeys.lists() })
    }
  })
}

export function useUpsertRace() {
  const queryClient = useQueryClient()
  const upsertFn = useServerFn(upsertRaceFn)

  return useMutation({
    mutationFn: (data: RaceInput) => upsertFn({ data }),
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: racesKeys.lists() })

      queryClient.setQueryData(
        racesKeys.single(data.id),
        data
      )
    }
  })
}
