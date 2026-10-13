import { useRef, useState } from 'react'

import { cleanSheetEditorText } from './inspector.model'

/**
 * Owns what every Sheet adjustment editor shares: the source note, the save/clear flow and the
 * restore-on-failure behaviour. `Draft` is the control state, `Value` the committed adjustment value.
 * State starts from the editor once; the parent remounts the editor with `getSheetEditorKey` when the
 * committed adjustment changes.
 */
export function useSheetAdjustmentDraft<Draft, Value>({
  editor,
  toDraft,
  isEmpty,
  parse,
  onClear,
  onCommit
}: {
  editor: { adjustmentId?: string; sourceNote?: string; value: Value | null }
  /** The control state for a server value; `null` yields the empty draft. */
  toDraft: (value: Value | null) => Draft
  isEmpty: (draft: Draft) => boolean
  /** The committed value for a draft, or `null` when the draft is not a valid value. */
  parse: (draft: Draft) => Value | null
  onClear: () => Promise<boolean>
  onCommit: (commit: { value: Value; sourceNote?: string }) => Promise<boolean>
}) {
  const [draft, setDraft] = useState(() => toDraft(editor.value))
  const [sourceNote, setSourceNote] = useState(editor.sourceNote ?? '')
  const [error, setError] = useState<string | undefined>(undefined)
  const lastSubmitted = useRef<string | undefined>(undefined)

  function restoreServerValue() {
    setDraft(toDraft(editor.value))
    setSourceNote(editor.sourceNote ?? '')
  }

  async function clear() {
    if (!editor.adjustmentId) {
      setDraft(toDraft(null))
      return
    }
    const succeeded = await onClear()
    if (!succeeded) {
      restoreServerValue()
      setError('The adjustment could not be cleared. The server value was restored.')
    }
  }

  async function commit(nextDraft: Draft = draft) {
    if (isEmpty(nextDraft)) {
      await clear()
      return
    }
    const value = parse(nextDraft)
    if (value === null) {
      setError('Enter a valid number.')
      return
    }
    const note = cleanSheetEditorText(sourceNote)
    const payload = { value, ...(note ? { sourceNote: note } : {}) }
    const signature = JSON.stringify(payload)
    if (signature === lastSubmitted.current) return
    lastSubmitted.current = signature
    setError(undefined)
    const succeeded = await onCommit(payload)
    if (!succeeded) {
      lastSubmitted.current = undefined
      restoreServerValue()
      setError('The adjustment could not be saved. The server value was restored.')
    }
  }

  return { draft, setDraft, sourceNote, setSourceNote, error, commit, clear }
}
