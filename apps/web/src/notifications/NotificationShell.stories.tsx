import type { Meta, StoryObj } from '@storybook/tanstack-react'
import { useQueryClient } from '@tanstack/react-query'
import { useConvexAuth, useMutation as useConvexMutation } from 'convex/react'
import { getFunctionName } from 'convex/server'
import { expect, mocked, userEvent, waitFor, within } from 'storybook/test'
import { api } from '@artificer-toolkit/apis/convex/api'
import { notificationFeedQuery } from '#app/data/notifications'
import { Shell } from '#app/shell/Shell'
import { platformNavigation } from '#app/shell/navigation'
import { NotificationsPage } from './NotificationsPage'
import { NotificationsProvider } from './NotificationsProvider'

const meta = {
  title: 'Shell/Notifications/Composition',
  component: Shell,
  args: {
    children: <div>Dashboard</div>,
    currentPath: '/home',
    isAuthenticated: true,
    navigation: platformNavigation,
    userEmail: 'story@example.com'
  },
  beforeEach: () => {
    mocked(useConvexAuth).mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      isRefreshing: false
    })
    mocked(useConvexMutation).mockImplementation((reference) => {
      const mutate: ReturnType<typeof useConvexMutation> = Object.assign(
        async () => {
          const name = getFunctionName(reference)
          if (
            name !== getFunctionName(api.notifications.markAllSeen) &&
            name !== getFunctionName(api.notifications.markRead)
          ) {
            throw new Error(`Unexpected native mutation ${name}`)
          }
          return { ok: true }
        },
        { withOptimisticUpdate: () => mutate }
      )
      return mutate
    })
  },
  decorators: [
    (Story) => {
      const queryClient = useQueryClient()
      queryClient.setQueryDefaults(notificationFeedQuery.queryKey, {
        queryFn: async () => ({ items: [], unseenCount: 1 })
      })
      return (
        <NotificationsProvider>
          <Story />
        </NotificationsProvider>
      )
    }
  ]
} satisfies Meta<typeof Shell>

export default meta

type Story = StoryObj<typeof meta>

export const DesktopBell: Story = {}

export const DesktopDrawer: Story = {
  play: async ({ canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body)
    const bell = await page.findByRole('button', { name: 'Notifications, 1 new' })
    await userEvent.click(bell)
    await waitFor(async () => {
      await expect(await page.findByRole('dialog', { name: 'Notifications' })).toBeVisible()
    })
  }
}

export const MobilePage: Story = {
  args: {
    children: <NotificationsPage />,
    currentPath: '/notifications'
  },
  parameters: { viewport: { defaultViewport: 'mobile1' } }
}
