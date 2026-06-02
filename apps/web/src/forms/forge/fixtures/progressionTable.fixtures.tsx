import { ActionIcon, NumberInput, TextInput } from '@mantine/core'
import { Trash2 } from 'lucide-react'
import type {
  EditableTableColumn,
  EditableTableRow,
  ProgressionRowCommitPayload,
  ProgressionRowEditorRenderProps
} from '../components/ProgressionTable/ProgressionTable.types'
import * as tableStyles from '../components/ProgressionTable/ProgressionTable.css'

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
    label: 'Slot lvl',
    renderCell: (row) => (
      <NumberInput
        aria-label={`Slot level ${rowValue(row, 'level')}`}
        classNames={{ input: tableStyles.compactInput }}
        defaultValue={Number(row.level)}
        hideControls
        min={1}
      />
    ),
    width: '4.5rem'
  },
  {
    id: 'addedDice',
    label: 'Added dice',
    renderCell: (row) => (
      <TextInput
        aria-label={`Added dice for level ${rowValue(row, 'level')}`}
        classNames={{ input: tableStyles.compactInput }}
        defaultValue={rowValue(row, 'addedDice')}
      />
    ),
    width: '6rem'
  },
  {
    id: 'totalDamage',
    label: 'Total dmg',
    renderCell: (row) => (
      <TextInput
        aria-label={`Total damage for level ${rowValue(row, 'level')}`}
        classNames={{ input: tableStyles.diceInput }}
        defaultValue={rowValue(row, 'totalDamage')}
      />
    ),
    width: '6rem'
  },
  {
    id: 'notes',
    label: 'Notes',
    renderCell: (row) => (
      <TextInput
        aria-label={`Notes for level ${rowValue(row, 'level')}`}
        classNames={{ input: tableStyles.compactInput }}
        defaultValue={rowValue(row, 'notes')}
      />
    ),
    width: 'minmax(0, 1fr)'
  }
]

export const scalingColumnsWithoutNotes = scalingColumns.filter((column) => column.id !== 'notes')

export function getScalingRowTitle(row: EditableTableRow) {
  return `Level ${rowValue(row, 'level')} Slot`
}

export function getScalingRowSummary(row: EditableTableRow) {
  return (
    <>
      <span className={tableStyles.summaryDamage}>{rowValue(row, 'totalDamage')}</span> Fire Damage
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
    addedDice: '+1d6',
    id: `level-${nextLevel}`,
    level: nextLevel,
    notes: '',
    totalDamage: ''
  }
}

export function commitScalingRow(
  rows: readonly EditableTableRow[],
  { draftRow, mode, sourceRow }: ProgressionRowCommitPayload
): readonly EditableTableRow[] {
  if (mode === 'create') return [...rows, draftRow]
  if (!sourceRow) return rows

  return rows.map((row) => row.id === sourceRow.id ? { ...draftRow, id: sourceRow.id } : row)
}

export function renderScalingRowEditor({
  draftRow,
  mode,
  setDraftRowValue
}: ProgressionRowEditorRenderProps) {
  const isCreate = mode === 'create'

  return (
    <div className={tableStyles.editorForm} key={`${mode}-${draftRow.id}`}>
      <div className={tableStyles.editorFormGrid}>
        <NumberInput
          classNames={{ input: tableStyles.editorInput, label: tableStyles.editorLabel }}
          hideControls
          label='Slot level'
          min={1}
          onChange={(value) => setDraftRowValue('level', value)}
          placeholder={isCreate ? 'Next level' : undefined}
          value={numberInputValue(draftRow, 'level')}
        />
        <TextInput
          classNames={{ input: tableStyles.editorInput, label: tableStyles.editorLabel }}
          label='Added dice'
          onChange={(event) => setDraftRowValue('addedDice', event.currentTarget.value)}
          placeholder='+1d6'
          value={rowValue(draftRow, 'addedDice')}
        />
        <TextInput
          classNames={{ input: tableStyles.editorDiceInput, label: tableStyles.editorLabel }}
          label='Total damage'
          onChange={(event) => setDraftRowValue('totalDamage', event.currentTarget.value)}
          placeholder='4d6'
          value={rowValue(draftRow, 'totalDamage')}
        />
        <TextInput
          classNames={{ input: tableStyles.editorInput, label: tableStyles.editorLabel }}
          label='Notes'
          onChange={(event) => setDraftRowValue('notes', event.currentTarget.value)}
          placeholder='Optional note'
          value={rowValue(draftRow, 'notes')}
        />
      </div>
    </div>
  )
}

export function renderScalingRowActions(row: EditableTableRow) {
  return (
    <ActionIcon
      aria-label={`Remove level ${rowValue(row, 'level')}`}
      className={tableStyles.rowIconButton}
      variant='subtle'
    >
      <Trash2 aria-hidden='true' size={15} />
    </ActionIcon>
  )
}
