import { Button, NumberInput, Select, TextInput } from '@mantine/core'
import { useEffect, useRef, useState } from 'react'

import type {
  CharacterSheetEditorCommit,
  CharacterSheetNumberEditorDto,
  CharacterSheetSelectEditorDto
} from './characterSheetInspector.model'
import { cleanSheetEditorText } from './characterSheetInspector.model'
import * as styles from './characterSheetInspector.css'

const SOURCE_CATEGORY_OPTIONS = [
  { value: 'MANUAL', label: 'Manual' },
  { value: 'MAGIC', label: 'Magic' },
  { value: 'MISCELLANEOUS', label: 'Miscellaneous' },
  { value: 'OTHER', label: 'Other' }
]

export function CharacterSheetAdjustmentEditor({
  editor,
  pending,
  onClear,
  onCommit
}: {
  editor: CharacterSheetNumberEditorDto | CharacterSheetSelectEditorDto
  pending: boolean
  onClear: () => Promise<boolean>
  onCommit: (commit: CharacterSheetEditorCommit) => Promise<boolean>
}) {
  const [value, setValue] = useState<string | number>(editor.value ?? '')
  const [sourceCategory, setSourceCategory] = useState(editor.sourceCategory)
  const [sourceLabel, setSourceLabel] = useState(editor.sourceLabel ?? '')
  const [sourceNote, setSourceNote] = useState(editor.sourceNote ?? '')
  const [error, setError] = useState<string | undefined>(undefined)
  const lastSubmitted = useRef<string | undefined>(undefined)

  useEffect(() => {
    setValue(editor.value ?? '')
    setSourceCategory(editor.sourceCategory)
    setSourceLabel(editor.sourceLabel ?? '')
    setSourceNote(editor.sourceNote ?? '')
    setError(undefined)
    lastSubmitted.current = undefined
  }, [
    editor.adjustmentId,
    editor.sourceCategory,
    editor.sourceLabel,
    editor.sourceNote,
    editor.value
  ])

  function restoreServerValue() {
    setValue(editor.value ?? '')
    setSourceCategory(editor.sourceCategory)
    setSourceLabel(editor.sourceLabel ?? '')
    setSourceNote(editor.sourceNote ?? '')
  }

  async function clear() {
    if (!editor.adjustmentId) {
      setValue('')
      return
    }
    const succeeded = await onClear()
    if (!succeeded) {
      restoreServerValue()
      setError('The adjustment could not be cleared. The server value was restored.')
    }
  }

  async function commit(
    nextValue: string | number = value,
    nextSourceCategory = sourceCategory
  ) {
    if (nextValue === '') {
      await clear()
      return
    }
    const parsedValue =
      editor.kind === 'NUMBER' ? Number(nextValue) : String(nextValue)
    if (editor.kind === 'NUMBER' && !Number.isFinite(parsedValue)) {
      setError('Enter a valid number.')
      return
    }
    const payload: CharacterSheetEditorCommit = {
      value: parsedValue,
      sourceCategory: nextSourceCategory,
      ...(cleanSheetEditorText(sourceLabel)
        ? { sourceLabel: cleanSheetEditorText(sourceLabel) }
        : {}),
      ...(cleanSheetEditorText(sourceNote)
        ? { sourceNote: cleanSheetEditorText(sourceNote) }
        : {})
    }
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

  return (
    <div className={styles.editor}>
      <div className={styles.editorPrimary}>
        {editor.kind === 'NUMBER'
          ? (
              <NumberInput
                allowDecimal={!editor.validation.integer}
                disabled={pending}
                error={error}
                label={editor.label}
                max={editor.validation.maximum}
                min={editor.validation.minimum}
                value={value}
                onBlur={() => void commit()}
                onChange={setValue}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') event.currentTarget.blur()
                }}
              />
            )
          : (
              <Select
                clearable
                data={editor.options}
                disabled={pending}
                error={error}
                label={editor.label}
                value={value === '' ? null : String(value)}
                onChange={(nextValue) => {
                  setValue(nextValue ?? '')
                  if (nextValue == null) void clear()
                  else void commit(nextValue)
                }}
              />
            )}
        {editor.adjustmentId
          ? (
              <Button
                color='red'
                disabled={pending}
                size='xs'
                variant='subtle'
                onClick={() => void clear()}
              >
                Clear
              </Button>
            )
          : null}
      </div>
      <div className={styles.editorMetadata}>
        <Select
          data={SOURCE_CATEGORY_OPTIONS}
          disabled={pending}
          label='Source category'
          value={sourceCategory}
          onChange={(nextValue) => {
            if (!nextValue) return
            setSourceCategory(nextValue as typeof sourceCategory)
            if (value !== '') {
              void commit(value, nextValue as typeof sourceCategory)
            }
          }}
        />
        <TextInput
          disabled={pending}
          label='Source label'
          maxLength={80}
          placeholder='Optional'
          value={sourceLabel}
          onBlur={() => {
            if (value !== '') void commit()
          }}
          onChange={(event) => setSourceLabel(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur()
          }}
        />
      </div>
      <TextInput
        disabled={pending}
        label='Source note'
        maxLength={240}
        placeholder='Optional provenance or table ruling'
        value={sourceNote}
        onBlur={() => {
          if (value !== '') void commit()
        }}
        onChange={(event) => setSourceNote(event.currentTarget.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur()
        }}
      />
    </div>
  )
}
