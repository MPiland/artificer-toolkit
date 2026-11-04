import { useAuthoredDeleteAction } from '#components/AuthoredDelete'
import { useDeleteCharacterMutation } from '#app/data/characters/mutations'
import { queryKeys } from '#app/lib/queryKeys'

/** Permanent owner delete of a Character with the shared confirmation naming it. */
export function useCharacterDeleteAction(onDeleted?: () => Promise<void> | void) {
  const { mutateAsync } = useDeleteCharacterMutation()
  const deleteCharacter = async (id: string) => {
    await mutateAsync({ id })
  }

  const action = useAuthoredDeleteAction({
    activeConsequence:
      'This permanently deletes the Character, its draft and its Campaign assignment. It cannot be restored.',
    deleteActive: deleteCharacter,
    deleteDraft: deleteCharacter,
    detailSubjectQueryKey: queryKeys.characters.detail,
    domainLabel: 'Character',
    domainQueryKey: queryKeys.characters.all(),
    draftQueryKey: queryKeys.characters.draft,
    onDeleted
  })

  return {
    confirmation: action.confirmation,
    requestDelete: (target: { id: string; label: string }) =>
      action.requestDelete({ ...target, kind: 'active' })
  }
}
