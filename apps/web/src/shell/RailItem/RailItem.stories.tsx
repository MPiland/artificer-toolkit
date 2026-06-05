import type { Meta, StoryObj } from '@storybook/tanstack-react'
import { Box } from '@mantine/core'
import {
  activeNestedRailItem,
  defaultRailItem,
  expandedBranchRailItem,
  mutedEmptyRailItem
} from '../../forms/fixtures/rail.fixtures'
import { RailItem } from './RailItem'

const meta = {
  title: 'Shell/App/Rail/Item',
  component: RailItem,
  parameters: {
    layout: 'fullscreen'
  },
  decorators: [
    (Story, context) => (
      <Box
        p='md'
        bg='var(--mantine-color-body)'
      >
        <Box maw='20rem'>
          <Story />
        </Box>
      </Box>
    )
  ]
} satisfies Meta<typeof RailItem>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    item: defaultRailItem
  }
}

export const ActiveNested: Story = {
  args: {
    item: activeNestedRailItem
  }
}

export const MutedEmpty: Story = {
  args: {
    item: mutedEmptyRailItem
  }
}

export const ExpandedBranch: Story = {
  args: {
    item: expandedBranchRailItem
  }
}
