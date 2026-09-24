import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Stack } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useNavigate, useRouter } from '@tanstack/react-router'
import type { CharacterBuilderPreviewOutput } from '@artificer-toolkit/schema/api/characterBuilderQueries'
import { useAppForm } from '#forms/app-form/AppForm'
import {
  useAuthoringForm,
  type AuthoringFormActionHandlers
} from '#forms/layout/AuthoringFormContext'
import { InvalidDraftAlert } from '#forms/layout/Editor/SectionRow/InvalidDraftAlert'
import {
  useCommitCharacterBuilderMutation,
  usePreviewCharacterSaveMutation,
  useSaveCharacterDraftMutation
} from '#app/data/characters/mutations'
import { buildCharacterRouteParams } from '#app/routing/authoredRouteParams'
import type { ReadyCharacterBuilderAuthoringSession } from '../state/characterBuilderAuthoringSession'
import {
  buildCharacterDraftSaveInput,
  normalizeCharacterForDraft
} from '../shared/formNormalization'
import { getInactiveAbilityIntentMethodLabels } from '../steps/abilities/abilityGeneration'
import type { CharacterFormValues } from './characterBuilder.types'
import { useLatestCharacterResolution } from '../state/useLatestCharacterResolution'
import { CharacterBuilderStateSync } from '../state/CharacterBuilderStateSync'
import { CharacterBuilderRenderer } from './CharacterBuilderRenderer'
import { CharacterDraftSaveNoticeModal } from '../save/CharacterDraftSaveNoticeModal'
import { CharacterSavePreviewModal } from '../save/CharacterSavePreviewModal'

