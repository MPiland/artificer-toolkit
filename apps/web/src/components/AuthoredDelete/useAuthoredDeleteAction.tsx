import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { notifications } from '@mantine/notifications'
import { useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query'
import { AuthoredDeleteConfirmModal } from './AuthoredDeleteConfirmModal'
import type { AuthoredDeleteTarget } from './AuthoredDelete.types'

type QueryKeyResolver = QueryKey | ((id: string) => QueryKey)

function resolveQueryKey(resolver: QueryKeyResolver, id: string): QueryKey {
  return typeof resolver === 'function' ? resolver(id) : resolver
}

export function useAuthoredDeleteAction({
  deleteActive,
  deleteDraft,
  detailSubjectQueryKey,
  domainLabel,
  domainQueryKey,
  draftQueryKey,
  onDeleted
}: {
  deleteActive: (id: string) => Promise<void>
  deleteDraft: (id: string) => Promise<void>
  detailSubjectQueryKey: QueryKeyResolver
  domainLabel: string
  domainQueryKey: QueryKey
  draftQueryKey: QueryKeyResolver
  onDeleted?: (target: AuthoredDeleteTarget) => Promise<void> | void
}) {
  const queryClient = useQueryClient()
  const [target, setTarget] = useState<AuthoredDeleteTarget | null>(null)
  const deleteMutation = useMutation({
    mutationFn: async (nextTarget: AuthoredDeleteTarget) => {
      if (nextTarget.kind === 'draft') {
        await deleteDraft(nextTarget.id)
        return
      }

      await deleteActive(nextTarget.id)
    }
  })

  const requestDelete = useCallback((nextTarget: AuthoredDeleteTarget) => {
    setTarget(nextTarget)
  }, [])

  const closeDelete = useCallback(() => {
    if (!deleteMutation.isPending) {
      setTarget(null)
    }
  }, [deleteMutation.isPending])

  const confirmDelete = useCallback(async () => {
    if (!target) return

    const deletedTarget = target
    const detailKey = resolveQueryKey(detailSubjectQueryKey, deletedTarget.id)
    const draftKey = resolveQueryKey(draftQueryKey, deletedTarget.id)

    try {
      await deleteMutation.mutateAsync(deletedTarget)
      await queryClient.cancelQueries({ queryKey: detailKey })
      queryClient.removeQueries({ queryKey: detailKey })

      if (deletedTarget.kind === 'draft') {
        await queryClient.cancelQueries({ queryKey: draftKey, exact: true })
        queryClient.removeQueries({ queryKey: draftKey, exact: true })
      } else {
        await queryClient.invalidateQueries({ queryKey: draftKey, exact: true })
      }

      await queryClient.invalidateQueries({ queryKey: domainQueryKey })
      notifications.show({ color: 'green', message: `${domainLabel} deleted.` })
      setTarget(null)
      await onDeleted?.(deletedTarget)
    } catch (error) {
      notifications.show({
        color: 'red',
        message: getDeleteErrorMessage(domainLabel, error)
      })
    }
  }, [
    deleteMutation,
    detailSubjectQueryKey,
    domainLabel,
    domainQueryKey,
    draftQueryKey,
    onDeleted,
    queryClient,
    target
  ])

  const confirmation = useMemo<ReactNode>(() => (
    <AuthoredDeleteConfirmModal
      domainLabel={domainLabel}
      isDeleting={deleteMutation.isPending}
      target={target}
      onClose={closeDelete}
      onConfirm={() => void confirmDelete()}
    />
  ), [
    closeDelete,
    confirmDelete,
    deleteMutation.isPending,
    domainLabel,
    target
  ])

  return {
    confirmation,
    isDeleting: deleteMutation.isPending,
    requestDelete
  }
}

function getDeleteErrorMessage(domainLabel: string, error: unknown) {
  const lowerLabel = domainLabel.toLowerCase()

  if (error instanceof Error && error.message.toLowerCase().includes('dependent content')) {
    return `Delete the dependent ${lowerLabel} records first.`
  }

  return `Could not delete that ${lowerLabel} yet.`
}
