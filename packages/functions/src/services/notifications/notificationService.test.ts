import type {
  CampaignInviteRecord,
  DBLike,
  NotificationFeedItemRecord,
  NotificationPreferencesRecord
} from '@artificer-toolkit/db'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  expireDueInvites: vi.fn(),
  findRecipientIdForUser: vi.fn(),
  insertDeliveryIntent: vi.fn(),
  insertInvitationReceivedCancellations: vi.fn(),
  markAllFeedItemsSeen: vi.fn(),
  markFeedItemRead: vi.fn(),
  getPreferences: vi.fn(),
  updatePreferences: vi.fn(),
  listFeed: vi.fn(),
  countUnseenFeedItems: vi.fn()
}))

vi.mock('@artificer-toolkit/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@artificer-toolkit/db')>()
  return {
    ...actual,
    createCampaignRepository: () => ({
      expireDueInvites: mocks.expireDueInvites
    }),
    createNotificationRepository: () => ({
      findRecipientIdForUser: mocks.findRecipientIdForUser,
      insertDeliveryIntent: mocks.insertDeliveryIntent,
      insertInvitationReceivedCancellations: mocks.insertInvitationReceivedCancellations,
      markAllFeedItemsSeen: mocks.markAllFeedItemsSeen,
      markFeedItemRead: mocks.markFeedItemRead,
      getPreferences: mocks.getPreferences,
      updatePreferences: mocks.updatePreferences,
      listFeed: mocks.listFeed,
      countUnseenFeedItems: mocks.countUnseenFeedItems
    }),
    withTransaction: (_db: DBLike, callback: (trx: DBLike) => Promise<unknown>) => callback(_db)
  }
})

const {
  enqueueCampaignAnnouncementNotification,
  enqueueInvitationReceivedNotification,
  expireDueCampaignInvitations,
  getNotificationFeed,
  getNotificationPreferences,
  markAllNotificationsSeen,
  markNotificationRead,
  updateNotificationPreferences
} = await import('./notificationService.js')

const now = '2026-08-11T12:00:00.000Z'
const recipientId = '00000000-0000-4000-8000-000000000001'
const sourcePublicId = '00000000-0000-4000-8000-000000000002'
const listingPublicId = '00000000-0000-4000-8000-000000000003'

function nowFeedItem(
  overrides: Partial<NotificationFeedItemRecord> = {}
): NotificationFeedItemRecord {
  return {
    id: '00000000-0000-4000-8000-000000000004',
    workflowKey: 'campaign-announcement',
    sourceKind: 'CAMPAIGN_ANNOUNCEMENT',
    sourcePublicId,
    groupingKey: null,
    payload: {
      kind: 'CAMPAIGN_ANNOUNCEMENT',
      announcementPublicId: sourcePublicId,
      campaignPublicId: listingPublicId,
      summary: 'A new Campaign announcement is available.',
      scope: 'PARTY',
      occurredAt: now
    },
    occurredAt: now,
    seenAt: null,
    readAt: null,
    ...overrides
  }
}

