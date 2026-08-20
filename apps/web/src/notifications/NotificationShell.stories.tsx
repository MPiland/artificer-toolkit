import type { Meta, StoryObj } from '@storybook/tanstack-react'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import { http, HttpResponse } from 'msw'
import { Shell } from '#app/shell/Shell'
import { storybookNavigation } from '#app/shell/navigation'
import { NotificationsPage } from './NotificationsPage'
import { NotificationsProvider } from './NotificationsProvider'

const meta = {
  title: 'Shell/Notifications/Composition',
  component: Shell,
  args: {
    children: <div>Dashboard</div>,
    currentPath: '/home',
    isAuthenticated: true,
    navigation: storybookNavigation,
    userEmail: 'story@example.com'
  },
  decorators: [
    (Story) => (
      <NotificationsProvider>
        <Story />
      </NotificationsProvider>
    )
  ],
  parameters: {
    msw: {
      handlers: [
        http.get('*/api/trpc/notifications.feed,media.getImage', () =>
          HttpResponse.json([
            {
              result: {
                data: {
                  items: [],
                  unseenCount: 1
                }
              }
            },
            { result: { data: null } }
          ])
        ),
        http.get('*/api/trpc/notifications.feed', () => trpcJson({ items: [], unseenCount: 1 })),
        http.get('*/api/trpc/media.getImage', () => trpcJson(null)),
        http.post('*/api/trpc/notifications.markAllSeen', () => trpcJson({ ok: true })),
        http.post('*/api/trpc/notifications.markRead', () => trpcJson({ ok: true }))
      ]
    }
  }
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

function trpcJson(data: unknown) {
  return HttpResponse.json([{ result: { data } }])
}
