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
} from '../../fixtures/table.fixtures'
import { EditorCanvas } from './EditorCanvas'
import type { EditableTableRow, TableProps } from '../Table/Table.types'
import * as styles from './EditorCanvas.stories.css'

const baseTable = {
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

function EditorCanvasStory() {
  const [rows, setRows] = useState<readonly EditableTableRow[]>(editorScalingRows)
  const table = {
    ...baseTable,
    createDraftRow: () => createScalingDraftRow(rows),
    onCommitRow: (payload) => {
      setRows((currentRows) => commitScalingRow(currentRows, payload))
    },
    rows
  } satisfies TableProps

  return <EditorCanvas path={editorHeaderPath} table={table} title='Upcast Scaling' />
}

const meta = {
  title: 'Forms/Authoring/Editor Canvas/Component',
  component: EditorCanvas,
  parameters: {
    layout: 'fullscreen'
  },
  decorators: [
    (Story) => (
      <div className={styles.storyCanvas}>
        <div className={styles.canvasSlot}>
          <Story />
        </div>
      </div>
    )
  ]
} satisfies Meta<typeof EditorCanvas>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    path: editorHeaderPath,
    table: baseTable,
    title: 'Upcast Scaling'
  },
  render: () => <EditorCanvasStory />
}
