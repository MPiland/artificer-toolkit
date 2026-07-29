import { useCallback, useEffect, useRef, useState } from 'react'
import { notifications } from '@mantine/notifications'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useLocation, useRouter } from '@tanstack/react-router'
import type { QueryClient, QueryKey } from '@tanstack/react-query'
import type { AuthoredDraftDto } from '@artificer-toolkit/schema/api/content'
import { useAuthoredDeleteAction } from '#components/AuthoredDelete'
import type { AuthoredDetailPendingOperation } from './AuthoredDetail.types'

export function useAuthoredDetailActions({
  deleteActive,
  discard,
  detailSubjectQueryKey,
  domainLabel,
  domainQueryKey,
  draftQueryKey,
  duplicate,
  hasActiveContent,
  id,
  navigateEdit,
  navigateList
}: {
  deleteActive: (id: string) => Promise<void>
  discard: (id: string) => Promise<void>
  detailSubjectQueryKey: QueryKey
  domainLabel: string
  domainQueryKey: QueryKey
  draftQueryKey: QueryKey
  duplicate: (id: string) => Promise<AuthoredDraftDto | null>
  hasActiveContent: boolean
  id: string
  navigateEdit: (subject: { id: string; publicId: string; label: string }) => Promise<void>
  navigateList: () => Promise<void>
}) {
  const queryClient = useQueryClient()
  const router = useRouter()
  const currentHref = useLocation({ select: (location) => location.href })
  const currentHrefRef = useRef(currentHref)
  const duplicateInFlightRef = useRef(false)
  const duplicateOperationRef = useRef(0)
  const mountedRef = useRef(true)
  const [pendingOperation, setPendingOperation] = useState<AuthoredDetailPendingOperation | null>(
    null
  )
  const duplicateMutation = useMutation({ mutationFn: () => duplicate(id) })
  const discardMutation = useMutation({ mutationFn: () => discard(id) })
  const deleteAction = useAuthoredDeleteAction({
    deleteActive,
    deleteDraft: discard,
    detailSubjectQueryKey,
    domainLabel,
    domainQueryKey,
    draftQueryKey,
    onDeleted: navigateList
  })

  useEffect(() => {
    currentHrefRef.current = currentHref
  }, [currentHref])

  useEffect(() => {
    mountedRef.current = true

    return () => {
      mountedRef.current = false
      duplicateOperationRef.current += 1
    }
  }, [])

  const duplicateToDraft = useCallback(async () => {
    if (duplicateInFlightRef.current) return

    duplicateInFlightRef.current = true
    const operationId = duplicateOperationRef.current + 1
    duplicateOperationRef.current = operationId
    const sourceHref = currentHrefRef.current
    setPendingOperation({
      title: 'Creating draft...',
      body: `Creating an editable copy of this ${domainLabel.toLowerCase()}.`
    })

    try {
      const copied = await duplicateMutation.mutateAsync()
      await queryClient.invalidateQueries({ queryKey: domainQueryKey })
      notifications.show({
        color: 'green',
        message: `${domainLabel} duplicated as an owned draft.`
      })

      if (
        copied &&
        mountedRef.current &&
        duplicateOperationRef.current === operationId &&
        currentHrefRef.current === sourceHref
      ) {
        setPendingOperation(null)
        await navigateEdit({ id: copied.subjectId, publicId: copied.publicId, label: copied.label })
      }
    } catch {
      notifications.show({
        color: 'red',
        message: `Could not duplicate that ${domainLabel.toLowerCase()} yet.`
      })
    } finally {
      duplicateInFlightRef.current = false

      if (mountedRef.current && duplicateOperationRef.current === operationId) {
        setPendingOperation(null)
      }
    }
  }, [domainLabel, domainQueryKey, duplicateMutation, navigateEdit, queryClient])

  const discardDraft = useCallback(
    async ({ backToList = false }: { backToList?: boolean } = {}) => {
      try {
        await discardMutation.mutateAsync()
        await refreshAuthoredDetailAfterDraftDiscard({
          detailSubjectQueryKey,
          domainQueryKey,
          draftQueryKey,
          hasActiveContent,
          queryClient
        })
        notifications.show({
          color: 'green',
          message: `Stale ${domainLabel.toLowerCase()} draft discarded.`
        })

        if (backToList) {
          await navigateList()
          return
        }

        await router.invalidate()
      } catch {
        notifications.show({
          color: 'red',
          message: `Could not discard that ${domainLabel.toLowerCase()} draft yet.`
        })
      }
    },
    [
      detailSubjectQueryKey,
      discardMutation,
      domainLabel,
      domainQueryKey,
      draftQueryKey,
      hasActiveContent,
      navigateList,
      queryClient,
      router
    ]
  )

  return {
    deleteConfirmation: deleteAction.confirmation,
    deleteContent: deleteAction.requestDelete,
    discardDraft,
    duplicateToDraft,
    isDeleting: deleteAction.isDeleting,
    isDetailOperationPending: pendingOperation !== null,
    isDiscardingDraft: discardMutation.isPending,
    isDuplicating: duplicateMutation.isPending,
    pendingOperation
  }
}

export async function refreshAuthoredDetailAfterDraftDiscard({
  detailSubjectQueryKey,
  domainQueryKey,
  draftQueryKey,
  hasActiveContent,
  queryClient
}: {
  detailSubjectQueryKey: QueryKey
  domainQueryKey: QueryKey
  draftQueryKey: QueryKey
  hasActiveContent: boolean
  queryClient: QueryClient
}) {
  await queryClient.cancelQueries({ queryKey: draftQueryKey, exact: true })
  await queryClient.refetchQueries({ queryKey: draftQueryKey, exact: true, type: 'all' })

  if (hasActiveContent) {
    await queryClient.refetchQueries({ queryKey: detailSubjectQueryKey, type: 'all' })
  } else {
    queryClient.removeQueries({ queryKey: detailSubjectQueryKey })
  }

  await queryClient.invalidateQueries({ queryKey: domainQueryKey })
}
