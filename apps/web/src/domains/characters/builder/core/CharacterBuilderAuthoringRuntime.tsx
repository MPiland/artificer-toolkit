import { useCallback, useEffect, useMemo } from 'react'
import { Alert, Button, Stack } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useNavigate, useRouter } from '@tanstack/react-router'
import {
  useAuthoringForm,
  type AuthoringFormActionHandlers,
  type AuthoringFormStatePatch
} from '#forms/layout/AuthoringFormContext'
import { InvalidDraftAlert } from '#forms/layout/Editor/SectionRow/InvalidDraftAlert'
import { useDiscardCharacterDraftMutation } from '#app/data/characters/mutations'
import type {
  CharacterBuilderAuthoringSession,
  ReadyCharacterBuilderAuthoringSession
} from '../state/characterBuilderAuthoringSession'
import { CharacterBuilderFormRuntime } from './CharacterBuilderFormRuntime'

export function CharacterBuilderAuthoringRuntime({
  session
}: {
  session: CharacterBuilderAuthoringSession
}) {
  const navigate = useNavigate()
  const router = useRouter()
  const discardDraftMutation = useDiscardCharacterDraftMutation(
    session.characterId ?? 'missing-character'
  )
  const { cancelHref, updateAuthoringFormActions, updateAuthoringFormState } = useAuthoringForm()

  const handleCancel = useCallback(async () => {
    await navigate({ to: cancelHref ?? '/characters' })
  }, [cancelHref, navigate])

  const handleDiscardDraft = useCallback(async () => {
    if (!session.characterId) return

    try {
      await discardDraftMutation.mutateAsync()
      notifications.show({ color: 'green', message: 'Character draft discarded.' })
      await router.invalidate()
      if (session.invalidDraftOnly) {
        await navigate({ to: '/characters' })
      }
    } catch {
      notifications.show({ color: 'red', message: 'Could not discard that character draft yet.' })
    }
  }, [discardDraftMutation, navigate, router, session.characterId, session.invalidDraftOnly])

  const statePatch = useMemo<AuthoringFormStatePatch>(
    () => ({
      activateLabel: 'Activate',
      canSaveDraft: Boolean(session.payload),
      hasActiveDraft: session.hasActiveDraft,
      isDraft: session.isDraft,
      mode: session.mode,
      readOnly: session.readOnly,
      saveDraftLabel: 'Save Draft',
      subjectKindLabel: session.subjectKindLabel,
      subjectLabel: session.subjectLabel,
      systemId: session.systemId
    }),
    [
      session.hasActiveDraft,
      session.isDraft,
      session.mode,
      session.payload,
      session.readOnly,
      session.subjectKindLabel,
      session.subjectLabel,
      session.systemId
    ]
  )

  const actions = useMemo<AuthoringFormActionHandlers>(
    () => ({
      onCancel: handleCancel,
      onDiscardDraft: handleDiscardDraft
    }),
    [handleCancel, handleDiscardDraft]
  )

  useEffect(() => {
    updateAuthoringFormState(statePatch)
  }, [statePatch, updateAuthoringFormState])

  useEffect(() => {
    updateAuthoringFormActions(actions)
  }, [actions, updateAuthoringFormActions])

  if (session.systemRequired) {
    return (
      <Stack>
        <Alert color='yellow'>A system is required before creating characters.</Alert>
        <Button onClick={() => void handleCancel()}>Back to characters</Button>
      </Stack>
    )
  }

  if (session.invalidDraftOnly) {
    return (
      <Stack>
        <InvalidDraftAlert
          domainLabel='character'
          isDiscarding={discardDraftMutation.isPending}
          onDiscard={() => void handleDiscardDraft()}
        />
        <Button onClick={() => void handleCancel()}>Back to characters</Button>
      </Stack>
    )
  }

  if (session.notFound || !session.payload || !session.initialValues) {
    return (
      <Stack>
        <Alert color='yellow'>That character could not be found.</Alert>
        <Button onClick={() => void handleCancel()}>Back to characters</Button>
      </Stack>
    )
  }

  const readySession: ReadyCharacterBuilderAuthoringSession = {
    ...session,
    initialValues: session.initialValues,
    payload: session.payload
  }

  return (
    <CharacterBuilderFormRuntime
      key={session.formKey}
      session={readySession}
      onCancel={handleCancel}
      onDiscardDraft={handleDiscardDraft}
      isDiscardingDraft={discardDraftMutation.isPending}
    />
  )
}
