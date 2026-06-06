import { ActionIcon, NumberInput, TextInput } from '@mantine/core'
import type { Meta, StoryObj } from '@storybook/tanstack-react'
import { Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Table } from './Table'
import type {
  EditableTableColumn,
  EditableTableRow,
  RenderProps,
  RowCommitPayload,
  TableProps
} from './Table.types'
import * as tableStyles from './Table.css'
import * as storyStyles from './Table.stories.css'

const editorScalingRows = [
  { diceConfig: '3d6', id: 'ember-lance-level-1', level: 1, order: 1 },
  { diceConfig: '4d6', id: 'ember-lance-level-2', level: 2, order: 2 },
  { diceConfig: '5d6', id: 'ember-lance-level-3', level: 3, order: 3 }
] satisfies readonly EditableTableRow[]

const editorDenseScalingRows = [
  { diceConfig: '3d6', id: 'ember-lance-level-1', level: 1, order: 1 },
  { diceConfig: '4d6', id: 'ember-lance-level-2', level: 2, order: 2 },
  { diceConfig: '5d6', id: 'ember-lance-level-3', level: 3, order: 3 },
  { diceConfig: '6d6', id: 'ember-lance-level-4', level: 4, order: 4 },
  { diceConfig: '7d6', id: 'ember-lance-level-5', level: 5, order: 5 }
] satisfies readonly EditableTableRow[]

function rowValue(row: EditableTableRow, key: string) {
  const value = row[key]

  return value == null ? '' : String(value)
}

function numberInputValue(row: EditableTableRow, key: string) {
  const value = row[key]

  return typeof value === 'number' || typeof value === 'string' ? value : ''
}

const scalingColumns = [
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
] satisfies readonly EditableTableColumn[]

function getScalingRowTitle(row: EditableTableRow) {
  return `Cast level ${rowValue(row, 'level')}`
}

function getScalingRowSummary(row: EditableTableRow) {
  return (
    <>
      <span className={tableStyles.summaryDamage}>{rowValue(row, 'diceConfig')}</span> Fire damage
    </>
  )
}

function createScalingDraftRow(rows: readonly EditableTableRow[]): EditableTableRow {
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

function commitScalingRow(
  rows: readonly EditableTableRow[],
  { draftRow, mode, sourceRow }: RowCommitPayload
): readonly EditableTableRow[] {
  if (mode === 'create') return [...rows, draftRow]
  if (!sourceRow) return rows

  return rows.map((row) => (row.id === sourceRow.id ? { ...draftRow, id: sourceRow.id } : row))
}

function renderScalingRowEditor({ draftRow, mode, setDraftRowValue }: RenderProps) {
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

function renderScalingRowActions(row: EditableTableRow) {
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

const frameClasses = {
  desktop: storyStyles.desktopFrame,
  mobileLandscape: storyStyles.mobileLandscapeFrame,
  mobilePortrait: storyStyles.mobilePortraitFrame,
  tabletPortrait: storyStyles.tabletPortraitFrame
} as const

const baseProps = {
  addLabel: 'Add cast level',
  ariaLabel: 'Scaling ',
  columns: scalingColumns,
  editorTitle: (row, mode) =>
    mode === 'create' ? 'Add cast level' : `Edit ${row ? getScalingRowTitle(row) : 'cast level'}`,
  getRowSummary: getScalingRowSummary,
  getRowTitle: getScalingRowTitle,
  renderRowActions: renderScalingRowActions,
  renderRowEditor: renderScalingRowEditor,
  rows: editorScalingRows,
  saveLabel: 'Save cast level'
} satisfies TableProps

function StatefulTable(props: TableProps) {
  const initialRows = props.rows
  const [rows, setRows] = useState<readonly EditableTableRow[]>(initialRows)
  const tableProps = {
    ...baseProps,
    ...props,
    columns: scalingColumns,
    createDraftRow: () => createScalingDraftRow(rows),
    onCommitRow: (payload) => {
      setRows((currentRows) => commitScalingRow(currentRows, payload))
    },
    rows
  } satisfies TableProps

  return <Table {...tableProps} />
}

const meta = {
  title: 'Forms/Authoring/Editor/Table',
  component: Table,
  parameters: {
    docs: {
      description: {
        component: 'Effect flyouts are intentionally deferred for a later isolated spike.'
      }
    },
    layout: 'fullscreen'
  },
  decorators: [
    (Story, context) => {
      const frame = (context.parameters.frame ?? 'desktop') as keyof typeof frameClasses
      const flatSurface = frame !== 'desktop'

      return (
        <div className={storyStyles.storyCanvas}>
          <div className={frameClasses[frame]}>
            <div className={flatSurface ? storyStyles.tableSurfaceFlat : storyStyles.tableSurface}>
              <Story />
            </div>
          </div>
        </div>
      )
    }
  ]
} satisfies Meta<typeof Table>

export default meta

type Story = StoryObj<typeof meta>

export const DesktopTable: Story = {
  args: baseProps,
  render: (args) => <StatefulTable {...args} />
}

export const MobilePortraitSummary: Story = {
  args: {
    ...baseProps,
    forceMode: 'mobilePortrait',
    rows: editorDenseScalingRows
  },
  parameters: {
    frame: 'mobilePortrait'
  },
  render: (args) => <StatefulTable {...args} />
}

export const MobileLandscapeSummary: Story = {
  args: {
    ...baseProps,
    forceMode: 'mobileLandscape',
    rows: editorDenseScalingRows
  },
  parameters: {
    frame: 'mobileLandscape'
  },
  render: (args) => <StatefulTable {...args} />
}

export const TabletPortraitSummary: Story = {
  args: {
    ...baseProps,
    forceMode: 'tablet',
    rows: editorDenseScalingRows
  },
  parameters: {
    frame: 'tabletPortrait'
  },
  render: (args) => <StatefulTable {...args} />
}

export const NumericInputsNoControls: Story = {
  args: baseProps,
  render: (args) => <StatefulTable {...args} />
}
