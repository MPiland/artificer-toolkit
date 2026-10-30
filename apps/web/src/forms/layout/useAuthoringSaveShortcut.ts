import { useEffect } from 'react'
import {
  useAuthoringActions,
  useAuthoringSession,
  useAuthoringStagedEditor
} from './AuthoringFormContext'
import { useAuthoringFormStatus } from './useAuthoringFormStatus'

export function useAuthoringSaveShortcut() {
  const { canSaveDraft, readOnly } = useAuthoringSession()
  const { saveDraft } = useAuthoringActions()
  const { hasChanges, isSubmitting } = useAuthoringFormStatus()
  const stagedEditorOpen = Boolean(useAuthoringStagedEditor().groupEditor)

  useEffect(() => {
    if (readOnly || !canSaveDraft) return

    const handleSaveShortcut = (event: KeyboardEvent) => {
      if (
        event.repeat ||
        event.altKey ||
        event.shiftKey ||
        (!event.ctrlKey && !event.metaKey) ||
        event.key.toLowerCase() !== 's'
      ) {
        return
      }

      event.preventDefault()
      if (!hasChanges || isSubmitting || stagedEditorOpen) return
      void saveDraft()
    }

    window.addEventListener('keydown', handleSaveShortcut)
    return () => window.removeEventListener('keydown', handleSaveShortcut)
  }, [canSaveDraft, hasChanges, isSubmitting, readOnly, saveDraft, stagedEditorOpen])
}
