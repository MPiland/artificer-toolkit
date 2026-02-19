import { useQueryClient, useMutation } from '@tanstack/react-query'
import { useServerFn } from '@tanstack/react-start'
import { deleteSpellFn, upsertSpellFn } from '@server/domains'
import type { SpellInput } from '@types'

const spellsKeys = {
  all: ['spells'] as const,
  lists: () => [...spellsKeys.all, 'list'] as const,
  single: (id: string) => [...spellsKeys.all, 'single', id] as const
}

export function useDeleteSpell() {
  const queryClient = useQueryClient()
  const deleteFn = useServerFn(deleteSpellFn)

  return useMutation({
    mutationFn: (id: string) => deleteFn({ data: id }),
    onSuccess: async (_, id) => {
      queryClient.removeQueries({ queryKey: spellsKeys.single(id) })
      await queryClient.invalidateQueries({ queryKey: spellsKeys.lists() })
    }
  })
}

export function useUpsertSpell() {
  const queryClient = useQueryClient()
  const upsertFn = useServerFn(upsertSpellFn)

  return useMutation({
    mutationFn: (data: SpellInput) => upsertFn({ data }),
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: spellsKeys.lists() })

      queryClient.setQueryData(
        spellsKeys.single(data.id),
        data
      )
    }
  })
}
