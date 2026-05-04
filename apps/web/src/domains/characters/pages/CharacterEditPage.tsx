import { useCallback, useMemo, useState } from 'react'
import { Alert, Button, Stack } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { getRouteApi, useNavigate, useRouter } from '@tanstack/react-router'
import { AUTHORED_RECORD_STATUS } from '@artificer-toolkit/shared/core'
import type { CharacterBuilderPreviewPayloadDto, CharacterBuilderPayloadDto } from '@artificer-toolkit/schema/api/characters'
import {
  AuthoringFormLayout,
  AuthoringFormProvider,
  InvalidDraftAlert,
  useAppForm,
  useAuthoringFormRegistration,
  type AuthoringFormActionHandlers,
  type AuthoringFormRegistration
} from '#forms'
import {
  useCommitCharacterBuilderMutation,
  useDiscardCharacterDraftMutation,
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

export function CharacterEditPage() {
  const route = getRouteApi('/_authed/characters/$characterId/edit')
  const { draft, draftPayload, response } = route.useLoaderData()
  const { characterId } = route.useParams()

  if (!response && !draftPayload) {
    if (draft) return <InvalidCharacterDraftOnlyState characterId={characterId} />
    return <CharacterNotFoundState />
  }

  const initialPayload = draftPayload ?? response
  if (!initialPayload) return <CharacterNotFoundState />

  const formKey = `character:${characterId}:${draft?.updatedAt ?? initialPayload.character.id}`
  const baseActiveUpdatedAt = draftPayload
    ? draft?.baseActiveUpdatedAt ?? response?.baseActiveUpdatedAt ?? null
    : response?.baseActiveUpdatedAt ?? null

  return (
    <AuthoringFormProvider>
      <CharacterEditAuthoring
        baseActiveUpdatedAt={baseActiveUpdatedAt}
        key={formKey}
        characterId={characterId}
        hasActiveDraft={Boolean(response && draftPayload)}
        hasInvalidDraft={Boolean(draft && !draftPayload)}
        initialPayload={initialPayload}
      />
    </AuthoringFormProvider>
  )
}

function CharacterEditAuthoring({
  baseActiveUpdatedAt,
  characterId,
  hasActiveDraft,
  hasInvalidDraft,
  initialPayload
}: {
  baseActiveUpdatedAt: string | null
  characterId: string
  hasActiveDraft: boolean
  hasInvalidDraft: boolean
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
  const discardDraftMutation = useDiscardCharacterDraftMutation(characterId)
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
          mode: 'edit',
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
    mode: 'edit',
    onResolved: setPayload
  })

  const handleDiscardDraft = useCallback(async () => {
    try {
      await discardDraftMutation.mutateAsync()
      notifications.show({ color: 'green', message: 'Character draft discarded.' })
      await router.invalidate()
    } catch {
      notifications.show({ color: 'red', message: 'Could not discard that character draft yet.' })
    }
  }, [
    discardDraftMutation,
    router
  ])

  const handleSaveDraftConfirmed = useCallback(async () => {
    try {
      await draftMutation.mutateAsync(buildCharacterDraftSaveInput(form.state.values, 'edit', {
        baseActiveUpdatedAt
      }))
      setDraftSaveNoticeAcknowledged(true)
      setDraftSaveNoticeOpened(false)
      notifications.show({ color: 'green', message: 'Character draft saved.' })
      await router.invalidate()
    } catch {
      notifications.show({ color: 'red', message: 'Could not save that character draft yet.' })
    }
  }, [
    baseActiveUpdatedAt,
    draftMutation,
    form,
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
      await draftMutation.mutateAsync(buildCharacterDraftSaveInput(form.state.values, 'edit', {
        baseActiveUpdatedAt
      }))
      const response = await commitMutation.mutateAsync({
        character: normalizeCharacterForCommit(form.state.values),
        mode: 'edit',
        targetStatus: AUTHORED_RECORD_STATUS.ACTIVE,
        baseActiveUpdatedAt
      })
      notifications.show({ color: 'green', message: 'Character finalized.' })
      await router.invalidate()
      await navigate({ to: '/characters/$characterId', params: { characterId: response.character.id } })
    } catch {
      notifications.show({ color: 'red', message: 'Could not finalize that character yet.' })
    }
  }, [
    baseActiveUpdatedAt,
    commitMutation,
    draftMutation,
    form,
    navigate,
    router
  ])

  const registration = useMemo<AuthoringFormRegistration>(() => ({
    activateLabel: 'Finalize Character',
    canSaveDraft: true,
    hasActiveDraft,
    mode: 'edit',
    readOnly: false,
    saveDraftLabel: 'Save Draft',
    subjectKindLabel: 'Character',
    subjectLabel: payload.character.label || 'Untitled Character',
    systemId: payload.character.systemId
  }), [
    hasActiveDraft,
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
      <Stack>
        {hasInvalidDraft
          ? (
              <InvalidDraftAlert
                domainLabel='character'
                isDiscarding={discardDraftMutation.isPending}
                onDiscard={() => void handleDiscardDraft()}
              />
            )
          : null}
        <AuthoringFormLayout>
          <CharacterBuilderRenderer
            form={form}
            payload={payload}
            onResolve={handleResolve}
          />
        </AuthoringFormLayout>
      </Stack>
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

function CharacterNotFoundState() {
  const navigate = useNavigate()

  return (
    <Stack>
      <Alert color='yellow'>That character could not be found.</Alert>
      <Button onClick={() => navigate({ to: '/characters' })}>Back to characters</Button>
    </Stack>
  )
}

function InvalidCharacterDraftOnlyState({ characterId }: { characterId: string }) {
  const navigate = useNavigate()
  const router = useRouter()
  const discardDraftMutation = useDiscardCharacterDraftMutation(characterId)

  async function handleDiscardDraft() {
    try {
      await discardDraftMutation.mutateAsync()
      notifications.show({ color: 'green', message: 'Character draft discarded.' })
      await router.invalidate()
      await navigate({ to: '/characters' })
    } catch {
      notifications.show({ color: 'red', message: 'Could not discard that character draft yet.' })
    }
  }

  return (
    <Stack>
      <InvalidDraftAlert
        domainLabel='character'
        isDiscarding={discardDraftMutation.isPending}
        onDiscard={() => void handleDiscardDraft()}
      />
      <Button onClick={() => navigate({ to: '/characters' })}>Back to characters</Button>
    </Stack>
  )
}
