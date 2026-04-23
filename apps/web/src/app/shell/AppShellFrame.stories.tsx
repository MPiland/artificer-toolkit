import type { Meta, StoryObj } from '@storybook/react-vite'
import { List, Stack, Text } from '@mantine/core'
import { AppShellFrame } from './AppShellFrame'
import { platformNavigation } from './navigation'

const meta = {
  title: 'Platform/Shells/AppShellFrame',
  component: AppShellFrame,
  args: {
    title: 'Authenticated shell foundation',
    description: 'Shared frame for the rebuilt home screen, list pages, builder, and sheet surfaces.',
    navigation: platformNavigation,
    children: (
      <Stack gap='md'>
        <Text c='dimmed'>
          This content area is intentionally simple in 9.1 so we can validate the shell before the list and
          form runtime lands.
        </Text>
        <List spacing='xs' size='sm'>
          <List.Item>Route-level loading and error states</List.Item>
          <List.Item>Shared footer actions and drawers</List.Item>
          <List.Item>List pattern rollout in the next tranche</List.Item>
        </List>
      </Stack>
    )
  }
} satisfies Meta<typeof AppShellFrame>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}
