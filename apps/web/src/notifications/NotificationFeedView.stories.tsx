import type { Meta, StoryObj } from '@storybook/tanstack-react'
import { NotificationFeedView } from './NotificationFeedView'
import * as styles from './notifications.css'

const meta = {
  title: 'Shell/Notifications/Feed',
  component: NotificationFeedView,
  decorators: [
    (Story) => (
      <div className={styles.page}>
        <Story />
      </div>
    )
  ],
  args: {
    items: [
      {
        body: 'Review the latest applicants.',
        destination: {
          kind: 'HOST_APPLICATIONS',
          listingPublicId: '00000000-0000-4000-8000-000000000002'
        },
        id: 'application-group',
        insertedAt: '2026-08-10T15:00:00.000Z',
        isRead: false,
        title: '3 new applications for The Glass Harbor'
      },
      {
        body: 'You were invited to Lanterns at Dusk.',
        destination: {
          kind: 'MY_INVITATION',
          invitePublicId: '00000000-0000-4000-8000-000000000003'
        },
        id: 'invitation',
        insertedAt: '2026-08-09T18:30:00.000Z',
        isRead: true,
        title: 'Invitation from @harbormaster'
      }
    ],
    onExplore: () => undefined,
    onOpen: () => undefined
  }
} satisfies Meta<typeof NotificationFeedView>

export default meta

type Story = StoryObj<typeof meta>

export const GroupedUnread: Story = {}

export const Empty: Story = {
  args: { items: [] }
}

export const Error: Story = {
  args: { isError: true, items: [], onRetry: () => undefined }
}

export const Loading: Story = {
  args: { isLoading: true, items: [] }
}

export const Malformed: Story = {
  args: {
    items: [
      {
        body: 'This notification can no longer be displayed.',
        id: 'malformed-notification',
        insertedAt: '2026-08-10T15:00:00.000Z',
        isRead: false,
        title: 'Notification unavailable'
      }
    ]
  }
}

export const Mobile: Story = {
  parameters: { viewport: { defaultViewport: 'mobile1' } }
}
