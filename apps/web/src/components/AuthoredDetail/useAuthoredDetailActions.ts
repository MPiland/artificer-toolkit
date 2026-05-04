import {
  useCallback } from 'react'
import { notifications } from '@mantine/notifications'
import { useMutation,
  useQueryClient } from '@tanstack/react-query'
import { useRouter } from '@tanstack/react-router'
import type { QueryClient,
  QueryKey } from '@tanstack/react-query'
import type { AuthoredDraftDto } from '@artificer-toolkit/schema/api/content'

export function useAuthoredDetailActions({
  discard,
  detailQueryKey,
  domainLabel,
  domainQueryKey,
  draftQueryKey,
  duplicate,
  hasActiveContent,
  id,
  navigateEdit,
  navigateList
}: {
  discard: (id: string) => Promise<void>
  detailQueryKey: QueryKey
  domainLabel: string
  domainQueryKey: QueryKey
  draftQueryKey: QueryKey
  duplicate: (id: string) => Promise<AuthoredDraftDto | null>
  hasActiveContent: boolean
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
      await refreshAuthoredDetailAfterDraftDiscard({
        detailQueryKey,
        domainQueryKey,
        draftQueryKey,
        hasActiveContent,
        queryClient
      })
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
    detailQueryKey,
    discardMutation,
    domainLabel,
    domainQueryKey,
    draftQueryKey,
    hasActiveContent,
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

export async function refreshAuthoredDetailAfterDraftDiscard({
  detailQueryKey,
  domainQueryKey,
  draftQueryKey,
  hasActiveContent,
  queryClient
}: {
  detailQueryKey: QueryKey
  domainQueryKey: QueryKey
  draftQueryKey: QueryKey
  hasActiveContent: boolean
  queryClient: QueryClient
}) {
  await queryClient.cancelQueries({ queryKey: draftQueryKey, exact: true })
  await queryClient.refetchQueries({ queryKey: draftQueryKey, exact: true, type: 'all' })

  if (hasActiveContent) {
    await queryClient.refetchQueries({ queryKey: detailQueryKey, exact: true, type: 'all' })
  } else {
    queryClient.removeQueries({ queryKey: detailQueryKey, exact: true })
  }

  await queryClient.invalidateQueries({ queryKey: domainQueryKey })
}
