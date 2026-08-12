import type {
  CampaignInviteRecord,
  DBLike,
  NotificationDeliveryIntentRecord
} from '@artificer-toolkit/db'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  class ApiError extends Error {
    statusCode: number | undefined

    constructor(status?: number) {
      super(status === undefined ? 'Network error' : `HTTP ${status}`)
      this.statusCode = status
    }
  }

  return {
    ApiError,
    trigger: vi.fn(),
    cancel: vi.fn(),
    expireDueInvites: vi.fn(),
    findRecipientIdForUser: vi.fn(),
    insertDeliveryIntent: vi.fn(),
    insertInvitationReceivedCancellations: vi.fn(),
    suppressCancelledDeliveryTriggers: vi.fn(),
    markExhaustedDeliveryIntents: vi.fn(),
    claimDeliveryIntents: vi.fn(),
    markDeliverySucceeded: vi.fn(),
    markDeliveryRetry: vi.fn(),
    markDeliveryFailed: vi.fn()
  }
})

vi.mock('@novu/api', () => {
  class MockNovu {
    trigger = mocks.trigger
    cancel = mocks.cancel
  }
  return { Novu: MockNovu }
})

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
      suppressCancelledDeliveryTriggers: mocks.suppressCancelledDeliveryTriggers,
      markExhaustedDeliveryIntents: mocks.markExhaustedDeliveryIntents,
      claimDeliveryIntents: mocks.claimDeliveryIntents,
      markDeliverySucceeded: mocks.markDeliverySucceeded,
      markDeliveryRetry: mocks.markDeliveryRetry,
      markDeliveryFailed: mocks.markDeliveryFailed
    }),
    withTransaction: (_db: DBLike, callback: (trx: DBLike) => Promise<unknown>) => callback(_db)
  }
})

const {
  createNotificationSession,
  dispatchPendingNotifications,
  enqueueCampaignAnnouncementNotification,
  enqueueInvitationReceivedNotification,
  expireDueCampaignInvitations
} = await import('./notificationService.js')

const now = '2026-08-11T12:00:00.000Z'
const recipientId = '00000000-0000-4000-8000-000000000001'
const sourcePublicId = '00000000-0000-4000-8000-000000000002'
const listingPublicId = '00000000-0000-4000-8000-000000000003'

function claimedIntent(
  overrides: Partial<NotificationDeliveryIntentRecord> = {}
): NotificationDeliveryIntentRecord {
  return {
    id: '00000000-0000-4000-8000-000000000004',
    operation: 'TRIGGER',
    workflowKey: 'social-application-decided',
    sourcePublicId,
    recipientNotificationId: recipientId,
    payload: {
      kind: 'SOCIAL_APPLICATION_DECIDED',
      sourcePublicId,
      listingPublicId,
      listingTitle: 'Friday table',
      decision: 'ACCEPTED',
      occurredAt: now
    },
    attemptCount: 1,
    recipientEmail: null,
    recipientUsername: null,
    ...overrides
  }
}

