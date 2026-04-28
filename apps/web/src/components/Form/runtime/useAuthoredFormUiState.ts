import { useState } from 'react'

export type NestedEditorState = {
  path: string
  index?: number
} | null

export type AuthoredFormUiStateOptions = {
  initialSectionId?: string
  readOnly?: boolean
}

export function useAuthoredFormUiState(options: AuthoredFormUiStateOptions = {}) {
  const [activeSectionId, setActiveSectionId] = useState(options.initialSectionId ?? '')
  const [nestedEditor, setNestedEditor] = useState<NestedEditorState>(null)

  return {
    activeSectionId,
    setActiveSectionId,
    nestedEditor,
    openNestedEditor: setNestedEditor,
    closeNestedEditor: () => setNestedEditor(null),
    readOnly: options.readOnly ?? false
  }
}
