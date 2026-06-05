import type { Meta, StoryObj } from '@storybook/tanstack-react'
import { Box, Group, Stack, Text } from '@mantine/core'
import { statusMarkerStatuses } from '../../forms/fixtures/rail.fixtures'
import type { ItemStatus } from '../Rail/Rail.types'
import { StatusMarker } from './StatusMarker'

function StatusMarkerGrid({ statuses }: { statuses: readonly ItemStatus[] }) {
  return (
    <Stack gap='xs'>
      {statuses.map((status) => (
        <Group gap='sm' key={status}>
          <Text c='dimmed' ff='monospace' size='xs' w={80}>
            {status}
          </Text>
          <StatusMarker status={status} />
        </Group>
      ))}
    </Stack>
  )
}

const meta = {
  title: 'Shell/App/Rail/Status Marker',
  component: StatusMarker,
  parameters: {
    layout: 'fullscreen'
  },
  decorators: [
    (Story, context) => (
      <Box
        p='md'
        bg='var(--mantine-color-body)'
      >
        <Story />
      </Box>
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
