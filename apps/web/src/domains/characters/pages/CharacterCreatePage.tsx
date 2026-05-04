import { useCallback, useMemo, useState } from 'react'
import { Alert, Button, Stack } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { getRouteApi, useNavigate, useRouter } from '@tanstack/react-router'
import { AUTHORED_RECORD_STATUS } from '@artificer-toolkit/shared/core'
import type { CharacterBuilderPreviewPayloadDto, CharacterBuilderPayloadDto } from '@artificer-toolkit/schema/api/characters'
import {
  AuthoringFormLayout,
  AuthoringFormProvider,
  useAppForm,
  useAuthoringFormRegistration,
  type AuthoringFormActionHandlers,
  type AuthoringFormRegistration
} from '#forms'
import {
  useCommitCharacterBuilderMutation,
  usePreviewCharacterSaveMutation,
  useSaveCharacterDraftMutation
} from '#app/data/characters/mutations'
import {
  buildCharacterDraftSaveInput,
  getInactiveAbilityIntentMethodLabels,
  normalizeCharacterForCommit,
  toCharacterFormValues
} from '../characterBuilder.utils'
import { CharacterDraftSaveNoticeModal } from '../components/CharacterDraftSaveNoticeModal'
import { CharacterBuilderRenderer } from '../components/CharacterBuilderRenderer'
import { CharacterSavePreviewModal } from '../components/CharacterSavePreviewModal'
import { useLatestCharacterResolution } from '../hooks/useLatestCharacterResolution'

export function CharacterCreatePage() {
  const route = getRouteApi('/_authed/characters/new')
  const { payload } = route.useLoaderData()

  if (!payload) {
    return <CharacterSystemRequiredState />
  }

  return (
    <AuthoringFormProvider>
      <CharacterCreateAuthoring initialPayload={payload} />
    </AuthoringFormProvider>
  )
}

function CharacterCreateAuthoring({
  initialPayload
}: {
  initialPayload: CharacterBuilderPayloadDto
}) {
  const navigate = useNavigate()
  const router = useRouter()
  const [payload, setPayload] = useState(initialPayload)
  const [draftSaveNoticeOpened, setDraftSaveNoticeOpened] = useState(false)
  const [draftSaveNoticeAcknowledged, setDraftSaveNoticeAcknowledged] = useState(false)
  const [draftSaveNoticeMethodLabels, setDraftSaveNoticeMethodLabels] = useState<string[]>([])
  const [preview, setPreview] = useState<CharacterBuilderPreviewPayloadDto | null>(null)
  const [previewOpened, setPreviewOpened] = useState(false)
  const draftMutation = useSaveCharacterDraftMutation()
  const previewMutation = usePreviewCharacterSaveMutation()
  const commitMutation = useCommitCharacterBuilderMutation()
  const [initialValues] = useState(() => toCharacterFormValues(initialPayload))

  const form = useAppForm({
    defaultValues: initialValues,
    onSubmit: async ({ value }) => {
      try {
        const nextPreview = await previewMutation.mutateAsync({
          character: normalizeCharacterForCommit(value),
          mode: 'create',
          targetStatus: AUTHORED_RECORD_STATUS.ACTIVE
        })
        setPreview(nextPreview)
        setPreviewOpened(true)
      } catch {
        notifications.show({ color: 'red', message: 'This character is not ready to finalize yet.' })
      }
    }
  })

  const handleCancel = useCallback(async () => {
    await navigate({ to: '/characters' })
  }, [navigate])

  const handleResolve = useLatestCharacterResolution({
    mode: 'create',
    onResolved: setPayload
  })

  const handleSaveDraftConfirmed = useCallback(async () => {
    try {
      const draft = await draftMutation.mutateAsync(buildCharacterDraftSaveInput(form.state.values, 'create'))
      setDraftSaveNoticeAcknowledged(true)
      setDraftSaveNoticeOpened(false)
      notifications.show({ color: 'green', message: 'Character draft saved.' })
      await router.invalidate()
      await navigate({ to: '/characters/$characterId/edit', params: { characterId: draft.characterId } })
    } catch {
      notifications.show({ color: 'red', message: 'Could not save that character draft yet.' })
    }
  }, [
    draftMutation,
    form,
    navigate,
    router
  ])

  const handleSaveDraft = useCallback(async () => {
    const inactiveAbilityMethodLabels = getInactiveAbilityIntentMethodLabels(form.state.values)
    if (!draftSaveNoticeAcknowledged && inactiveAbilityMethodLabels.length > 0) {
      setDraftSaveNoticeMethodLabels(inactiveAbilityMethodLabels)
      setDraftSaveNoticeOpened(true)
      return
    }

    await handleSaveDraftConfirmed()
  }, [
    draftSaveNoticeAcknowledged,
    form,
    handleSaveDraftConfirmed
  ])

  const handleConfirmFinalize = useCallback(async () => {
    try {
      const response = await commitMutation.mutateAsync({
        character: normalizeCharacterForCommit(form.state.values),
        mode: 'create',
        targetStatus: AUTHORED_RECORD_STATUS.ACTIVE
      })
      notifications.show({ color: 'green', message: 'Character finalized.' })
      await router.invalidate()
      await navigate({ to: '/characters/$characterId', params: { characterId: response.character.id } })
    } catch {
      notifications.show({ color: 'red', message: 'Could not finalize that character yet.' })
    }
  }, [
    commitMutation,
    form,
    navigate,
    router
  ])

  const registration = useMemo<AuthoringFormRegistration>(() => ({
    activateLabel: 'Finalize Character',
    canSaveDraft: true,
    hasActiveDraft: false,
    mode: 'create',
    readOnly: false,
    saveDraftLabel: 'Save Draft',
    subjectKindLabel: 'Character',
    subjectLabel: payload.character.label || 'Untitled Character',
    systemId: payload.character.systemId
  }), [
    payload.character.label,
    payload.character.systemId
  ])

  const actions = useMemo<AuthoringFormActionHandlers>(() => ({
    onActivate: () => form.handleSubmit(),
    onCancel: handleCancel,
    onSaveDraft: handleSaveDraft
  }), [
    form,
    handleCancel,
    handleSaveDraft
  ])

  useAuthoringFormRegistration(registration, actions)

  return (
    <form.AppForm>
      <AuthoringFormLayout>
        <CharacterBuilderRenderer
          form={form}
          payload={payload}
          onResolve={handleResolve}
        />
      </AuthoringFormLayout>
      <CharacterSavePreviewModal
        isCommitting={commitMutation.isPending}
        opened={previewOpened}
        preview={preview}
        onClose={() => setPreviewOpened(false)}
        onConfirm={() => void handleConfirmFinalize()}
      />
      <CharacterDraftSaveNoticeModal
        inactiveAbilityMethodLabels={draftSaveNoticeMethodLabels}
        isSaving={draftMutation.isPending}
        opened={draftSaveNoticeOpened}
        onClose={() => setDraftSaveNoticeOpened(false)}
        onConfirm={() => void handleSaveDraftConfirmed()}
      />
    </form.AppForm>
  )
}

function CharacterSystemRequiredState() {
  const navigate = useNavigate()

  return (
    <Stack>
      <Alert color='yellow'>A system is required before creating characters.</Alert>
      <Button onClick={() => navigate({ to: '/characters' })}>Back to characters</Button>
    </Stack>
  )
}
