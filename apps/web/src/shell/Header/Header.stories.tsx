import type { Meta, StoryObj } from '@storybook/tanstack-react'
import { Box } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { Header } from './Header'

function HeaderStory() {
  const [isNavigationOpen, { toggle: toggleNavigation }] = useDisclosure(true)

  return (
    <Header
      accountLabel='Account'
      crumbs={[{ label: 'Spells' }, { label: 'Ember Lance' }]}
      isNavigationOpen={isNavigationOpen}
      onNavigationToggle={toggleNavigation}
      statusLabel='Draft'
    />
  )
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
    accountLabel: 'Account',
    crumbs: [{ label: 'Spells' }, { label: 'Ember Lance' }],
    isNavigationOpen: true,
    onNavigationToggle: () => undefined,
    statusLabel: 'Draft'
  },
  render: () => <HeaderStory />
}
