import { Button, NumberInput, TextInput } from '@mantine/core'
import { LENGTH_UNIT_CODES, LENGTH_UNIT_OPTIONS } from '@artificer-toolkit/shared/core'

import { AppSelect } from '#ui/primitives/Select'
import type { CharacterSheetLengthCommit, CharacterSheetLengthEditorDto } from './inspector.model'
import * as inspectorEditorStyles from './inspectorEditor.css'
import { useSheetAdjustmentDraft } from './useSheetAdjustmentDraft'

type LengthValue = NonNullable<CharacterSheetLengthEditorDto['value']>
type LengthDraft = { amount: string | number; unit: LengthValue['unit'] }

const unitData = LENGTH_UNIT_OPTIONS.map((option) => ({
  value: option.code,
  label: option.label
}))

const isEmpty = (draft: LengthDraft) => draft.amount === ''
const parse = (draft: LengthDraft): LengthValue | null => {
  const amount = Number(draft.amount)
  return Number.isFinite(amount) ? { amount, unit: draft.unit } : null
}

export function CharacterSheetLengthEditor({
  editor,
  pending,
  onClear,
  onCommit
}: {
  editor: CharacterSheetLengthEditorDto
  pending: boolean
  onClear: () => Promise<boolean>
  onCommit: (commit: CharacterSheetLengthCommit) => Promise<boolean>
}) {
  /** A blank draft starts in the unit the Character already holds, else in feet. */
  const toDraft = (value: LengthValue | null): LengthDraft => ({
    amount: value?.amount ?? '',
    unit: value?.unit ?? editor.defaultUnit ?? 'FEET'
  })
  const { draft, setDraft, sourceNote, setSourceNote, error, commit, clear } =
    useSheetAdjustmentDraft({ editor, toDraft, isEmpty, parse, onClear, onCommit })

  return (
    <div className={inspectorEditorStyles.editor}>
      <div className={inspectorEditorStyles.editorPrimary}>
        <NumberInput
          classNames={inspectorEditorStyles.fieldClassNames}
          disabled={pending}
          error={error}
          hideControls
          label={editor.label}
          min={0}
          value={draft.amount}
          onBlur={() => void commit()}
          onChange={(amount) => setDraft({ ...draft, amount })}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur()
          }}
        />
        <AppSelect
          data={unitData}
          disabled={pending}
          label='Unit'
          searchable={false}
          value={draft.unit}
          onChange={(nextUnit) => {
            const unit = LENGTH_UNIT_CODES.find((code) => code === nextUnit)
            if (!unit) return
            const nextDraft = { ...draft, unit }
            setDraft(nextDraft)
            if (!isEmpty(nextDraft)) void commit(nextDraft)
          }}
        />
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
          if (!isEmpty(draft)) void commit()
        }}
        onChange={(event) => setSourceNote(event.currentTarget.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur()
        }}
      />
    </div>
  )
}
