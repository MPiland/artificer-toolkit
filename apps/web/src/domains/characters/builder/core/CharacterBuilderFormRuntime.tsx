import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Stack } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { ConvexError } from 'convex/values'
import { useNavigate, useRouterState } from '@tanstack/react-router'
import { useMutation } from '@tanstack/react-query'
import type { CharacterBuilderPayloadDto } from '@artificer-toolkit/schema/api/characterBuilder'
import { characterDraftSaveErrorDataSchema } from '@artificer-toolkit/schema/api/characterDrafts'
import type {
  CharacterBuilderFeatureSourceHint,
  CharacterBuilderPreviewOutput
} from '@artificer-toolkit/schema/api/characterBuilderQueries'
import { useAppForm } from '#forms/app-form/AppForm'
import { readAuthoringStep } from '#forms/layout/authoringSearch'
import {
  useAuthoringActions,
  useAuthoringNavigation,
  type AuthoringFormActionHandlers
} from '#forms/layout/AuthoringFormContext'
import {
  useCommitCharacterBuilderMutation,
  useSaveCharacterDraftMutation
} from '#app/data/characters/mutations'
import { buildCharacterRouteParams } from '#app/routing/authoredRouteParams'
import type { ReadyCharacterBuilderAuthoringSession } from '../state/characterBuilderAuthoringSession'
import { buildCharacterDraftSaveInput } from '../shared/formNormalization'
import { getInactiveAbilityIntentMethodLabels } from '../steps/abilities/abilityGeneration'
import type { CharacterFormValues } from './characterBuilder.types'
import { useLatestCharacterResolution } from '../state/useLatestCharacterResolution'
import { useCharacterBuilderEvaluation } from '../state/useCharacterBuilderEvaluation'
import { CharacterBuilderContentNotice } from '../evaluation/CharacterBuilderContentNotice'
import { CharacterBuilderStateSync } from '../state/CharacterBuilderStateSync'
import { CharacterBuilderRenderer } from './CharacterBuilderRenderer'
import { createDraftAutosave } from '../save/draftAutosave'
import { CharacterDraftSaveNoticeModal } from '../save/CharacterDraftSaveNoticeModal'
import { CharacterSavePreviewModal } from '../save/CharacterSavePreviewModal'

