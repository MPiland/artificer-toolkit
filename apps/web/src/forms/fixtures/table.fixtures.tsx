import { ActionIcon, NumberInput, TextInput } from '@mantine/core'
import { Trash2 } from 'lucide-react'
import type {
  EditableTableColumn,
  EditableTableRow,
  RowCommitPayload,
  RenderProps
} from '../components/Table/Table.types'
import * as tableStyles from '../components/Table/Table.css'

function rowValue(row: EditableTableRow, key: string) {
  const value = row[key]

  return value == null ? '' : String(value)
}

function numberInputValue(row: EditableTableRow, key: string) {
  const value = row[key]

  return typeof value === 'number' || typeof value === 'string' ? value : ''
}

export const scalingColumns: readonly EditableTableColumn[] = [
  {
    id: 'level',
    label: 'Cast level',
    renderCell: (row) => (
      <NumberInput
        aria-label={`Cast level ${rowValue(row, 'level')}`}
        classNames={{ input: tableStyles.compactInput }}
        defaultValue={Number(row.level)}
        hideControls
        min={1}
      />
    ),
    width: 'minmax(6rem, 1fr)'
  },
  {
    id: 'diceConfig',
    label: 'Damage dice',
    renderCell: (row) => (
      <TextInput
        aria-label={`Damage dice for cast level ${rowValue(row, 'level')}`}
        classNames={{ input: tableStyles.diceInput }}
        defaultValue={rowValue(row, 'diceConfig')}
      />
    ),
    width: 'minmax(8rem, 1fr)'
  }
]

export function getScalingRowTitle(row: EditableTableRow) {
  return `Cast level ${rowValue(row, 'level')}`
}

export function getScalingRowSummary(row: EditableTableRow) {
  return (
    <>
      <span className={tableStyles.summaryDamage}>{rowValue(row, 'diceConfig')}</span> Fire damage
    </>
  )
}

export function createScalingDraftRow(rows: readonly EditableTableRow[]): EditableTableRow {
  const maxLevel = rows.reduce((max, row) => {
    const level = Number(row.level)

    return Number.isFinite(level) ? Math.max(max, level) : max
  }, 0)
  const nextLevel = maxLevel + 1

  return {
    diceConfig: '',
    id: `ember-lance-level-${nextLevel}`,
    level: nextLevel,
    order: rows.length + 1
  }
}

export function commitScalingRow(
  rows: readonly EditableTableRow[],
  { draftRow, mode, sourceRow }: RowCommitPayload
): readonly EditableTableRow[] {
  if (mode === 'create') return [...rows, draftRow]
  if (!sourceRow) return rows

  return rows.map((row) => (row.id === sourceRow.id ? { ...draftRow, id: sourceRow.id } : row))
}

export function renderScalingRowEditor({ draftRow, mode, setDraftRowValue }: RenderProps) {
  const isCreate = mode === 'create'

  return (
    <div className={tableStyles.editorForm} key={`${mode}-${draftRow.id}`}>
      <div className={tableStyles.editorFormGrid}>
        <NumberInput
          classNames={{ input: tableStyles.editorInput, label: tableStyles.editorLabel }}
          hideControls
          label='Cast level'
          min={1}
          onChange={(value) => setDraftRowValue('level', value)}
          placeholder={isCreate ? 'Next level' : undefined}
          value={numberInputValue(draftRow, 'level')}
        />
        <TextInput
          classNames={{ input: tableStyles.editorDiceInput, label: tableStyles.editorLabel }}
          label='Damage dice'
          onChange={(event) => setDraftRowValue('diceConfig', event.currentTarget.value)}
          placeholder='4d6'
          value={rowValue(draftRow, 'diceConfig')}
        />
      </div>
    </div>
  )
}

export function renderScalingRowActions(row: EditableTableRow) {
  return (
    <ActionIcon
      aria-label={`Remove cast level ${rowValue(row, 'level')}`}
      className={tableStyles.rowIconButton}
      variant='subtle'
    >
      <Trash2 aria-hidden='true' size={15} />
    </ActionIcon>
  )
}
