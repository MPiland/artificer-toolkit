import { fireEvent, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { renderWithAppProviders } from '#test/renderWithAppProviders'

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  feed: vi.fn(),
  markAllSeen: vi.fn(),
  markRead: vi.fn()
}))

vi.mock('#app/data/notifications', () => ({
  notificationFeedQuery: { queryKey: ['native-notification-feed'], queryFn: () => mocks.feed() }
}))

vi.mock('convex/react', async (importOriginal) => {
  const { getFunctionName } = await import('convex/server')
  return {
    ...(await importOriginal<typeof import('convex/react')>()),
    useConvexAuth: () => ({ isAuthenticated: true, isLoading: false }),
    useMutation: (reference: Parameters<typeof getFunctionName>[0]) =>
      getFunctionName(reference) === 'notifications:markAllSeen'
        ? mocks.markAllSeen
        : mocks.markRead
  }
})

vi.mock('@tanstack/react-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@tanstack/react-router')>()),
  useNavigate: () => mocks.navigate
}))

import { NotificationFeed } from './NotificationFeed'

describe('NotificationFeed', () => {
  it('marks the full feed seen and records a read before the typed deep link', async () => {
    const onNavigate = vi.fn()
    mocks.feed.mockResolvedValue({
      items: [
        {
          data: {
            kind: 'SOCIAL_INVITATION_RECEIVED',
            sourcePublicId: '00000000-0000-4000-8000-000000000001',
            listingPublicId: '00000000-0000-4000-8000-000000000002',
            listingTitle: 'The Glass Harbor',
            occurredAt: '2026-08-10T15:00:00.000Z',
            hostUsername: 'harbormaster',
            expiresAt: '2026-08-17T15:00:00.000Z'
          },
          groupingKey: null,
          id: '00000000-0000-4000-8000-000000000003',
          occurredAt: '2026-08-10T15:00:00.000Z',
          readAt: null,
          seenAt: null,
          sourceKind: 'CAMPAIGN_INVITE',
          sourcePublicId: '00000000-0000-4000-8000-000000000001',
          workflowKey: 'social-invitation-received'
        }
      ],
      unseenCount: 1
    })
    mocks.markRead.mockResolvedValue({ ok: true })
    mocks.markAllSeen.mockResolvedValue({ ok: true })
    renderWithAppProviders(<NotificationFeed onNavigate={onNavigate} />)

    await waitFor(() => {
      expect(mocks.markAllSeen).toHaveBeenCalledWith({})
    })

    fireEvent.click(screen.getByRole('button', { name: /invitation from/i }))

    await waitFor(() => {
      expect(mocks.markRead).toHaveBeenCalledWith({ id: '00000000-0000-4000-8000-000000000003' })
    })
    expect(onNavigate).toHaveBeenCalledOnce()
    expect(mocks.navigate).toHaveBeenCalledWith({
      to: '/social',
      search: {
        view: 'invitations',
        invitePublicId: '00000000-0000-4000-8000-000000000001'
      }
    })
  })
})
