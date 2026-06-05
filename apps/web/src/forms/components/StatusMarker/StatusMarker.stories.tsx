import type { Meta, StoryObj } from '@storybook/tanstack-react'
import type { ItemStatus } from '../Rail/Rail.types'
import { StatusMarker } from './StatusMarker'
import * as styles from './StatusMarker.stories.css'

const statusMarkerStatuses = ['complete', 'dirty', 'warning', 'error', 'empty'] satisfies readonly ItemStatus[]

function StatusMarkerGrid({ statuses }: { statuses: readonly ItemStatus[] }) {
  return (
    <div className={styles.markerGrid}>
      {statuses.map((status) => (
        <div className={styles.markerRow} key={status}>
          <span>{status}</span>
          <StatusMarker status={status} />
        </div>
      ))}
    </div>
  )
}

const meta = {
  title: 'Forms/Authoring/Rail/Status Marker',
  component: StatusMarker,
  parameters: {
    layout: 'fullscreen'
  },
  decorators: [
    (Story) => (
      <div className={styles.storyCanvas}>
        <Story />
      </div>
    )
  ]
} satisfies Meta<typeof StatusMarker>

export default meta

type Story = StoryObj<typeof meta>

export const AllStatuses: Story = {
  args: {
    status: 'complete'
  },
  render: () => <StatusMarkerGrid statuses={statusMarkerStatuses} />
}
