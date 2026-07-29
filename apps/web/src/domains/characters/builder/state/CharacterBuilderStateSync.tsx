import { useEffect, useMemo } from 'react'
import type { AuthoringFormStatePatch } from '#forms/layout/AuthoringFormContext'
import type { ReadyCharacterBuilderAuthoringSession } from './characterBuilderAuthoringSession'

export function CharacterBuilderStateSync({
  canSubmit,
  hasChanges,
  isSubmitting,
  payload,
  session,
  subjectLabel,
  updateAuthoringFormState
}: {
  canSubmit: boolean
  hasChanges: boolean
  isSubmitting: boolean
  payload: ReadyCharacterBuilderAuthoringSession['payload']
  session: ReadyCharacterBuilderAuthoringSession
  subjectLabel: string
  updateAuthoringFormState: (patch: AuthoringFormStatePatch) => void
}) {
  const statePatch = useMemo<AuthoringFormStatePatch>(
    () => ({
      activateLabel: 'Activate',
      canFinalize: payload.view.review.ready,
      canResetForm: hasChanges,
      canSaveDraft: true,
      canSubmit: canSubmit && payload.view.review.ready,
      hasActiveDraft: session.hasActiveDraft,
      hasChanges,
      isDraft: session.isDraft,
      isSubmitting,
      mode: session.mode,
      readOnly: session.readOnly,
      saveDraftLabel: 'Save Draft',
      subjectKindLabel: session.subjectKindLabel,
      subjectLabel: subjectLabel.trim() || session.subjectLabel,
      systemId: payload.character.systemId
    }),
    [
      canSubmit,
      hasChanges,
      isSubmitting,
      payload.character.systemId,
      payload.view.review.ready,
      session.hasActiveDraft,
      session.isDraft,
      session.mode,
      session.readOnly,
      session.subjectKindLabel,
      session.subjectLabel,
      subjectLabel
    ]
  )

  useEffect(() => {
    updateAuthoringFormState(statePatch)
  }, [statePatch, updateAuthoringFormState])

  return null
}
