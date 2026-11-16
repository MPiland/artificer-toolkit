import type { Meta, StoryObj } from '@storybook/tanstack-react'
import { api } from '@artificer-toolkit/apis/convex/api'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import { Shell } from '#app/shell/Shell'
import { buildPlatformNavigation, contentKindOrder } from '#app/shell/navigation'
import { writesTo } from '#app/test/storybook/storyWrites'
import {
  reviewAccountEmail,
  REVIEW_STORY_READER,
  STORY_ACCOUNTS,
  STORY_CAMPAIGN
} from '../../../apis/tests/developmentReviewDataScenarios'
import { NotificationsPage } from './NotificationsPage'
import { NotificationsProvider } from './NotificationsProvider'

// Reads the story account's own notification feed (D218, D221): the reader holds the application
// the peer submitted, and the peer holds the invitation the reader sent. Writes are spies.
const meta = {
  title: 'Shell/Notifications/Composition',
  component: Shell,
  args: {
    children: <div>Dashboard</div>,
    currentPath: '/home',
    isAuthenticated: true,
    navigation: buildPlatformNavigation(contentKindOrder),
    userEmail: reviewAccountEmail(STORY_ACCOUNTS.reader)
  },
  decorators: [
    (Story) => (
      <NotificationsProvider>
        <Story />
      </NotificationsProvider>
    )
  ]
} satisfies Meta<typeof Shell>

export default meta

type Story = StoryObj<typeof meta>

export const DesktopBell: Story = {
  play: async ({ canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body)
    await expect(await page.findByRole('button', { name: 'Notifications, 1 new' })).toBeVisible()
  }
}

export const DesktopDrawer: Story = {
  play: async ({ canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body)
    const bell = await page.findByRole('button', { name: 'Notifications, 1 new' })
    await userEvent.click(bell)
    const drawer = within(await page.findByRole('dialog', { name: 'Notifications' }))
    // The drawer is still transitioning in, so visibility is awaited.
    await waitFor(() =>
      expect(drawer.getByRole('region', { name: 'Notification feed' })).toBeVisible()
    )
    await expect(drawer.getAllByText('Notifications', { exact: true })).toHaveLength(1)
    const row = await drawer.findByText(`New application for ${STORY_CAMPAIGN.name}`)
    await waitFor(() => expect(row).toBeVisible())
    await waitFor(() => expect(writesTo(api.notifications.markAllSeen)).toHaveLength(1))

    await userEvent.click(drawer.getByRole('button', { name: /close/i }))
    await waitFor(() => expect(bell).toHaveFocus())
  }
}

export const MobilePage: Story = {
  args: {
    children: <NotificationsPage />,
    currentPath: '/notifications'
  },
  parameters: { viewport: { defaultViewport: 'mobile1' } },
  play: async ({ canvas, canvasElement }) => {
    await expect(
      await canvas.findByRole('heading', { name: 'Notifications', level: 1 })
    ).toBeVisible()
    await expect(
      await canvas.findByText(`New application for ${STORY_CAMPAIGN.name}`)
    ).toBeVisible()
    await expect(canvas.getByRole('link', { name: /Notifications/ })).toBeVisible()
    const footer = canvas.getByRole('contentinfo', { name: 'App navigation' })
    await expect(footer.querySelectorAll('a, button')).toHaveLength(5)
    const { body, documentElement } = canvasElement.ownerDocument
    await expect(body.scrollWidth - body.clientWidth).toBeLessThanOrEqual(1)
    await expect(documentElement.scrollWidth - documentElement.clientWidth).toBeLessThanOrEqual(1)
  }
}

/** The second identity: the peer's bell shows the reader's invitation. */
export const InvitedPeer: Story = {
  args: { userEmail: reviewAccountEmail(STORY_ACCOUNTS.peer) },
  parameters: { storyAccount: 'peer' },
  play: async ({ canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body)
    await userEvent.click(await page.findByRole('button', { name: 'Notifications, 1 new' }))
    const drawer = within(await page.findByRole('dialog', { name: 'Notifications' }))
    // The feed re-renders as it loads, so the row is looked up again until it is stable and visible.
    await waitFor(
      () =>
        expect(drawer.getByText(`Invitation from @${REVIEW_STORY_READER.username}`)).toBeVisible(),
      { timeout: 15_000 }
    )
  }
}
