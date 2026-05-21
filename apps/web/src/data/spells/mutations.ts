import {
  useMutation,
  useQueryClient
} from '@tanstack/react-query'
import type { SpellAuthoringInputDto } from '@artificer-toolkit/schema/subjects/spell'
import { api } from '#app/lib/api'
import { queryKeys } from '#app/lib/queryKeys'

export function useActivateSpellMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (spell: SpellAuthoringInputDto) => api.content.spells.activate(spell),
    onSuccess: async (response) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.content.spells.all() })

      if (response?.item?.id) {
        queryClient.setQueryData(queryKeys.content.spells.detail(response.item.id), response)
        await queryClient.invalidateQueries({ queryKey: queryKeys.content.spells.draft(response.item.id) })
      }
    }
  })
}

export function useSaveSpellDraftMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (spell: SpellAuthoringInputDto) => api.content.spells.saveDraft(spell),
    onSuccess: async (draft) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.content.spells.all() })
      await queryClient.invalidateQueries({ queryKey: queryKeys.content.spells.draft(draft.subjectId) })
    }
  })
}

export function useDiscardSpellDraftMutation(spellId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => api.content.spells.discardDraft(spellId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.content.spells.all() })
      await queryClient.invalidateQueries({ queryKey: queryKeys.content.spells.draft(spellId) })
    }
  })
}

export function useDuplicateSpellMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (spellId: string) => api.content.spells.duplicate(spellId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.content.spells.all() })
    }
  })
}
