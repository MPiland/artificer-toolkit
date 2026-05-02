import { useCallback } from 'react'
import { notifications } from '@mantine/notifications'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from '@tanstack/react-router'
import type { QueryKey } from '@tanstack/react-query'
import type { AuthoredDraftDto } from '@artificer-toolkit/schema'

export function useAuthoredDetailActions({
  discard,
  domainLabel,
  domainQueryKey,
  duplicate,
  id,
  navigateEdit,
  navigateList
}: {
  discard: (id: string) => Promise<void>
  domainLabel: string
  domainQueryKey: QueryKey
  duplicate: (id: string) => Promise<AuthoredDraftDto | null>
  id: string
  navigateEdit: (id: string) => Promise<void>
  navigateList: () => Promise<void>
}) {
  const queryClient = useQueryClient()
  const router = useRouter()
  const duplicateMutation = useMutation({ mutationFn: () => duplicate(id) })
  const discardMutation = useMutation({ mutationFn: () => discard(id) })

  const duplicateToDraft = useCallback(async () => {
    try {
      const copied = await duplicateMutation.mutateAsync()
      await queryClient.invalidateQueries({ queryKey: domainQueryKey })
      notifications.show({ color: 'green', message: `${domainLabel} duplicated as an owned draft.` })

      if (copied?.subjectId) {
        await navigateEdit(copied.subjectId)
      }
    } catch {
      notifications.show({ color: 'red', message: `Could not duplicate that ${domainLabel.toLowerCase()} yet.` })
    }
  }, [
    domainLabel,
    domainQueryKey,
    duplicateMutation,
    navigateEdit,
    queryClient
  ])

  const discardDraft = useCallback(async ({ backToList = false }: { backToList?: boolean } = {}) => {
    try {
      await discardMutation.mutateAsync()
      await queryClient.invalidateQueries({ queryKey: domainQueryKey })
      notifications.show({ color: 'green', message: `Stale ${domainLabel.toLowerCase()} draft discarded.` })

      if (backToList) {
        await navigateList()
        return
      }

      await router.invalidate()
    } catch {
      notifications.show({ color: 'red', message: `Could not discard that ${domainLabel.toLowerCase()} draft yet.` })
    }
  }, [
    discardMutation,
    domainLabel,
    domainQueryKey,
    navigateList,
    queryClient,
    router
  ])

  return {
    discardDraft,
    duplicateToDraft,
    isDiscardingDraft: discardMutation.isPending,
    isDuplicating: duplicateMutation.isPending
  }
}
