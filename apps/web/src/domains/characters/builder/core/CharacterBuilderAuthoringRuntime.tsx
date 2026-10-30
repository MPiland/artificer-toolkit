import { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert, Button, Stack, Text } from '@mantine/core'
import { SystemChoiceAlert } from '#forms/layout/SystemChoiceAlert'
import { notifications } from '@mantine/notifications'
import { useNavigate, useRouter } from '@tanstack/react-router'
import {
  useAuthoringActions,
  useAuthoringSession,
  type AuthoringFormActionHandlers,
  type AuthoringFormStatePatch
} from '#forms/layout/AuthoringFormContext'
import {
  useCreateCharacterDraftMutation,
  useDiscardCharacterDraftMutation
} from '#app/data/characters/mutations'
import { buildCharacterRouteParams } from '#app/routing/authoredRouteParams'
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
  const discardDraftMutation = useDiscardCharacterDraftMutation()
  const { mutateAsync: createDraft } = useCreateCharacterDraftMutation()
  const [newCharacterId] = useState(() => crypto.randomUUID())
  const [openAttempt, setOpenAttempt] = useState(0)
  const [failedAttempt, setFailedAttempt] = useState<number>()
  const draftOpenFailed = failedAttempt === openAttempt
  const { cancelHref } = useAuthoringSession()
  const { updateAuthoringFormActions, updateAuthoringFormState } = useAuthoringActions()

  useEffect(() => {
    if (session.draft || session.notFound || !session.systemId) return
    let current = true
    // Opening is a mounted-client operation, never an SSR or preload mutation.
    void createDraft({ id: session.characterId ?? newCharacterId, systemId: session.systemId })
      .then(async (draft) => {
        if (!current) return
        if (!session.characterId) {
          await navigate({
            params: buildCharacterRouteParams(draft.publicId, draft.label),
            replace: true,
            to: '/characters/$characterPublicId/$characterSlug/edit'
          })
        } else {
          await router.invalidate()
        }
      })
      .catch(() => {
        if (current) setFailedAttempt(openAttempt)
      })
    return () => {
      current = false
    }
  }, [
    createDraft,
    navigate,
    newCharacterId,
    openAttempt,
    router,
    session.characterId,
    session.draft,
    session.notFound,
    session.systemId
  ])

  const handleCancel = useCallback(async () => {
    await navigate({ to: cancelHref ?? '/characters' })
  }, [cancelHref, navigate])

  const handleDiscardDraft = useCallback(async () => {
    const draft = session.draft
    if (!draft) return

    try {
      await discardDraftMutation.mutateAsync({ id: draft.characterId, expectedDraftId: draft.id })
      notifications.show({ color: 'green', message: 'Character draft discarded.' })
      if (draft.draftState === 'DRAFT_ONLY') {
        await navigate({ to: '/characters' })
      } else {
        await navigate({
          params: buildCharacterRouteParams(draft.publicId, session.subjectLabel),
          to: '/characters/$characterPublicId/$characterSlug'
        })
      }
    } catch {
      notifications.show({ color: 'red', message: 'Could not discard that character draft yet.' })
    }
  }, [discardDraftMutation, navigate, session.draft, session.subjectLabel])

  const statePatch = useMemo<AuthoringFormStatePatch>(
    () => ({
      activateLabel: 'Activate',
      canSaveDraft: Boolean(session.draft),
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
      session.draft,
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
        <SystemChoiceAlert subjectPlural='characters' systems={session.systems} />
        <Button onClick={() => void handleCancel()}>Back to characters</Button>
      </Stack>
    )
  }

  if (!session.draft && !session.notFound) {
    return (
      <Stack>
        {draftOpenFailed ? (
          <>
            <Alert color='red'>Could not open that character draft.</Alert>
            <Button onClick={() => setOpenAttempt((attempt) => attempt + 1)}>Try again</Button>
          </>
        ) : (
          <Text role='status'>Opening character draft…</Text>
        )}
        <Button variant='default' onClick={() => void handleCancel()}>
          Back to characters
        </Button>
      </Stack>
    )
  }

  if (session.notFound || !session.draft || !session.initialValues) {
    return (
      <Stack>
        <Alert color='yellow'>That character could not be found.</Alert>
        <Button onClick={() => void handleCancel()}>Back to characters</Button>
      </Stack>
    )
  }

  const readySession: ReadyCharacterBuilderAuthoringSession = {
    ...session,
    draft: session.draft,
    initialValues: session.initialValues
  }

  return (
    <CharacterBuilderFormRuntime
      key={session.formKey}
      session={readySession}
      onCancel={handleCancel}
      onDiscardDraft={handleDiscardDraft}
    />
  )
}
