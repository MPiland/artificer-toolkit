import { fireEvent, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { renderWithAppProviders } from '#test/renderWithAppProviders'

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  read: vi.fn(),
  seenAll: vi.fn()
}))

vi.mock('@novu/react', () => ({
  useNotifications: () => ({
    isLoading: false,
    notifications: [
      {
        id: 'notification-1',
        transactionId: 'transaction-1',
        body: 'Ignored provider body',
        to: { subscriberId: 'subscriber-1' },
        isRead: false,
        isSeen: false,
        isArchived: false,
        isSnoozed: false,
        createdAt: '2026-08-10T15:00:00.000Z',
        channelType: 'in_app',
        data: {
          kind: 'SOCIAL_INVITATION_RECEIVED',
          sourcePublicId: '00000000-0000-4000-8000-000000000001',
          listingPublicId: '00000000-0000-4000-8000-000000000002',
          listingTitle: 'The Glass Harbor',
          occurredAt: '2026-08-10T15:00:00.000Z',
          hostUsername: 'harbormaster',
          expiresAt: '2026-08-17T15:00:00.000Z'
        },
        workflow: {
          id: 'workflow-1',
          identifier: 'social-invitation-received',
          name: 'Social notification',
          critical: false,
          severity: 'none'
        },
        severity: 'none'
      }
    ],
    hasMore: true,
    refetch: vi.fn(),
    seenAll: mocks.seenAll
  }),
  useNovu: () => ({ notifications: { read: mocks.read } })
}))

vi.mock('@tanstack/react-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@tanstack/react-router')>()),
  useNavigate: () => mocks.navigate
}))

import { NotificationFeed } from './NotificationFeed'

describe('NotificationFeed', () => {
  it('marks the full provider feed seen and uses Novu read before the typed deep link', async () => {
    const onNavigate = vi.fn()
    mocks.read.mockResolvedValue({})
    mocks.seenAll.mockResolvedValue({})
    renderWithAppProviders(<NotificationFeed onNavigate={onNavigate} />)

    await waitFor(() => {
      expect(mocks.seenAll).toHaveBeenCalledWith()
    })

    fireEvent.click(screen.getByRole('button', { name: /invitation from/i }))

    expect(mocks.read).toHaveBeenCalledWith({ notificationId: 'notification-1' })
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