describe('notification delivery service', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(now)
    mocks.expireDueInvites.mockResolvedValue([])
    mocks.insertInvitationReceivedCancellations.mockResolvedValue(0)
    mocks.suppressCancelledDeliveryTriggers.mockResolvedValue(0)
    mocks.markExhaustedDeliveryIntents.mockResolvedValue(0)
    mocks.claimDeliveryIntents.mockResolvedValue([])
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

  it('returns a recipient-scoped HMAC session without provider tokens', async () => {
    mocks.findRecipientIdForUser.mockResolvedValue(recipientId)

    await expect(
      createNotificationSession({} as DBLike, 'user-id', {
        secretKey: 'secret-key',
        applicationIdentifier: 'application-identifier'
      })
    ).resolves.toEqual({
      recipientId,
      subscriberHash: '3a8cfdb4dd901a74dfe1c1b110187bea9e7f1a0d531fe987a6deb36e78235797',
      applicationIdentifier: 'application-identifier'
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

  it('silently cancels the received workflow when an invitation expires', async () => {
    mocks.expireDueInvites.mockResolvedValue([sourcePublicId])

    await expect(expireDueCampaignInvitations({} as DBLike, now)).resolves.toBe(1)

    expect(mocks.insertInvitationReceivedCancellations).toHaveBeenCalledWith([sourcePublicId], now)
  })

  it('sweeps stale exhausted claims, claims ten at most, and omits absent identity fields', async () => {
    mocks.markExhaustedDeliveryIntents.mockResolvedValue(1)
    mocks.claimDeliveryIntents.mockResolvedValue([claimedIntent()])

    await expect(dispatchPendingNotifications({} as DBLike, 'novu-secret')).resolves.toEqual({
      claimed: 1,
      delivered: 1,
      retried: 0,
      failed: 1,
      expiredInvitations: 0
    })
    expect(mocks.markExhaustedDeliveryIntents).toHaveBeenCalledWith(now, '2026-08-11T11:55:00.000Z')
    expect(mocks.suppressCancelledDeliveryTriggers).toHaveBeenCalledWith(
      now,
      '2026-08-11T11:55:00.000Z'
    )
    expect(mocks.claimDeliveryIntents).toHaveBeenCalledWith({
      limit: 10,
      now,
      staleBefore: '2026-08-11T11:55:00.000Z'
    })
    expect(mocks.trigger).toHaveBeenCalledWith(
      {
        workflowId: 'social-application-decided',
        to: { subscriberId: recipientId },
        payload: claimedIntent().payload,
        transactionId: `social-application-decided:${sourcePublicId}`
      },
      claimedIntent().id
    )
  })

  it('retries network failures with exponential delay below the ten-attempt ceiling', async () => {
    mocks.claimDeliveryIntents.mockResolvedValue([claimedIntent({ attemptCount: 3 })])
    mocks.trigger.mockRejectedValue(new Error('connection reset'))

    const result = await dispatchPendingNotifications({} as DBLike, 'novu-secret')

    expect(result).toMatchObject({ retried: 1, failed: 0 })
    expect(mocks.markDeliveryRetry).toHaveBeenCalledWith({
      intentId: claimedIntent().id,
      nextAttemptAt: '2026-08-11T12:04:00.000Z',
      errorCode: 'NETWORK'
    })
  })

  it('cancels a transaction with the intent idempotency key', async () => {
    mocks.claimDeliveryIntents.mockResolvedValue([
      claimedIntent({ operation: 'CANCEL', payload: {} })
    ])

    await expect(dispatchPendingNotifications({} as DBLike, 'novu-secret')).resolves.toMatchObject({
      delivered: 1
    })
    expect(mocks.cancel).toHaveBeenCalledWith(
      `social-application-decided:${sourcePublicId}`,
      claimedIntent().id
    )
    expect(mocks.trigger).not.toHaveBeenCalled()
  })

  it('sends only the supported Novu subscriber identity fields', async () => {
    mocks.claimDeliveryIntents.mockResolvedValue([
      claimedIntent({
        recipientEmail: 'player@example.com',
        recipientUsername: 'Player'
      })
    ])

    await dispatchPendingNotifications({} as DBLike, 'novu-secret')

    expect(mocks.trigger).toHaveBeenCalledWith(
      expect.objectContaining({
        to: {
          subscriberId: recipientId,
          email: 'player@example.com',
          firstName: 'Player'
        }
      }),
      claimedIntent().id
    )
  })

  it('terminates non-retryable 4xx responses and the tenth provider attempt', async () => {
    mocks.claimDeliveryIntents.mockResolvedValueOnce([claimedIntent()])
    mocks.trigger.mockRejectedValueOnce(new mocks.ApiError(400))

    await expect(dispatchPendingNotifications({} as DBLike, 'novu-secret')).resolves.toMatchObject({
      retried: 0,
      failed: 1
    })
    expect(mocks.markDeliveryFailed).toHaveBeenLastCalledWith(
      expect.objectContaining({ errorCode: 'HTTP_400' })
    )

    vi.clearAllMocks()
    mocks.expireDueInvites.mockResolvedValue([])
    mocks.markExhaustedDeliveryIntents.mockResolvedValue(0)
    mocks.claimDeliveryIntents.mockResolvedValue([claimedIntent({ attemptCount: 10 })])
    mocks.trigger.mockRejectedValue(new Error('connection reset'))

    await expect(dispatchPendingNotifications({} as DBLike, 'novu-secret')).resolves.toMatchObject({
      retried: 0,
      failed: 1
    })
    expect(mocks.markDeliveryRetry).not.toHaveBeenCalled()
    expect(mocks.markDeliveryFailed).toHaveBeenLastCalledWith(
      expect.objectContaining({ errorCode: 'NETWORK' })
    )
  })

  it('fails malformed trigger payloads without calling Novu', async () => {
    mocks.claimDeliveryIntents.mockResolvedValue([claimedIntent({ payload: { email: 'private' } })])

    await expect(dispatchPendingNotifications({} as DBLike, 'novu-secret')).resolves.toMatchObject({
      delivered: 0,
      failed: 1
    })
    expect(mocks.trigger).not.toHaveBeenCalled()
    expect(mocks.markDeliveryFailed).toHaveBeenCalledWith(
      expect.objectContaining({ errorCode: 'INVALID_PAYLOAD' })
    )
  })
})
