import { useQueryClient, useMutation } from '@tanstack/react-query'
import { useServerFn } from '@tanstack/react-start'
import { deleteSystemFn, upsertSystemFn } from '@server/domains'
import type { SystemInput } from '@types'

const systemsKeys = {
  all: ['systems'] as const,
  lists: () => [...systemsKeys.all, 'list'] as const,
  single: (id: string) => [...systemsKeys.all, 'single', id] as const
}

export function useDeleteSystem() {
  const queryClient = useQueryClient()
  const deleteFn = useServerFn(deleteSystemFn)

  return useMutation({
    mutationFn: (id: string) => deleteFn({ data: id }),
    onSuccess: async (_, id) => {
      queryClient.removeQueries({ queryKey: systemsKeys.single(id) })
      await queryClient.invalidateQueries({ queryKey: systemsKeys.lists() })
    }
  })
}

export function useUpsertSystem() {
  const queryClient = useQueryClient()
  const upsertFn = useServerFn(upsertSystemFn)

  return useMutation({
    mutationFn: (data: SystemInput) => upsertFn({ data }),
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: systemsKeys.lists() })

      queryClient.setQueryData(
        systemsKeys.single(data.id),
        data
      )
    }
  })
}
