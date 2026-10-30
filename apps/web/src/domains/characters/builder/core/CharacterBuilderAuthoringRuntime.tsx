import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Alert, Button, Stack, Text } from '@mantine/core'
import { SystemChoiceAlert } from '#forms/layout/SystemChoiceAlert'
import { notifications } from '@mantine/notifications'
import { useNavigate, useRouter } from '@tanstack/react-router'
import type { AuthoringHostedForm } from '#forms/layout/AuthoringFormContext'
import { AuthoringFormProvider } from '#forms/layout/AuthoringFormProvider'
import { AuthoringLayoutShell } from '#forms/layout/AuthoringLayout'
import {
  AuthoringPanelsProvider,
  AuthoringPreviewProvider
} from '#forms/layout/AuthoringPanelsProvider'
import { useShellReturnHref } from '#app/shell/returnLocation'
import {
  useCreateCharacterDraftMutation,
  useDiscardCharacterDraftMutation
} from '#app/data/characters/mutations'
import { buildCharacterRouteParams } from '#app/routing/authoredRouteParams'
import {
  createCharacterBuilderAuthoringSession,
  type CharacterBuilderRouteMode,
  type ReadyCharacterBuilderAuthoringSession
} from '../state/characterBuilderAuthoringSession'
import { characterBuilderVisibleSteps } from '../state/characterBuilderAuthoringState'
import { CharacterBuilderFormRuntime } from './CharacterBuilderFormRuntime'
import {
  CHARACTER_BUILDER_TIMING_MARK,
  markCharacterBuilderTiming,
  startCharacterBuilderTiming
} from './characterBuilder.performance'

// Steps show before the draft opens; progress arrives with the first browser evaluation (ADR 0036 S6).
const OPENING_NAVIGATION: AuthoringHostedForm['navigation'] = {
  isComplete: false,
  progressSummary: undefined,
  stepStatuses: {},
  visibleSteps: characterBuilderVisibleSteps
}
const OPENING_STATUS: AuthoringHostedForm['status'] = {
  canFinalize: false,
  canResetForm: false,
  canResetStep: false,
  canSubmit: false,
  hasChanges: false,
  hasStepChanges: false,
  isSubmitting: false
}

/** The Character Builder route: opens the draft, then hands the form to the form runtime. */
export function CharacterBuilderAuthoringRuntime({
  data,
  mode
}: {
  data: unknown
  mode: CharacterBuilderRouteMode
}) {
  const session = useMemo(
    () => createCharacterBuilderAuthoringSession({ data, mode }),
    [data, mode]
  )
  const navigate = useNavigate()
  const router = useRouter()
  const discardDraftMutation = useDiscardCharacterDraftMutation()
  const { mutateAsync: createDraft } = useCreateCharacterDraftMutation()
  const [newCharacterId] = useState(() => crypto.randomUUID())
  const [openAttempt, setOpenAttempt] = useState(0)
  const [failedAttempt, setFailedAttempt] = useState<number>()
  const draftOpenFailed = failedAttempt === openAttempt
  const cancelHref = useShellReturnHref() ?? '/characters'
  const markedRailFormKeyRef = useRef<string | undefined>(undefined)

  useEffect(() => {
    if (markedRailFormKeyRef.current === session.formKey) return
    markCharacterBuilderTiming(CHARACTER_BUILDER_TIMING_MARK.HYDRATION_COMPLETED)
    markCharacterBuilderTiming(CHARACTER_BUILDER_TIMING_MARK.BUILDER_RAIL_COMMITTED)
    markedRailFormKeyRef.current = session.formKey
  }, [session.formKey])

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
    await navigate({ to: cancelHref })
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

  const openingForm = useMemo<AuthoringHostedForm>(
    () => ({
      actions: { onDiscardDraft: handleDiscardDraft },
      cancelHref,
      labels: {
        activateLabel: 'Activate',
        canDelete: false,
        canSaveDraft: false,
        deleteLabel: 'Discard draft',
        hasActiveDraft: session.hasActiveDraft,
        isDraft: session.isDraft,
        mode: session.mode,
        readOnly: session.readOnly,
        saveDraftLabel: 'Save Draft',
        subjectKindLabel: session.subjectKindLabel,
        subjectLabel: session.subjectLabel,
        systemId: session.systemId
      },
      navigation: OPENING_NAVIGATION,
      onStepIntent: () =>
        startCharacterBuilderTiming(CHARACTER_BUILDER_TIMING_MARK.STEP_NAVIGATION_INTENT),
      status: OPENING_STATUS
    }),
    [
      cancelHref,
      handleDiscardDraft,
      session.hasActiveDraft,
      session.isDraft,
      session.mode,
      session.readOnly,
      session.subjectKindLabel,
      session.subjectLabel,
      session.systemId
    ]
  )

  const readySession: ReadyCharacterBuilderAuthoringSession | null =
    session.draft && session.initialValues && !session.notFound && !session.systemRequired
      ? { ...session, draft: session.draft, initialValues: session.initialValues }
      : null

  // Panels sit above the form runtime: its hooks need a draft, so it mounts once one opens.
  return (
    <AuthoringPanelsProvider>
      <AuthoringPreviewProvider>
        {readySession ? (
          <CharacterBuilderFormRuntime
            key={readySession.formKey}
            cancelHref={cancelHref}
            session={readySession}
            onDiscardDraft={handleDiscardDraft}
          />
        ) : (
          <AuthoringFormProvider hostedForm={openingForm}>
            <AuthoringLayoutShell>
              {session.systemRequired ? (
                <Stack>
                  <SystemChoiceAlert subjectPlural='characters' systems={session.systems} />
                  <Button onClick={() => void handleCancel()}>Back to characters</Button>
                </Stack>
              ) : !session.draft && !session.notFound ? (
                <Stack>
                  {draftOpenFailed ? (
                    <>
                      <Alert color='red'>Could not open that character draft.</Alert>
                      <Button onClick={() => setOpenAttempt((attempt) => attempt + 1)}>
                        Try again
                      </Button>
                    </>
                  ) : (
                    <Text role='status'>Opening character draft…</Text>
                  )}
                  <Button variant='default' onClick={() => void handleCancel()}>
                    Back to characters
                  </Button>
                </Stack>
              ) : (
                <Stack>
                  <Alert color='yellow'>That character could not be found.</Alert>
                  <Button onClick={() => void handleCancel()}>Back to characters</Button>
                </Stack>
              )}
            </AuthoringLayoutShell>
          </AuthoringFormProvider>
        )}
      </AuthoringPreviewProvider>
    </AuthoringPanelsProvider>
  )
}
