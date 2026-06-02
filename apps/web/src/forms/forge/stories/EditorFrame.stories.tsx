import type { Meta, StoryObj } from '@storybook/tanstack-react'
import { useDisclosure } from '@mantine/hooks'
import clsx from 'clsx'
import { useState } from 'react'
import { EditorCanvas } from '../components/EditorCanvas/EditorCanvas'
import type { EditableTableRow, ProgressionTableProps } from '../components/ProgressionTable/ProgressionTable.types'
import { Rail } from '../components/Rail/Rail'
import { TopBar } from '../components/TopBar/TopBar'
import { editorHeaderPath, editorScalingRows } from '../fixtures/editor.fixtures'
import {
  commitScalingRow,
  createScalingDraftRow,
  getScalingRowSummary,
  getScalingRowTitle,
  renderScalingRowEditor,
  renderScalingRowActions,
  scalingColumns
} from '../fixtures/progressionTable.fixtures'
import { railItems, railSummaries } from '../fixtures/rail.fixtures'
import * as styles from './EditorFrame.stories.css'

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

function MiddleContentStory() {
  const [isRailOpen, { toggle: toggleRail }] = useDisclosure(true)
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
      <div className={styles.frame}>
        <TopBar
          accountLabel='Account'
          crumbs={[{ label: 'Spells' }, { label: 'Ember Lance' }]}
          isNavigationOpen={isRailOpen}
          onNavigationToggle={toggleRail}
          statusLabel='Draft'
        />
        <div className={styles.workspace}>
          <div
            className={clsx(styles.railSlot, !isRailOpen && styles.railSlotClosed)}
            aria-hidden={!isRailOpen}
            id='forge-structure-rail'
          >
            <Rail
              items={railItems}
              summaries={railSummaries}
              subtitle='Ember Lance'
              title='Structure'
            />
          </div>
          <div className={styles.editorSlot}>
            <EditorCanvas
              path={editorHeaderPath}
              progressionTable={progressionTable}
              title='Upcast Scaling'
            />
          </div>
        </div>
      </div>
    </div>
  )
}

const meta = {
  title: 'Forms/Authoring/Editor Canvas/Middle Content',
  component: EditorCanvas,
  parameters: {
    layout: 'fullscreen'
  }
} satisfies Meta<typeof EditorCanvas>

export default meta

type Story = StoryObj<typeof meta>

export const MiddleContentInFrame: Story = {
  args: {
    path: editorHeaderPath,
    progressionTable: baseProgressionTable,
    title: 'Upcast Scaling'
  },
  render: () => <MiddleContentStory />
}
