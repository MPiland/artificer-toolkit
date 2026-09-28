import { useEffect, useMemo } from 'react'
import type { CharacterBuilderPayloadDto } from '@artificer-toolkit/schema/api/characterBuilder'
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
  /** Null until the first browser evaluation. */
  payload: CharacterBuilderPayloadDto | null
  session: ReadyCharacterBuilderAuthoringSession
  subjectLabel: string
  updateAuthoringFormState: (patch: AuthoringFormStatePatch) => void
}) {
  const ready = payload?.view.review.ready ?? false
  const statePatch = useMemo<AuthoringFormStatePatch>(
    () => ({
      activateLabel: 'Activate',
      canFinalize: ready,
      canResetForm: hasChanges,
      canDelete: true,
      canSaveDraft: true,
      canSubmit: canSubmit && ready,
      hasActiveDraft: session.hasActiveDraft,
      hasChanges,
      isDraft: session.isDraft,
      isSubmitting,
      mode: session.mode,
      readOnly: session.readOnly,
      deleteLabel: 'Discard draft',
      saveDraftLabel: 'Save Draft',
      subjectKindLabel: session.subjectKindLabel,
      subjectLabel: subjectLabel.trim() || session.subjectLabel,
      systemId: session.draft.systemId
    }),
    [
      canSubmit,
      hasChanges,
      isSubmitting,
      ready,
      session.hasActiveDraft,
      session.isDraft,
      session.mode,
      session.readOnly,
      session.subjectKindLabel,
      session.draft.systemId,
      session.subjectLabel,
      subjectLabel
    ]
  )

  useEffect(() => {
    updateAuthoringFormState(statePatch)
  }, [statePatch, updateAuthoringFormState])

  return null
}
