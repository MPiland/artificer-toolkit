import type { Meta, StoryObj } from '@storybook/tanstack-react'
import { useState } from 'react'
import { editorHeaderPath, editorScalingRows } from '../../fixtures/editor.fixtures'
import {
  commitScalingRow,
  createScalingDraftRow,
  getScalingRowSummary,
  getScalingRowTitle,
  renderScalingRowEditor,
  renderScalingRowActions,
  scalingColumns
} from '../../fixtures/progressionTable.fixtures'
import { EditorCanvas } from './EditorCanvas'
import type { EditableTableRow, ProgressionTableProps } from '../ProgressionTable/ProgressionTable.types'
import * as styles from './EditorCanvas.stories.css'

const baseProgressionTable = {
  addLabel: 'Add row',
  ariaLabel: 'Scaling progression',
  columns: scalingColumns,
  editorTitle: 'Edit progression tier',
  getRowSummary: getScalingRowSummary,
  getRowTitle: getScalingRowTitle,
  renderRowActions: renderScalingRowActions,
  renderRowEditor: renderScalingRowEditor,
  rows: editorScalingRows,
  saveLabel: 'Save tier'
} satisfies ProgressionTableProps

function EditorCanvasStory() {
  const [rows, setRows] = useState<readonly EditableTableRow[]>(editorScalingRows)
  const progressionTable = {
    ...baseProgressionTable,
    createDraftRow: () => createScalingDraftRow(rows),
    onCommitRow: (payload) => {
      setRows((currentRows) => commitScalingRow(currentRows, payload))
    },
    rows
  } satisfies ProgressionTableProps

  return (
    <div className={styles.storyCanvas} data-mantine-color-scheme='dark'>
      <div className={styles.canvasSlot}>
        <EditorCanvas
          path={editorHeaderPath}
          progressionTable={progressionTable}
          title='Upcast Scaling'
        />
      </div>
    </div>
  )
}

const meta = {
  title: 'Forms/Authoring/Editor Canvas/Component',
  component: EditorCanvas,
  parameters: {
    layout: 'fullscreen'
  }
} satisfies Meta<typeof EditorCanvas>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    path: editorHeaderPath,
    progressionTable: baseProgressionTable,
    title: 'Upcast Scaling'
  },
  render: () => <EditorCanvasStory />
}
