import { useQueryClient, useMutation } from '@tanstack/react-query'
import { useServerFn } from '@tanstack/react-start'
import { deleteFeatureFn, upsertFeatureFn } from '@server/domains'
import type { FeatureInput } from '@types'

const featuresKeys = {
  all: ['features'] as const,
  lists: () => [...featuresKeys.all, 'list'] as const,
  single: (id: string) => [...featuresKeys.all, 'single', id] as const
}

export function useDeleteFeature() {
  const queryClient = useQueryClient()
  const deleteFn = useServerFn(deleteFeatureFn)

  return useMutation({
    mutationFn: (id: string) => deleteFn({ data: id }),
    onSuccess: async (_, id) => {
      queryClient.removeQueries({ queryKey: featuresKeys.single(id) })
      await queryClient.invalidateQueries({ queryKey: featuresKeys.lists() })
    }
  })
}

export function useUpsertFeature() {
  const queryClient = useQueryClient()
  const upsertFn = useServerFn(upsertFeatureFn)

  return useMutation({
    mutationFn: (data: FeatureInput) => upsertFn({ data }),
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: featuresKeys.lists() })

      queryClient.setQueryData(
        featuresKeys.single(data.id),
        data
      )
    }
  })
}
