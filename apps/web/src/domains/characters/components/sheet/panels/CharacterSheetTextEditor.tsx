import { Textarea, TextInput } from '@mantine/core'
import { useEffect, useRef, useState, type ChangeEvent } from 'react'

import type { CharacterSheetPanelDto } from '#app/lib/api'
import * as inputStyles from '#ui/primitives/Select/Select.css'
import * as styles from './characterSheetInspector.css'

type TextEditor = Extract<CharacterSheetPanelDto, { kind: 'SPELL' | 'ITEM' }>['textEditors'][number]
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
  const [value, setValue] = useState(editor.value ?? '')
  const [error, setError] = useState<string>()
  const lastSubmitted = useRef<string | null | undefined>(undefined)

  useEffect(() => {
    setValue(editor.value ?? '')
    setError(undefined)
    lastSubmitted.current = undefined
  }, [editor.value])

  async function commit() {
    const nextValue = value.trim() || null
    if (nextValue === lastSubmitted.current) return
    lastSubmitted.current = nextValue
    setError(undefined)
    if (await onCommit(nextValue)) return

    lastSubmitted.current = undefined
    setValue(editor.value ?? '')
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
    onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setValue(event.currentTarget.value)
  }

  return (
    <div className={styles.editor}>
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
    </div>
  )
}
