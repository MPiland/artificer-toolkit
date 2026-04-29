import { useQueryClient, useMutation } from '@tanstack/react-query'
import { useServerFn } from '@tanstack/react-start'
import { deleteBackgroundFn, upsertBackgroundFn } from '@server/domains'
import type { BackgroundInput } from '@types'

const backgroundsKeys = {
  all: ['backgrounds'] as const,
  lists: () => [...backgroundsKeys.all, 'list'] as const,
  single: (id: string) => [...backgroundsKeys.all, 'single', id] as const
}

export function useDeleteBackground() {
  const queryClient = useQueryClient()
  const deleteFn = useServerFn(deleteBackgroundFn)

  return useMutation({
    mutationFn: (id: string) => deleteFn({ data: id }),
    onSuccess: async (_, id) => {
      queryClient.removeQueries({ queryKey: backgroundsKeys.single(id) })
      await queryClient.invalidateQueries({ queryKey: backgroundsKeys.lists() })
    }
  })
}

export function useUpsertBackground() {
  const queryClient = useQueryClient()
  const upsertFn = useServerFn(upsertBackgroundFn)

  return useMutation({
    mutationFn: (data: BackgroundInput) => upsertFn({ data }),
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: backgroundsKeys.lists() })

      queryClient.setQueryData(
        backgroundsKeys.single(data.id),
        data
      )
    }
  })
}
