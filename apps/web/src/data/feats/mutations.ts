import { useQueryClient, useMutation } from '@tanstack/react-query'
import { useServerFn } from '@tanstack/react-start'
import { deleteFeatFn, upsertFeatFn } from '@server/domains'
import type { FeatInput } from '@types'

const featsKeys = {
  all: ['feats'] as const,
  lists: () => [...featsKeys.all, 'list'] as const,
  single: (id: string) => [...featsKeys.all, 'single', id] as const
}

export function useDeleteFeat() {
  const queryClient = useQueryClient()
  const deleteFn = useServerFn(deleteFeatFn)

  return useMutation({
    mutationFn: (id: string) => deleteFn({ data: id }),
    onSuccess: async (_, id) => {
      queryClient.removeQueries({ queryKey: featsKeys.single(id) })
      await queryClient.invalidateQueries({ queryKey: featsKeys.lists() })
    }
  })
}

export function useUpsertFeat() {
  const queryClient = useQueryClient()
  const upsertFn = useServerFn(upsertFeatFn)

  return useMutation({
    mutationFn: (data: FeatInput) => upsertFn({ data }),
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: featsKeys.lists() })

      queryClient.setQueryData(
        featsKeys.single(data.id),
        data
      )
    }
  })
}