describe('notification delivery service', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(now)
    mocks.findRecipientIdForUser.mockResolvedValue(recipientId)
    mocks.expireDueInvites.mockResolvedValue([])
    mocks.insertDeliveryIntent.mockResolvedValue('00000000-0000-4000-8000-000000000999')
    mocks.insertInvitationReceivedCancellations.mockResolvedValue(1)
    mocks.markAllFeedItemsSeen.mockResolvedValue(1)
    mocks.markFeedItemRead.mockResolvedValue(true)
    mocks.getPreferences.mockResolvedValue({
      social: { inApp: true, email: true },
      campaign: { inApp: true, email: true }
    })
    mocks.updatePreferences.mockResolvedValue({
      social: { inApp: false, email: true },
      campaign: { inApp: true, email: false }
    })
    mocks.listFeed.mockResolvedValue([nowFeedItem()])
    mocks.countUnseenFeedItems.mockResolvedValue(1)
  })

  it('enqueues Campaign announcements with generic ID-only copy', async () => {
    await enqueueCampaignAnnouncementNotification({} as DBLike, {
      announcementPublicId: sourcePublicId,
      campaignPublicId: listingPublicId,
      recipientUserId: recipientId,
      scope: 'PARTY',
      occurredAt: now
    })

    expect(mocks.insertDeliveryIntent).toHaveBeenCalledWith({
      operation: 'TRIGGER',
      workflowKey: 'campaign-announcement',
      sourceKind: 'CAMPAIGN_ANNOUNCEMENT',
      sourcePublicId,
      recipientUserId: recipientId,
      payload: {
        kind: 'CAMPAIGN_ANNOUNCEMENT',
        announcementPublicId: sourcePublicId,
        campaignPublicId: listingPublicId,
        summary: 'A new Campaign announcement is available.',
        scope: 'PARTY',
        occurredAt: now
      },
      occurredAt: now
    })
  })

  it('stores notification listing titles through the Standard text projection', async () => {
    const invitation: CampaignInviteRecord = {
      id: sourcePublicId,
      listingId: listingPublicId,
      campaignId: '00000000-0000-4000-8000-000000000005',
      createdBy: '00000000-0000-4000-8000-000000000006',
      recipientUserId: '00000000-0000-4000-8000-000000000007',
      recipientUsername: 'Player',
      listingVersion: 1,
      status: 'PENDING',
      expiresAt: '2026-08-12T12:00:00.000Z',
      respondedAt: null,
      revokedAt: null,
      expiredAt: null,
      createdAt: now,
      updatedAt: now,
      version: 1
    }

    await enqueueInvitationReceivedNotification({} as DBLike, invitation, {
      listingTitle: 'The shitstorm citadel',
      hostUsername: 'Host',
      occurredAt: now
    })

    expect(mocks.insertDeliveryIntent).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          listingTitle: 'The ****storm citadel'
        })
      })
    )
  })

  it('records due invitation expiry as a cancellation intent', async () => {
    mocks.expireDueInvites.mockResolvedValue([sourcePublicId])

    await expect(expireDueCampaignInvitations({} as DBLike, now)).resolves.toBe(1)

    expect(mocks.insertInvitationReceivedCancellations).toHaveBeenCalledWith([sourcePublicId], now)
  })

  it('maps feed payloads and unseen count', async () => {
    const feedItem = nowFeedItem()
    mocks.listFeed.mockResolvedValue([feedItem])
    mocks.countUnseenFeedItems.mockResolvedValue(7)

    await expect(getNotificationFeed({} as DBLike, recipientId)).resolves.toEqual({
      unseenCount: 7,
      items: [
        {
          id: feedItem.id,
          workflowKey: feedItem.workflowKey,
          sourceKind: feedItem.sourceKind,
          sourcePublicId: feedItem.sourcePublicId,
          groupingKey: null,
          data: feedItem.payload,
          occurredAt: feedItem.occurredAt,
          seenAt: null,
          readAt: null
        }
      ]
    })
    expect(mocks.listFeed).toHaveBeenCalledWith(recipientId)
    expect(mocks.countUnseenFeedItems).toHaveBeenCalledWith(recipientId)
  })

  it('throws when a feed payload fails schema parsing', async () => {
    mocks.listFeed.mockResolvedValue([
      {
        ...nowFeedItem(),
        payload: {
          kind: 'CAMPAIGN_ANNOUNCEMENT',
          announcementPublicId: sourcePublicId,
          campaignPublicId: listingPublicId
        }
      }
    ])

    await expect(getNotificationFeed({} as DBLike, recipientId)).rejects.toThrow()
  })

  it('delegates markAllNotificationsSeen with a timestamp', async () => {
    await markAllNotificationsSeen({} as DBLike, recipientId)

    expect(mocks.markAllFeedItemsSeen).toHaveBeenCalledWith(recipientId, now)
  })

  it('marks a notification read and throws when the target row is unavailable', async () => {
    mocks.markFeedItemRead.mockResolvedValue(false)
    await expect(markNotificationRead({} as DBLike, recipientId, 'item-1')).rejects.toThrow(
      'Notification is unavailable.'
    )

    mocks.markFeedItemRead.mockResolvedValueOnce(true)
    await expect(markNotificationRead({} as DBLike, recipientId, 'item-1')).resolves.toBeUndefined()
    expect(mocks.markFeedItemRead).toHaveBeenLastCalledWith({
      userId: recipientId,
      feedItemId: 'item-1',
      readAt: now
    })
  })

  it('delegates preference lookup to the repository', async () => {
    const preferences: NotificationPreferencesRecord = {
      social: { inApp: true, email: false },
      campaign: { inApp: false, email: true }
    }
    mocks.getPreferences.mockResolvedValue(preferences)

    await expect(getNotificationPreferences({} as DBLike, recipientId)).resolves.toEqual(
      preferences
    )
    expect(mocks.getPreferences).toHaveBeenCalledWith(recipientId)
  })

  it('delegates preference update with timestamp and normalized payload', async () => {
    const updated: NotificationPreferencesRecord = {
      social: { inApp: true, email: true },
      campaign: { inApp: true, email: false }
    }
    mocks.updatePreferences.mockResolvedValue(updated)

    await expect(
      updateNotificationPreferences({} as DBLike, recipientId, {
        category: 'SOCIAL',
        inApp: true,
        email: true
      })
    ).resolves.toEqual(updated)

    expect(mocks.updatePreferences).toHaveBeenCalledWith({
      userId: recipientId,
      category: 'SOCIAL',
      inApp: true,
      email: true,
      updatedAt: now
    })
  })
})
