import {
  useMutation,
  useQueryClient } from '@tanstack/react-query'
import type { FeatAuthoredDto } from '@artificer-toolkit/schema/subjects/feat'
import { api } from '#app/lib/api'
import { queryKeys } from '#app/lib/queryKeys'

export function useUpsertFeat() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: FeatAuthoredDto) => api.content.feats.upsert(data),
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.content.feats.all() })

      if (data?.item.id) {
        queryClient.setQueryData(queryKeys.content.feats.detail(data.item.id), data)
      }
    }
  })
}
