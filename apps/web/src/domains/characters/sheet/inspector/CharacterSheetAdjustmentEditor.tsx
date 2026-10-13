import { Button, NumberInput, TextInput } from '@mantine/core'

import { AppSelect } from '#ui/primitives/Select'
import type {
  CharacterSheetEditorCommit,
  CharacterSheetNumberEditorDto,
  CharacterSheetSelectEditorDto
} from './inspector.model'
import * as inspectorEditorStyles from './inspectorEditor.css'
import { useSheetAdjustmentDraft } from './useSheetAdjustmentDraft'

const toDraft = (value: string | number | null) => value ?? ''
const isEmpty = (draft: string | number) => draft === ''

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
  const {
    draft: value,
    setDraft: setValue,
    sourceNote,
    setSourceNote,
    error,
    commit,
    clear
  } = useSheetAdjustmentDraft({
    editor,
    toDraft,
    isEmpty,
    parse: (draft) => {
      if (editor.kind !== 'NUMBER') return String(draft)
      const parsed = Number(draft)
      return Number.isFinite(parsed) ? parsed : null
    },
    onClear,
    onCommit
  })

  return (
    <div className={inspectorEditorStyles.editor}>
      <div className={inspectorEditorStyles.editorPrimary}>
        {editor.kind === 'NUMBER' ? (
          <NumberInput
            allowDecimal={!editor.validation.integer}
            classNames={inspectorEditorStyles.fieldClassNames}
            disabled={pending}
            error={error}
            hideControls
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
        ) : (
          <AppSelect
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
        {editor.adjustmentId ? (
          <Button
            color='red'
            disabled={pending}
            size='xs'
            variant='subtle'
            onClick={() => void clear()}
          >
            Clear
          </Button>
        ) : null}
      </div>
      <TextInput
        classNames={inspectorEditorStyles.fieldClassNames}
        disabled={pending}
        label='Source notes'
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
