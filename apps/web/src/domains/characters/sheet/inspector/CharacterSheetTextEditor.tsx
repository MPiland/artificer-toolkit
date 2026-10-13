import { Textarea, TextInput } from '@mantine/core'
import { useState, type ChangeEvent } from 'react'

import type { CharacterSheetPanelDto } from '@artificer-toolkit/schema/api/characterSheetPanel'
import { ServerDraftConflicts } from '#components/ServerDraft/ServerDraftConflicts'
import { useServerDraft } from '#components/ServerDraft/useServerDraft'
import * as inputStyles from '#ui/primitives/Select/Select.css'
import * as inspectorEditorStyles from './inspectorEditor.css'

type TextEditor = Extract<
  CharacterSheetPanelDto,
  { kind: 'SPELL' | 'ITEM' | 'COMPANION' | 'VEHICLE' }
>['textEditors'][number]
const fieldClassNames = {
  root: inputStyles.root,
  label: inputStyles.label,
  description: inputStyles.description,
  required: inputStyles.required,
  input: inputStyles.input
}

export function CharacterSheetTextEditor({
  editor,
  pending,
  onCommit
}: {
  editor: TextEditor
  pending: boolean
  onCommit: (value: string | null) => Promise<boolean>
}) {
  const draft = useServerDraft({ value: editor.value ?? '' })
  const { value } = draft.values
  const [error, setError] = useState<string>()

  async function commit() {
    const nextValue = value.trim() || null
    if (nextValue === (editor.value || null)) {
      draft.acceptLatest('value')
      return
    }
    setError(undefined)
    // Marked before the save settles: the server's stored (trimmed) value can arrive first.
    draft.markCommitted('value')
    // Marked before the save settles: the server's stored (trimmed) value can arrive first.
    if (await onCommit(nextValue)) return

    draft.acceptLatest('value')
    setError('The change could not be saved. The server value was restored.')
  }

  const sharedProps = {
    classNames: fieldClassNames,
    disabled: pending,
    error,
    label: editor.label,
    maxLength: editor.maximumLength,
    value,
    onBlur: () => void commit(),
    onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setError(undefined)
      draft.setValue('value', event.currentTarget.value)
    }
  }

  return (
    <div className={inspectorEditorStyles.editor}>
      {editor.multiline ? (
        <Textarea {...sharedProps} autosize minRows={3} />
      ) : (
        <TextInput
          {...sharedProps}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur()
          }}
        />
      )}
      <ServerDraftConflicts draft={draft} labels={{ value: editor.label }} />
    </div>
  )
}
