import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import { NotificationFeedView } from './NotificationFeedView'

describe('NotificationFeedView', () => {
  it('renders one actionable unread row without inbox-management controls', () => {
    const onOpen = vi.fn()
    renderWithAppProviders(
      <NotificationFeedView
        items={[
          {
            body: 'You were invited to The Glass Harbor.',
            destination: {
              kind: 'MY_INVITATION',
              invitePublicId: '00000000-0000-4000-8000-000000000001'
            },
            id: 'feed-item-1',
            insertedAt: '2026-08-10T15:00:00.000Z',
            isRead: false,
            title: 'Invitation from @harbormaster'
          }
        ]}
        onOpen={onOpen}
      />
    )

    const row = screen.getByRole('article')
    expect(row).toHaveAttribute('data-unread', 'true')
    fireEvent.click(screen.getByRole('button', { name: /invitation from/i }))
    expect(onOpen).toHaveBeenCalledOnce()
    expect(screen.queryByRole('button', { name: /mark|archive|load older/i })).toBeNull()
  })

  it('renders a read notification without unread emphasis', () => {
    renderWithAppProviders(
      <NotificationFeedView
        items={[
          {
            body: 'Your application was accepted.',
            id: 'feed-item-2',
            insertedAt: '2026-08-10T15:00:00.000Z',
            isRead: true,
            title: 'Application accepted'
          }
        ]}
      />
    )

    expect(screen.getByRole('article')).not.toHaveAttribute('data-unread')
  })

  it('renders malformed notifications without an open action', () => {
    renderWithAppProviders(
      <NotificationFeedView
        items={[
          {
            body: 'This notification can no longer be displayed.',
            id: 'feed-item-2',
            insertedAt: '2026-08-10T15:00:00.000Z',
            isRead: true,
            title: 'Notification unavailable'
          }
        ]}
      />
    )

    expect(screen.queryByRole('button', { name: /notification unavailable/i })).toBeNull()
    expect(screen.getByText('Notification unavailable')).toBeVisible()
  })

  it('offers a retry action when loading fails', () => {
    const onRetry = vi.fn()
    renderWithAppProviders(<NotificationFeedView isError items={[]} onRetry={onRetry} />)

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(onRetry).toHaveBeenCalledOnce()
  })

  it('offers a path into Social Hub when the feed is empty', () => {
    const onExplore = vi.fn()
    renderWithAppProviders(<NotificationFeedView items={[]} onExplore={onExplore} />)

    fireEvent.click(screen.getByRole('button', { name: 'Explore Social Hub' }))
    expect(onExplore).toHaveBeenCalledOnce()
  })
})
