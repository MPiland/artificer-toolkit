import {
  useCallback,
  useMemo,
  useState
} from 'react'
import {
  Alert,
  Button,
  Stack
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import {
  getRouteApi,
  useNavigate,
  useRouter
} from '@tanstack/react-router'
import {
  backgroundAuthoringInputDtoSchema,
  type BackgroundAuthoringInputDto,
  type BackgroundAuthoredDto
} from '@artificer-toolkit/schema/subjects/background'
import type { AuthoredDraftDto } from '@artificer-toolkit/schema/api/content'
import {
  AuthoringFormLayout,
  AuthoringFormProvider,
  InvalidDraftAlert,
  clearResolvedNodeFormPaths,
  useAppForm,
  useAuthoringFormRegistration,
  type AuthoringFormActionHandlers,
  type AuthoringFormRegistration
} from '#forms'
import { useAuthoredDeleteAction } from '#components/AuthoredDelete'
import { parseAuthoredDraftPayload } from '#app/data/authoredDrafts'
import {
  useActivateBackgroundMutation,
  useDiscardBackgroundDraftMutation,
  useDuplicateBackgroundMutation,
  useSaveBackgroundDraftMutation
} from '#app/data/backgrounds/mutations'
import { api } from '#app/lib/api'
import { queryKeys } from '#app/lib/queryKeys'
import {
  normalizeBackgroundForSubmit
} from '../backgroundAuthoring.utils'
import { BackgroundAuthoringRenderer } from '../components/BackgroundAuthoringRenderer'
import { buildBackgroundRouteParams } from '#app/routing/authoredRouteParams'

type ParsedBackgroundDraft = {
  draft: AuthoredDraftDto | null
  isInvalid: boolean
  item: BackgroundAuthoringInputDto | undefined
}

export function BackgroundEditPage() {
  const route = getRouteApi('/_authed/backgrounds/$backgroundPublicId/$backgroundSlug')
  const { backgroundId, draft, response } = route.useLoaderData()
  const parsedDraft: ParsedBackgroundDraft = parseAuthoredDraftPayload(draft ?? null, backgroundAuthoringInputDtoSchema)
  const draftBackground = parsedDraft.item
  const activeBackground = response?.item ?? undefined

  if (!response) {
    if (parsedDraft.isInvalid) {
      return <InvalidBackgroundDraftOnlyState backgroundId={backgroundId} />
    }
    if (!draftBackground) {
      return <BackgroundNotFoundState />
    }
  }

  const background = draftBackground ?? activeBackground ?? null

  if (!background) {
    return <BackgroundNotFoundState />
  }

  const formKey = `edit:${backgroundId}:${draft?.updatedAt ?? backgroundId}:${draftBackground ? 'draft' : 'active'}`

  return (
    <AuthoringFormProvider>
      <BackgroundEditAuthoring
        key={formKey}
        activeBackground={activeBackground}
        draft={parsedDraft.draft}
        hasInvalidDraft={Boolean(draft && parsedDraft.isInvalid)}
        permissions={response?.permissions}
        background={background}
        backgroundId={backgroundId}
      />
    </AuthoringFormProvider>
  )
}

function BackgroundEditAuthoring({
  activeBackground,
  draft,
  hasInvalidDraft,
  permissions,
  background,
  backgroundId
}: {
  activeBackground?: BackgroundAuthoredDto
  draft: AuthoredDraftDto | null
  hasInvalidDraft: boolean
  permissions?: {
    canCopy: boolean
    canDelete: boolean
    canEdit: boolean
  }
  background: BackgroundAuthoringInputDto | BackgroundAuthoredDto
  backgroundId: string
}) {
  const navigate = useNavigate()
  const router = useRouter()
  const activateMutation = useActivateBackgroundMutation()
  const discardDraftMutation = useDiscardBackgroundDraftMutation(backgroundId)
  const draftMutation = useSaveBackgroundDraftMutation()
  const duplicateMutation = useDuplicateBackgroundMutation()
  const [formValues] = useState<BackgroundAuthoringInputDto>(() => normalizeBackgroundForSubmit(background))
  const readOnly = Boolean(activeBackground && permissions?.canEdit === false)
  const canCopy = Boolean(permissions?.canCopy && backgroundId)
  const canDelete = !readOnly && Boolean(draft || permissions?.canDelete)
  const {
    confirmation: deleteConfirmation,
    isDeleting,
    requestDelete
  } = useAuthoredDeleteAction({
    deleteActive: api.content.backgrounds.deleteActive,
    deleteDraft: api.content.backgrounds.discardDraft,
    detailSubjectQueryKey: queryKeys.content.backgrounds.detailRoot(backgroundId),
    domainLabel: 'Background',
    domainQueryKey: queryKeys.content.backgrounds.all(),
    draftQueryKey: queryKeys.content.backgrounds.draft(backgroundId),
    onDeleted: async () => navigate({ to: '/backgrounds' })
  })

  const handleCancel = useCallback(async () => {
    await navigate({ to: '/backgrounds' })
  }, [navigate])

  const handleActivate = useCallback(async (payload: BackgroundAuthoringInputDto) => {
    if (readOnly) return

    try {
      const response = await activateMutation.mutateAsync(payload)
      notifications.show({ color: 'green', message: 'Background activated.' })

      if (response?.item?.id && response.item.id !== backgroundId) {
        await navigate({
          params: buildBackgroundRouteParams(response.publicId, response.item.label),
          to: '/backgrounds/$backgroundPublicId/$backgroundSlug'
        })
        return
      }

      await router.invalidate()
    } catch {
      notifications.show({ color: 'red', message: 'Could not activate that background yet.' })
    }
  }, [
    activateMutation,
    backgroundId,
    navigate,
    readOnly,
    router
  ])

  const form = useAppForm({
    defaultValues: formValues,
    onSubmit: async ({ value }) => {
      await handleActivate(normalizeBackgroundForSubmit(value))
    }
  })

  const handleDiscardDraft = useCallback(async () => {
    try {
      await discardDraftMutation.mutateAsync()
      notifications.show({ color: 'green', message: 'Stale background draft discarded.' })

      if (!activeBackground) {
        await navigate({ to: '/backgrounds' })
        return
      }

      await router.invalidate()
    } catch {
      notifications.show({ color: 'red', message: 'Could not discard that draft yet.' })
    }
  }, [
    activeBackground,
    discardDraftMutation,
    navigate,
    router
  ])

  const handleCopy = useCallback(async () => {
    try {
      const copied = await duplicateMutation.mutateAsync(backgroundId)
      notifications.show({ color: 'green', message: 'Background duplicated as an owned draft.' })

      if (copied?.subjectId) {
        await navigate({
          params: buildBackgroundRouteParams(copied.publicId, copied.label),
          to: '/backgrounds/$backgroundPublicId/$backgroundSlug/edit'
        })
      }
    } catch {
      notifications.show({ color: 'red', message: 'Could not duplicate that background yet.' })
    }
  }, [
    backgroundId,
    duplicateMutation,
    navigate
  ])

  const handleSaveDraft = useCallback(async () => {
    if (readOnly) return

    try {
      await draftMutation.mutateAsync(normalizeBackgroundForSubmit(form.state.values))
      notifications.show({ color: 'green', message: 'Background draft saved.' })
      await router.invalidate()
    } catch {
      notifications.show({ color: 'red', message: 'Could not save that draft yet.' })
    }
  }, [
    draftMutation,
    form,
    readOnly,
    router
  ])

  const handleDelete = useCallback(() => {
    requestDelete({
      id: backgroundId,
      kind: draft ? 'draft' : 'active',
      label: formValues.label || 'Untitled Background'
    })
  }, [
    backgroundId,
    draft,
    formValues.label,
    requestDelete
  ])

  const registration = useMemo<AuthoringFormRegistration>(() => ({
    activateLabel: 'Activate Background',
    canDelete,
    canCopy,
    canSaveDraft: !readOnly,
    hasActiveDraft: Boolean(draft && activeBackground),
    isDraft: Boolean(draft),
    mapId: 'background',
    mode: readOnly ? 'view' : 'edit',
    readOnly,
    resolveModel: true,
    saveDraftLabel: 'Save Draft',
    subjectKindLabel: 'Background',
    subjectLabel: formValues.label || 'Untitled Background',
    systemId: formValues.systemId,
    isDeleting
  }), [
    activeBackground,
    canDelete,
    canCopy,
    draft,
    formValues.label,
    formValues.systemId,
    isDeleting,
    readOnly
  ])

  const actions = useMemo<AuthoringFormActionHandlers>(() => ({
    onActivate: () => form.handleSubmit(),
    onCancel: handleCancel,
    onClearPaths: (paths) => clearResolvedNodeFormPaths(form, paths),
    onCopy: canCopy ? handleCopy : undefined,
    onDelete: canDelete ? handleDelete : undefined,
    onSaveDraft: readOnly ? undefined : handleSaveDraft
  }), [
    canDelete,
    canCopy,
    form,
    handleCancel,
    handleCopy,
    handleDelete,
    handleSaveDraft,
    readOnly
  ])

  useAuthoringFormRegistration(registration, actions)

  return (
    <form.AppForm>
      <Stack>
        {hasInvalidDraft
          ? (
              <InvalidDraftAlert
                domainLabel='background'
                isDiscarding={discardDraftMutation.isPending}
                onDiscard={() => void handleDiscardDraft()}
              />
            )
          : null}
        <AuthoringFormLayout>
          <BackgroundAuthoringRenderer form={form} />
        </AuthoringFormLayout>
        {deleteConfirmation}
      </Stack>
    </form.AppForm>
  )
}

function BackgroundNotFoundState() {
  const navigate = useNavigate()

  return (
    <Stack>
      <Alert color='yellow'>That background could not be found.</Alert>
      <Button onClick={() => navigate({ to: '/backgrounds' })}>Back to backgrounds</Button>
    </Stack>
  )
}

function InvalidBackgroundDraftOnlyState({ backgroundId }: { backgroundId: string }) {
  const navigate = useNavigate()
  const router = useRouter()
  const discardDraftMutation = useDiscardBackgroundDraftMutation(backgroundId)

  async function handleDiscardDraft() {
    try {
      await discardDraftMutation.mutateAsync()
      notifications.show({ color: 'green', message: 'Stale background draft discarded.' })
      await router.invalidate()
      await navigate({ to: '/backgrounds' })
    } catch {
      notifications.show({ color: 'red', message: 'Could not discard that draft yet.' })
    }
  }

  return (
    <Stack>
      <InvalidDraftAlert
        domainLabel='background'
        isDiscarding={discardDraftMutation.isPending}
        onDiscard={() => void handleDiscardDraft()}
      />
      <Button onClick={() => navigate({ to: '/backgrounds' })}>Back to backgrounds</Button>
    </Stack>
  )
}
