import type { Meta, StoryObj } from '@storybook/tanstack-react'
import { statusMarkerStatuses } from '../../fixtures/rail.fixtures'
import type { ItemStatus } from '../Rail/Rail.types'
import { StatusMarker } from './StatusMarker'
import * as styles from './StatusMarker.stories.css'

function StatusMarkerStory({ statuses }: { statuses: readonly ItemStatus[] }) {
  return (
    <div className={styles.storyCanvas} data-mantine-color-scheme='dark'>
      <div className={styles.markerGrid}>
        {statuses.map((status) => (
          <div className={styles.markerRow} key={status}>
            <span>{status}</span>
            <StatusMarker status={status} />
          </div>
        ))}
      </div>
    </div>
  )
}

const meta = {
  title: 'Forms/Authoring/Rail/Status Marker',
  component: StatusMarker,
  parameters: {
    layout: 'fullscreen'
  }
} satisfies Meta<typeof StatusMarker>

export default meta

type Story = StoryObj<typeof meta>

export const AllStatuses: Story = {
  args: {
    status: 'complete'
  },
  render: () => <StatusMarkerStory statuses={statusMarkerStatuses} />
}
