import type {
  ActivatedAuthoringItem,
  CreateActivateActionArgs,
  CreateCancelActionArgs,
  CreateCopyActionArgs,
  CreateDeleteRequestActionArgs,
  CreateDiscardDraftActionArgs,
  CreateDraftActionArgs,
  CreateUpdateDraftActionArgs,
  DraftAuthoringResponse,
  DuplicateAuthoringResponse
} from './authoringActionBuilders.types'

export function createCancelAction({ listPath, navigate }: CreateCancelActionArgs) {
  return async () => {
    await navigate({ to: listPath })
  }
}

export function createActivateAction<
  TSubmit extends object,
  TItem extends ActivatedAuthoringItem = ActivatedAuthoringItem
>({
  activateMutation,
  buildRouteParams,
  detailPath,
  messages,
  navigate,
  notifier,
  readOnly = false,
  router
}: CreateActivateActionArgs<TSubmit, TItem>) {
  return async (payload: TSubmit) => {
    if (readOnly) return

    try {
      const response = await activateMutation.mutateAsync(payload)
      notifier.show({ color: 'green', message: messages.activateSuccess })

      if (response?.item?.id) {
        await navigate({
          params: buildRouteParams(response.publicId, response.item.label),
          to: detailPath
        })
        return
      }

      await router?.invalidate()
    } catch {
      notifier.show({ color: 'red', message: messages.activateError })
    }
  }
}

export function createCreateDraftAction<
  TSubmit extends object,
  TResponse extends DraftAuthoringResponse = DraftAuthoringResponse
>({
  buildRouteParams,
  draftMutation,
  editPath,
  messages,
  navigate,
  notifier
}: CreateDraftActionArgs<TSubmit, TResponse>) {
  return async (payload: TSubmit) => {
    try {
      const draft = await draftMutation.mutateAsync(payload)
      notifier.show({ color: 'green', message: messages.saveDraftSuccess })
      await navigate({
        params: buildRouteParams(draft.publicId, draft.label),
        to: editPath
      })
      return true
    } catch {
      notifier.show({ color: 'red', message: messages.saveDraftError })
      return false
    }
  }
}

export function createUpdateDraftAction<TSubmit extends object>({
  draftMutation,
  messages,
  notifier,
  readOnly = false
}: CreateUpdateDraftActionArgs<TSubmit>) {
  return async (payload: TSubmit) => {
    if (readOnly) return false

    try {
      await draftMutation.mutateAsync(payload)
      notifier.show({ color: 'green', message: messages.saveDraftSuccess })
      return true
    } catch {
      notifier.show({ color: 'red', message: messages.saveDraftError })
      return false
    }
  }
}

export function createCopyAction<
  TResponse extends DuplicateAuthoringResponse | null | undefined = DuplicateAuthoringResponse
>({
  buildRouteParams,
  duplicateMutation,
  editPath,
  messages,
  navigate,
  notifier,
  subjectId
}: CreateCopyActionArgs<TResponse>) {
  return async () => {
    try {
      const copied = await duplicateMutation.mutateAsync(subjectId)
      notifier.show({ color: 'green', message: messages.copySuccess })

      if (copied?.subjectId) {
        await navigate({
          params: buildRouteParams(copied.publicId, copied.label),
          to: editPath
        })
      }
    } catch {
      notifier.show({ color: 'red', message: messages.copyError })
    }
  }
}

export function createDeleteRequestAction({
  draft,
  label,
  requestDelete,
  subjectKindLabel,
  subjectId
}: CreateDeleteRequestActionArgs) {
  return () => {
    requestDelete({
      id: subjectId,
      kind: draft ? 'draft' : 'active',
      label: label || `Untitled ${subjectKindLabel}`
    })
  }
}

export function createDiscardDraftAction({
  activeRecord,
  discardDraftMutation,
  listPath,
  messages,
  navigate,
  notifier,
  router
}: CreateDiscardDraftActionArgs) {
  return async () => {
    try {
      await discardDraftMutation.mutateAsync()
      notifier.show({ color: 'green', message: messages.discardDraftSuccess })

      if (!activeRecord) {
        await navigate({ to: listPath })
        return
      }

      await router.invalidate()
    } catch {
      notifier.show({ color: 'red', message: messages.discardDraftError })
    }
  }
}
