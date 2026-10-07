import { screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { notificationFeedDtoSchema } from '@artificer-toolkit/schema/api/notifications'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import { useNotificationAvailability, useNotificationUnseenCount } from './notificationContext'
import { NotificationsProvider } from './NotificationsProvider'

const mocks = vi.hoisted(() => ({ authenticated: false, feed: vi.fn() }))
vi.mock('#app/data/notifications', () => ({
  notificationFeedQuery: { queryKey: ['native-feed'], queryFn: () => mocks.feed() }
}))
vi.mock('convex/react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('convex/react')>()),
  useConvexAuth: () => ({ isAuthenticated: mocks.authenticated, isLoading: !mocks.authenticated })
}))

function Status() {
  return (
    <p>
      {useNotificationAvailability()}:{useNotificationUnseenCount()}
    </p>
  )
}

describe('native notification subscription', () => {
  it('waits for verified Convex auth, subscribes when ready, and hides data after auth loss', async () => {
    mocks.feed.mockResolvedValue(notificationFeedDtoSchema.parse({ items: [], unseenCount: 3 }))
    const { rerender } = renderWithAppProviders(
      <NotificationsProvider>
        <Status />
      </NotificationsProvider>
    )
    expect(screen.getByText('loading:0')).toBeInTheDocument()
    expect(mocks.feed).not.toHaveBeenCalled()
    mocks.authenticated = true
    rerender(
      <NotificationsProvider>
        <Status />
      </NotificationsProvider>
    )
    await waitFor(() => expect(screen.getByText('ready:3')).toBeInTheDocument())
    mocks.authenticated = false
    rerender(
      <NotificationsProvider>
        <Status />
      </NotificationsProvider>
    )
    expect(screen.getByText('loading:0')).toBeInTheDocument()
  })
})
