import { describe, expect, it } from 'vitest'
import { notificationBellLabel, toNotificationViewModel } from './notificationModel'

const sourcePublicId = '00000000-0000-4000-8000-000000000001'
const listingPublicId = '00000000-0000-4000-8000-000000000002'

describe('toNotificationViewModel', () => {
  it('maps validated feed data to a typed internal destination', () => {
    const result = toNotificationViewModel(
      notification({
        kind: 'SOCIAL_INVITATION_RECEIVED',
        sourcePublicId,
        listingPublicId,
        listingTitle: 'The Glass Harbor',
        occurredAt: '2026-08-10T15:00:00.000Z',
        hostUsername: 'harbormaster',
        expiresAt: '2026-08-17T15:00:00.000Z'
      })
    )

    expect(result).toMatchObject({
      title: 'Invitation from @harbormaster',
      destination: { kind: 'MY_INVITATION', invitePublicId: sourcePublicId }
    })
  })

  it('renders a validated application without trusting stored presentation copy', () => {
    const result = toNotificationViewModel(
      notification({
        kind: 'SOCIAL_APPLICATION_SUBMITTED',
        sourcePublicId,
        listingPublicId,
        listingTitle: 'The Glass Harbor',
        occurredAt: '2026-08-10T15:00:00.000Z',
        applicantUsername: 'pathfinder'
      })
    )

    expect(result).toMatchObject({
      title: 'New application for The Glass Harbor',
      body: 'Review the latest applicant.'
    })
  })

  it('does not navigate when the feed data is malformed', () => {
    const result = toNotificationViewModel(
      notification({
        kind: 'SOCIAL_INVITATION_RECEIVED_INVALID',
        sourcePublicId,
        listingPublicId,
        listingTitle: 'The Glass Harbor',
        occurredAt: '2026-08-10T15:00:00.000Z',
        hostUsername: 'harbormaster',
        expiresAt: '2026-08-17T15:00:00.000Z'
      })
    )

    expect(result.title).toBe('Notification unavailable')
    expect(result.destination).toBeUndefined()
  })

  it('maps Campaign announcements without trusting private delivery copy', () => {
    const result = toNotificationViewModel(
      notification({
        kind: 'CAMPAIGN_ANNOUNCEMENT',
        announcementPublicId: sourcePublicId,
        campaignPublicId: 'campaign-public-id',
        summary: 'The next Session starts an hour later.',
        scope: 'TABLE',
        occurredAt: '2026-08-10T15:00:00.000Z'
      })
    )

    expect(result).toMatchObject({
      title: 'Campaign announcement',
      body: 'The next Session starts an hour later.',
      destination: {
        kind: 'CAMPAIGN_ANNOUNCEMENT',
        announcementPublicId: sourcePublicId,
        campaignPublicId: 'campaign-public-id'
      }
    })
  })
})

describe('notification feed presentation', () => {
  it('uses a new-item badge', () => {
    expect(notificationBellLabel(3)).toBe('Notifications, 3 new')
  })
})

function notification(data: Record<string, unknown>) {
  return {
    id: '00000000-0000-4000-8000-000000000003',
    workflowKey: 'social-invitation-received',
    sourceKind: 'CAMPAIGN_INVITE',
    sourcePublicId,
    groupingKey: null,
    data,
    occurredAt: '2026-08-10T15:00:00.000Z',
    seenAt: null,
    readAt: null
  }
}
