import type { Meta, StoryObj } from '@storybook/tanstack-react'
import { useState } from 'react'
import {
  editorDenseScalingRows,
  editorScalingRows,
  editorScalingRowsWithoutNotes
} from '../../fixtures/editor.fixtures'
import {
  commitScalingRow,
  createScalingDraftRow,
  getScalingRowSummary,
  getScalingRowTitle,
  renderScalingRowEditor,
  renderScalingRowActions,
  scalingColumns,
  scalingColumnsWithoutNotes
} from '../../fixtures/progressionTable.fixtures'
import { ProgressionTable } from './ProgressionTable'
import type { EditableTableRow, ProgressionTableProps } from './ProgressionTable.types'
import * as storyStyles from './ProgressionTable.stories.css'

const frameClasses = {
  desktop: storyStyles.desktopFrame,
  mobileLandscape: storyStyles.mobileLandscapeFrame,
  mobilePortrait: storyStyles.mobilePortraitFrame,
  tabletPortrait: storyStyles.tabletPortraitFrame
} as const

const baseProps = {
  addLabel: 'Add tier',
  ariaLabel: 'Scaling progression',
  columns: scalingColumns,
  editorTitle: (row, mode) =>
    mode === 'create' ? 'Add progression tier' : `Edit ${row ? getScalingRowTitle(row) : 'tier'}`,
  getRowSummary: getScalingRowSummary,
  getRowTitle: getScalingRowTitle,
  renderRowActions: renderScalingRowActions,
  renderRowEditor: renderScalingRowEditor,
  rows: editorScalingRows,
  saveLabel: 'Save tier'
} satisfies ProgressionTableProps

function ProgressionTableStory({
  frame = 'desktop',
  progressionProps,
  withoutNotes = false
}: {
  frame?: keyof typeof frameClasses
  progressionProps?: ProgressionTableProps
  withoutNotes?: boolean
}) {
  const flatSurface = frame !== 'desktop'
  const initialRows = progressionProps?.rows
    ?? (withoutNotes ? editorScalingRowsWithoutNotes : editorScalingRows)
  const [rows, setRows] = useState<readonly EditableTableRow[]>(initialRows)
  const props = {
    ...baseProps,
    ...progressionProps,
    columns: withoutNotes ? scalingColumnsWithoutNotes : scalingColumns,
    createDraftRow: () => createScalingDraftRow(rows),
    onCommitRow: (payload) => {
      setRows((currentRows) => commitScalingRow(currentRows, payload))
    },
    rows
  } satisfies ProgressionTableProps

  return (
    <div className={storyStyles.storyCanvas} data-mantine-color-scheme='dark'>
      <div className={frameClasses[frame]}>
        <div className={flatSurface ? storyStyles.tableSurfaceFlat : storyStyles.tableSurface}>
          <ProgressionTable {...props} />
        </div>
      </div>
    </div>
  )
}

const meta = {
  title: 'Forms/Authoring/Editor/Progression Table',
  component: ProgressionTable,
  parameters: {
    docs: {
      description: {
        component: 'Effect flyouts are intentionally deferred for a later isolated spike.'
      }
    },
    layout: 'fullscreen'
  }
} satisfies Meta<typeof ProgressionTable>

export default meta

type Story = StoryObj<typeof meta>

export const DesktopTable: Story = {
  args: baseProps,
  render: () => <ProgressionTableStory />
}

export const MobilePortraitSummary: Story = {
  args: {
    ...baseProps,
    forceMode: 'mobilePortrait',
    rows: editorDenseScalingRows
  },
  render: () => (
    <ProgressionTableStory
      frame='mobilePortrait'
      progressionProps={{ ...baseProps, forceMode: 'mobilePortrait', rows: editorDenseScalingRows }}
    />
  )
}

export const MobileLandscapeSummary: Story = {
  args: {
    ...baseProps,
    forceMode: 'mobileLandscape',
    rows: editorDenseScalingRows
  },
  render: () => (
    <ProgressionTableStory
      frame='mobileLandscape'
      progressionProps={{ ...baseProps, forceMode: 'mobileLandscape', rows: editorDenseScalingRows }}
    />
  )
}

export const TabletPortraitSummary: Story = {
  args: {
    ...baseProps,
    forceMode: 'tablet',
    rows: editorDenseScalingRows
  },
  render: () => (
    <ProgressionTableStory
      frame='tabletPortrait'
      progressionProps={{ ...baseProps, forceMode: 'tablet', rows: editorDenseScalingRows }}
    />
  )
}

export const WithoutNotes: Story = {
  args: {
    ...baseProps,
    columns: scalingColumnsWithoutNotes,
    rows: editorScalingRowsWithoutNotes
  },
  render: () => <ProgressionTableStory withoutNotes />
}

export const NumericInputsNoControls: Story = {
  args: baseProps,
  render: () => <ProgressionTableStory />
}
