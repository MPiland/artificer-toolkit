import type { Meta, StoryObj } from '@storybook/tanstack-react'
import { Button, SimpleGrid, Stack, Text } from '@mantine/core'
import { AppShellFrame, PageHeader } from './AppShellFrame'
import { storybookNavigation } from './navigation'

const meta = {
  title: 'Platform/Shells/AppShellFrame',
  component: AppShellFrame,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Authenticated app shell for rebuilt product surfaces. Provides the compact desktop rail, mobile drawer behavior, header utility area, route-aware navigation, theme toggle, user menu, and shared page header pattern.'
      }
    }
  },
  args: {
    navigation: storybookNavigation,
    currentPath: '/home',
    userEmail: 'creator@example.com',
    children: (
      <Stack gap='md'>
        <PageHeader
          eyebrow='Workspace'
          title='Authenticated shell foundation'
          description='Shared frame for the rebuilt home screen, authored lists, builder, and sheet surfaces.'
          actions={<Button>Primary action</Button>}
        />
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing='md'>
          <Text c='dimmed'>
            The shell provides the stable navigation spine, route context, mobile drawer, and utility area.
          </Text>
          <Text c='dimmed'>
            Domain pages should bring their own content composition without rebuilding the shell.
          </Text>
        </SimpleGrid>
      </Stack>
    )
  }
} satisfies Meta<typeof AppShellFrame>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Mobile: Story = {
  parameters: {
    viewport: {
      defaultViewport: 'mobile1'
    }
  }
}