export function CharacterBuilderFormRuntime({
  onCancel,
  onDiscardDraft,
  session
}: {
  onCancel: () => Promise<void>
  onDiscardDraft: () => Promise<void>
  session: ReadyCharacterBuilderAuthoringSession
}) {
  const navigate = useNavigate()
  // Null until the first evaluation in the browser; nothing is evaluated during SSR (ADR 0036 S6).
  const [payload, setPayload] = useState<CharacterBuilderPayloadDto | null>(null)
  const [draftSaveNoticeOpened, setDraftSaveNoticeOpened] = useState(false)
  const [draftSaveNoticeAcknowledged, setDraftSaveNoticeAcknowledged] = useState(false)
  const [draftSaveNoticeMethodLabels, setDraftSaveNoticeMethodLabels] = useState<string[]>([])
  const [finalization, setFinalization] = useState<{
    preview: CharacterBuilderPreviewOutput
    featureSourceHints: CharacterBuilderFeatureSourceHint[]
  } | null>(null)
  const preview = finalization?.preview ?? null
  const [previewOpened, setPreviewOpened] = useState(false)
  const { mutateAsync: saveDraft } = useSaveCharacterDraftMutation()
  const evaluation = useCharacterBuilderEvaluation(session)
  const previewMutation = useMutation({ mutationFn: evaluation.preview })
  const commitMutation = useCommitCharacterBuilderMutation()
  const { updateAuthoringFormActions, updateAuthoringFormState } = useAuthoringActions()
  const { activeStepId, goToStep } = useAuthoringNavigation()

  const handlePreviewFinalize = useCallback(
    async (value: CharacterFormValues) => {
      try {
        setFinalization(await previewMutation.mutateAsync(value))
        setPreviewOpened(true)
      } catch {
        notifications.show({
          color: 'red',
          message: 'This character is not ready to finalize yet.'
        })
      }
    },
    [previewMutation]
  )

  const [baselineValues, setBaselineValues] = useState(session.initialValues)
  const form = useAppForm({
    defaultValues: baselineValues,
    onSubmit: async ({ value }) => {
      await handlePreviewFinalize(value)
    }
  })

  // One autosave per draft generation; the runtime is keyed by it (ADR 0036 S8).
  const [autosave] = useState(() =>
    createDraftAutosave<CharacterFormValues>({
      save: async (values) => {
        try {
          await saveDraft(buildCharacterDraftSaveInput(values, session.mode, session.draft.id))
        } catch (error) {
          if (
            !(error instanceof ConvexError) ||
            !characterDraftSaveErrorDataSchema.safeParse(error.data).success
          )
            throw error
          notifications.show({
            color: 'red',
            message:
              'This draft was finalized, discarded or reopened elsewhere. Reload to keep editing.'
          })
          return 'replaced'
        }
        // Saved values become the form's baseline unless the user edited meanwhile.
        if (form.state.values === values) {
          setBaselineValues(values)
          form.reset(values)
        }
        return 'saved'
      },
      onStatus: (draftSaveStatus) => updateAuthoringFormState({ draftSaveStatus })
    })
  )
  const autosaveEffectGeneration = useRef(0)

  useEffect(() => {
    const generation = ++autosaveEffectGeneration.current
    let queued = form.state.values
    const subscription = form.store.subscribe(() => {
      const values = form.state.values
      if (values === queued) return
      queued = values
      autosave.change(values)
    })
    // Best effort: the save may not reach the server before the page is gone.
    const flushOnHide = () => void autosave.flush()
    window.addEventListener('pagehide', flushOnHide)
    return () => {
      subscription.unsubscribe()
      window.removeEventListener('pagehide', flushOnHide)
      void autosave.flush().finally(() => {
        // Effect replay reuses this draft's autosave; only a final unmount cancels it.
        if (autosaveEffectGeneration.current === generation) autosave.cancel()
      })
    }
  }, [autosave, form])

  // A step change saves at once.
  useEffect(() => {
    void autosave.flush()
  }, [activeStepId, autosave])

  const handleResolve = useLatestCharacterResolution({
    generation: `${session.draft.id}:${session.mode}`,
    resolve: evaluation.resolve,
    onResolved: setPayload
  })

  // The first ready local evaluation, and each content change after it, re-resolves current values.
  useEffect(() => {
    void handleResolve(form.state.values)
  }, [form, handleResolve])

  // Open on the recommended step once, unless the URL named a step or the user already chose one.
  const urlStepId = useRouterState({ select: (state) => readAuthoringStep(state.location.search) })
  const openedStepRef = useRef({ activeStepId, handled: false })
  const recommendedStepId = payload?.resolution.recommendedSectionId
  useEffect(() => {
    const opened = openedStepRef.current
    if (!recommendedStepId || opened.handled) return
    opened.handled = true
    if (
      urlStepId === undefined &&
      activeStepId === opened.activeStepId &&
      activeStepId !== recommendedStepId
    )
      goToStep(recommendedStepId)
  }, [activeStepId, goToStep, recommendedStepId, urlStepId])

  const handleSaveDraftConfirmed = useCallback(async () => {
    setDraftSaveNoticeAcknowledged(true)
    setDraftSaveNoticeOpened(false)
    await autosave.flush()
  }, [autosave])

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
    if (!finalization) return
    try {
      const response = await commitMutation.mutateAsync({
        character: finalization.preview.character,
        expectedDraftId: session.draft.id,
        mode: session.mode,
        featureSourceHints: finalization.featureSourceHints
      })
      // The committed draft is gone; nothing is left to autosave.
      autosave.cancel()
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
  }, [autosave, commitMutation, finalization, navigate, session.draft.id, session.mode])

  const handleActivate = useCallback(async () => {
    if (!payload?.view.review.ready) {
      notifications.show({
        color: 'red',
        message: 'This character is not ready to finalize yet.'
      })
      return
    }

    await handlePreviewFinalize(form.state.values)
  }, [form, handlePreviewFinalize, payload])

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
              formState.isSubmitting || previewMutation.isPending || commitMutation.isPending
            }
            payload={payload}
            session={session}
            subjectLabel={formState.subjectLabel}
            updateAuthoringFormState={updateAuthoringFormState}
          />
        )}
      </form.Subscribe>
      <Stack>
        <CharacterBuilderContentNotice
          status={evaluation.status}
          onRetry={() => {
            evaluation.refetchInputs()
            void handleResolve(form.state.values)
          }}
        />
        {payload ? (
          <CharacterBuilderRenderer form={form} payload={payload} onResolve={handleResolve} />
        ) : null}
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
        opened={draftSaveNoticeOpened}
        onClose={() => setDraftSaveNoticeOpened(false)}
        onConfirm={() => void handleSaveDraftConfirmed()}
      />
    </form.AppForm>
  )
}
