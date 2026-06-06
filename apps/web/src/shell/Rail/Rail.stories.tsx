import type { Meta, StoryObj } from '@storybook/tanstack-react'
import { Box } from '@mantine/core'
import { railItems, railSummaries } from '../../forms/fixtures/rail.fixtures'
import { Rail } from './Rail'

const meta = {
  title: 'Shell/App/Rail/Container',
  component: Rail,
  parameters: {
    layout: 'fullscreen'
  },
  decorators: [
    (Story, context) => (
      <Box
        mih='100dvh'
        bg='var(--mantine-color-body)'
      >
        <Box h='100dvh' maw='20rem'>
          <Story />
        </Box>
      </Box>
    )
  ]
} satisfies Meta<typeof Rail>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    items: railItems,
    summaries: railSummaries,
    subtitle: 'Ember Lance',
    title: 'Structure'
  }
}