export function CharacterBuilderFormRuntime({
  isDiscardingDraft,
  onCancel,
  onDiscardDraft,
  session
}: {
  isDiscardingDraft: boolean
  onCancel: () => Promise<void>
  onDiscardDraft: () => Promise<void>
  session: ReadyCharacterBuilderAuthoringSession
}) {
  const router = useRouter()
  const navigate = useNavigate()
  const [payload, setPayload] = useState(session.payload)
  const [draftSaveNoticeOpened, setDraftSaveNoticeOpened] = useState(false)
  const [draftSaveNoticeAcknowledged, setDraftSaveNoticeAcknowledged] = useState(false)
  const [draftSaveNoticeMethodLabels, setDraftSaveNoticeMethodLabels] = useState<string[]>([])
  const [preview, setPreview] = useState<CharacterBuilderPreviewOutput | null>(null)
  const [previewOpened, setPreviewOpened] = useState(false)
  const draftMutation = useSaveCharacterDraftMutation()
  const previewMutation = usePreviewCharacterSaveMutation()
  const commitMutation = useCommitCharacterBuilderMutation()
  const { updateAuthoringFormActions, updateAuthoringFormState } = useAuthoringForm()

  const handlePreviewFinalize = useCallback(
    async (value: CharacterFormValues) => {
      try {
        const nextPreview = await previewMutation.mutateAsync({
          character: normalizeCharacterForDraft(value),
          expectedDraftId: session.draft.id,
          mode: session.mode
        })
        setPreview(nextPreview)
        setPreviewOpened(true)
      } catch {
        notifications.show({
          color: 'red',
          message: 'This character is not ready to finalize yet.'
        })
      }
    },
    [previewMutation, session.draft.id, session.mode]
  )

  const defaultValuesRef = useRef(session.initialValues)
  const form = useAppForm({
    defaultValues: defaultValuesRef.current,
    onSubmit: async ({ value }) => {
      await handlePreviewFinalize(value)
    }
  })

  const handleResolve = useLatestCharacterResolution({
    expectedDraftId: session.draft.id,
    mode: session.mode,
    onResolved: setPayload
  })

  const handleSaveDraftConfirmed = useCallback(async () => {
    try {
      const savedValues = form.state.values
      const draft = await draftMutation.mutateAsync(
        buildCharacterDraftSaveInput(savedValues, session.mode, session.draft.id)
      )
      if (form.state.values === savedValues) {
        defaultValuesRef.current = savedValues
        form.reset(savedValues)
      }
      setDraftSaveNoticeAcknowledged(true)
      setDraftSaveNoticeOpened(false)
      notifications.show({ color: 'green', message: 'Character draft saved.' })
      await router.invalidate()
      if (session.mode === 'create') {
        await navigate({
          params: buildCharacterRouteParams(draft.publicId, draft.label),
          to: '/characters/$characterPublicId/$characterSlug/edit'
        })
      }
    } catch {
      notifications.show({ color: 'red', message: 'Could not save that character draft yet.' })
    }
  }, [draftMutation, form, navigate, router, session.draft.id, session.mode])

  const handleSaveDraft = useCallback(async () => {
    const inactiveAbilityMethodLabels = getInactiveAbilityIntentMethodLabels(form.state.values)
    if (!draftSaveNoticeAcknowledged && inactiveAbilityMethodLabels.length > 0) {
      setDraftSaveNoticeMethodLabels(inactiveAbilityMethodLabels)
      setDraftSaveNoticeOpened(true)
      return
    }

    await handleSaveDraftConfirmed()
  }, [draftSaveNoticeAcknowledged, form, handleSaveDraftConfirmed])

  const handleConfirmFinalize = useCallback(async () => {
    if (!preview) return
    try {
      const response = await commitMutation.mutateAsync({
        character: preview.character,
        expectedDraftId: session.draft.id,
        mode: session.mode
      })
      notifications.show({ color: 'green', message: 'Character finalized.' })
      await navigate({
        params: buildCharacterRouteParams(response.publicId, response.character.label),
        to: '/characters/$characterPublicId/$characterSlug'
      })
    } catch {
      notifications.show({
        color: 'red',
        message: 'Could not finalize the character. Try again, or save the draft and reload.'
      })
    }
  }, [commitMutation, navigate, preview, session.draft.id, session.mode])

  const handleActivate = useCallback(async () => {
    if (!payload.view.review.ready) {
      notifications.show({
        color: 'red',
        message: 'This character is not ready to finalize yet.'
      })
      return
    }

    await handlePreviewFinalize(form.state.values)
  }, [form, handlePreviewFinalize, payload.view.review.ready])

  const actions = useMemo<AuthoringFormActionHandlers>(
    () => ({
      onActivate: handleActivate,
      onCancel,
      onDiscardDraft,
      onDelete: onDiscardDraft,
      onResetForm: () => form.reset(),
      onSaveDraft: handleSaveDraft
    }),
    [form, handleActivate, handleSaveDraft, onCancel, onDiscardDraft]
  )

  useEffect(() => {
    updateAuthoringFormActions(actions)
  }, [actions, updateAuthoringFormActions])

  return (
    <form.AppForm>
      <form.Subscribe
        selector={(state) => ({
          canSubmit: state.canSubmit,
          hasChanges: state.isDirty,
          isSubmitting: state.isSubmitting,
          subjectLabel: state.values.label
        })}
      >
        {(formState) => (
          <CharacterBuilderStateSync
            canSubmit={formState.canSubmit}
            hasChanges={formState.hasChanges}
            isSubmitting={
              formState.isSubmitting ||
              draftMutation.isPending ||
              previewMutation.isPending ||
              commitMutation.isPending
            }
            payload={payload}
            session={session}
            subjectLabel={formState.subjectLabel}
            updateAuthoringFormState={updateAuthoringFormState}
          />
        )}
      </form.Subscribe>
      <Stack>
        {session.hasInvalidDraft ? (
          <InvalidDraftAlert
            domainLabel='character'
            isDiscarding={isDiscardingDraft}
            onDiscard={() => void onDiscardDraft()}
          />
        ) : null}
        <CharacterBuilderRenderer form={form} payload={payload} onResolve={handleResolve} />
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
