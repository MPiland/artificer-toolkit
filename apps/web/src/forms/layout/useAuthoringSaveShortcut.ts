import { useEffect } from 'react'
import { useAuthoringForm } from './AuthoringFormContext'

export function useAuthoringSaveShortcut() {
  const {
    canSaveDraft,
    hasChanges,
    isSubmitting,
    readOnly,
    saveDraft,
    stagedEditorOpen
  } = useAuthoringForm()

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
  }, [
    canSaveDraft,
    hasChanges,
    isSubmitting,
    readOnly,
    saveDraft,
    stagedEditorOpen
  ])
}
