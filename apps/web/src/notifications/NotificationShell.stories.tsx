import type { Meta, StoryObj } from '@storybook/tanstack-react'
import { expect, userEvent, within } from 'storybook/test'
import { http, HttpResponse } from 'msw'
import { Shell } from '#app/shell/Shell'
import { storybookNavigation } from '#app/shell/navigation'
import { NotificationsPage } from './NotificationsPage'
import { NotificationsProvider } from './NotificationsProvider'

const recipientId = '00000000-0000-4000-8000-000000000001'
const listingPublicId = '00000000-0000-4000-8000-000000000002'
const applicationPublicId = '00000000-0000-4000-8000-000000000003'
const invitePublicId = '00000000-0000-4000-8000-000000000004'
let unseenCount = 1

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
        http.get('*/api/trpc/notifications.session,media.getImage', () =>
          HttpResponse.json([
            {
              result: {
                data: {
                  recipientId,
                  subscriberHash: 'a'.repeat(64),
                  applicationIdentifier: 'story-application'
                }
              }
            },
            { result: { data: null } }
          ])
        ),
        http.get('*/api/trpc/notifications.session', () =>
          trpcJson({
            recipientId,
            subscriberHash: 'a'.repeat(64),
            applicationIdentifier: 'story-application'
          })
        ),
        http.get('*/api/trpc/media.getImage', () => trpcJson(null)),
        http.post('*/inbox/session', () =>
          HttpResponse.json({
            data: { token: 'story-token', applicationIdentifier: 'story-application' }
          })
        ),
        http.get('*/inbox/notifications', () =>
          HttpResponse.json({
            data: [
              {
                id: 'application-group',
                transactionId: 'transaction-1',
                body: 'Review the latest applicants.',
                to: { subscriberId: recipientId },
                isRead: false,
                isSeen: false,
                isArchived: false,
                isSnoozed: false,
                data: {
                  kind: 'SOCIAL_APPLICATION_SUBMITTED',
                  sourcePublicId: applicationPublicId,
                  listingPublicId,
                  listingTitle: 'The Glass Harbor',
                  occurredAt: '2026-08-10T15:00:00.000Z',
                  applicantUsername: 'pathfinder',
                  activityCount: 3
                },
                createdAt: '2026-08-10T15:00:00.000Z',
                channelType: 'in_app',
                workflow: {
                  id: 'workflow-1',
                  identifier: 'social-application-submitted',
                  name: 'Social notification',
                  critical: false,
                  severity: 'none',
                  tags: ['social']
                },
                severity: 'none'
              },
              {
                id: 'invitation',
                transactionId: 'transaction-2',
                body: 'You were invited to Lanterns at Dusk.',
                to: { subscriberId: recipientId },
                isRead: true,
                isSeen: true,
                isArchived: false,
                isSnoozed: false,
                data: {
                  kind: 'SOCIAL_INVITATION_RECEIVED',
                  sourcePublicId: invitePublicId,
                  listingPublicId,
                  listingTitle: 'Lanterns at Dusk',
                  occurredAt: '2026-08-09T18:30:00.000Z',
                  hostUsername: 'harbormaster',
                  expiresAt: '2026-08-17T18:30:00.000Z'
                },
                createdAt: '2026-08-09T18:30:00.000Z',
                channelType: 'in_app',
                workflow: {
                  id: 'workflow-2',
                  identifier: 'social-invitation-received',
                  name: 'Social notification',
                  critical: false,
                  severity: 'none',
                  tags: ['social']
                },
                severity: 'none'
              }
            ],
            hasMore: false
          })
        ),
        http.get('*/inbox/notifications/count', () =>
          HttpResponse.json({ data: [{ count: unseenCount, filter: { seen: false } }] })
        ),
        http.post('*/inbox/notifications/seen', () => {
          unseenCount = 0
          return HttpResponse.json({ data: {} })
        })
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
    await expect(page.getByRole('dialog', { name: 'Notifications' })).toBeVisible()
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
