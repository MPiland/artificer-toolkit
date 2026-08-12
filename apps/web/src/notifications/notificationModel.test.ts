import { ChannelType, SeverityLevelEnum } from '@novu/js'
import { describe, expect, it } from 'vitest'
import {
  notificationBellLabel,
  notificationHistoryLimit,
  toNotificationViewModel
} from './notificationModel'

const sourcePublicId = '00000000-0000-4000-8000-000000000001'
const listingPublicId = '00000000-0000-4000-8000-000000000002'

describe('toNotificationViewModel', () => {
  it('maps validated Novu data to a typed internal destination without provider workflow metadata', () => {
    const result = toNotificationViewModel(
      notification(
        'social-invitation-received',
        {
          kind: 'SOCIAL_INVITATION_RECEIVED',
          sourcePublicId,
          listingPublicId,
          listingTitle: 'The Glass Harbor',
          occurredAt: '2026-08-10T15:00:00.000Z',
          hostUsername: 'harbormaster',
          expiresAt: '2026-08-17T15:00:00.000Z'
        },
        false
      )
    )

    expect(result).toMatchObject({
      title: 'Invitation from @harbormaster',
      destination: { kind: 'MY_INVITATION', invitePublicId: sourcePublicId }
    })
  })

  it('renders a validated application digest count without trusting provider copy', () => {
    const result = toNotificationViewModel(
      notification('social-application-submitted', {
        kind: 'SOCIAL_APPLICATION_SUBMITTED',
        sourcePublicId,
        listingPublicId,
        listingTitle: 'The Glass Harbor',
        occurredAt: '2026-08-10T15:00:00.000Z',
        applicantUsername: 'pathfinder',
        activityCount: 3
      })
    )

    expect(result).toMatchObject({
      title: '3 new applications for The Glass Harbor',
      body: 'Review 3 new applicants.'
    })
  })

  it('does not navigate when the Novu workflow and validated data disagree', () => {
    const result = toNotificationViewModel(
      notification('social-application-decided', {
        kind: 'SOCIAL_INVITATION_RECEIVED',
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

  it('maps Campaign announcements without trusting private provider copy', () => {
    const result = toNotificationViewModel(
      notification('campaign-announcement', {
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
  it('uses a new-item badge and a 25-item history window', () => {
    expect(notificationBellLabel(3)).toBe('Notifications, 3 new')
    expect(notificationHistoryLimit).toBe(25)
  })
})

function notification(
  workflowIdentifier: string,
  data: Record<string, unknown>,
  includeWorkflow = true
) {
  return {
    id: 'notification-1',
    transactionId: 'transaction-1',
    body: 'Ignored provider body',
    to: { subscriberId: 'subscriber-1' },
    isRead: false,
    isSeen: false,
    isArchived: false,
    isSnoozed: false,
    createdAt: '2026-08-10T15:00:00.000Z',
    channelType: ChannelType.IN_APP,
    data,
    ...(includeWorkflow
      ? {
          workflow: {
            id: 'workflow-1',
            identifier: workflowIdentifier,
            name: 'Social notification',
            critical: false,
            severity: SeverityLevelEnum.NONE,
            tags: ['social']
          }
        }
      : {}),
    severity: SeverityLevelEnum.NONE
  }
}
