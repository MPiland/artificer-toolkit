import type { Meta, StoryObj } from '@storybook/tanstack-react'
import { Box } from '@mantine/core'
import { Header } from './Header'

function HeaderStory() {
  return <Header accountLabel='Account' />
}

const meta = {
  title: 'Shell/App/Header',
  component: Header,
  parameters: {
    layout: 'fullscreen'
  },
  decorators: [
    (Story, context) => (
      <Box
        mih='100dvh'
        bg='var(--mantine-color-body)'
      >
        <Story />
      </Box>
    )
  ]
} satisfies Meta<typeof Header>

export default meta

type Story = StoryObj<typeof meta>

export const HeaderInContext: Story = {
  args: {
    accountLabel: 'Account'
  },
  render: () => <HeaderStory />
}
