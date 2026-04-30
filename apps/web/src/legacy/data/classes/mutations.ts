import { useQueryClient, useMutation } from '@tanstack/react-query'
import { useServerFn } from '@tanstack/react-start'
import { deleteClassFn, upsertClassFn } from '@server/domains'
import type { ClassInput } from '@types'

const classsKeys = {
  all: ['classs'] as const,
  lists: () => [...classsKeys.all, 'list'] as const,
  single: (id: string) => [...classsKeys.all, 'single', id] as const
}

export function useDeleteClass() {
  const queryClient = useQueryClient()
  const deleteFn = useServerFn(deleteClassFn)

  return useMutation({
    mutationFn: (id: string) => deleteFn({ data: id }),
    onSuccess: async (_, id) => {
      queryClient.removeQueries({ queryKey: classsKeys.single(id) })
      await queryClient.invalidateQueries({ queryKey: classsKeys.lists() })
    }
  })
}

export function useUpsertClass() {
  const queryClient = useQueryClient()
  const upsertFn = useServerFn(upsertClassFn)

  return useMutation({
    mutationFn: (data: ClassInput) => upsertFn({ data }),
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: classsKeys.lists() })

      queryClient.setQueryData(
        classsKeys.single(data.id),
        data
      )
    }
  })
}
