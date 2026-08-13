import { describe, expect, it } from 'vitest'
import {
  notificationFeedDtoSchema,
  notificationIntentDataSchema,
  notificationPreferencesDtoSchema,
  updateNotificationPreferencesInputSchema,
  notificationWorkflowKeySchema
} from '../api/notifications.js'

const occurredAt = '2026-08-11T12:00:00.000Z'
const sourcePublicId = '00000000-0000-4000-8000-000000000001'
const listingPublicId = '00000000-0000-4000-8000-000000000002'

describe('notification contracts', () => {
  it('keeps the supported Social and Campaign workflow set fixed', () => {
    expect(notificationWorkflowKeySchema.options).toEqual([
      'social-application-submitted',
      'social-application-decided',
      'social-invitation-received',
      'social-invitation-decided',
      'campaign-announcement'
    ])
  })

  it('accepts only the minimal safe payload fields', () => {
    const safePayload = {
      kind: 'SOCIAL_APPLICATION_SUBMITTED' as const,
      sourcePublicId,
      listingPublicId,
      listingTitle: 'Friday table',
      applicantUsername: 'player-user',
      occurredAt
    }

    expect(notificationIntentDataSchema.parse(safePayload)).toEqual(safePayload)
    for (const forbidden of [
      'email',
      'emailHtml',
      'emailSubject',
      'emailText',
      'message',
      'authId',
      'session',
      'campaignContent'
    ]) {
      expect(
        notificationIntentDataSchema.safeParse({ ...safePayload, [forbidden]: 'private-value' })
          .success
      ).toBe(false)
    }
  })

  it('keeps feed data safe and bounded to the latest twenty-five entries', () => {
    expect(
      notificationFeedDtoSchema.parse({
        items: [
          {
            id: sourcePublicId,
            workflowKey: 'campaign-announcement',
            sourceKind: 'CAMPAIGN_ANNOUNCEMENT',
            sourcePublicId,
            groupingKey: null,
            data: {
              kind: 'CAMPAIGN_ANNOUNCEMENT',
              announcementPublicId: sourcePublicId,
              campaignPublicId: 'campaign-abc',
              summary: 'Session starts at seven.',
              scope: 'TABLE',
              occurredAt
            },
            occurredAt,
            seenAt: null,
            readAt: null
          }
        ],
        unseenCount: 1
      })
    ).toMatchObject({ unseenCount: 1 })
  })

  it('requires both channel choices for each notification category', () => {
    expect(
      notificationPreferencesDtoSchema.parse({
        social: { inApp: true, email: false },
        campaign: { inApp: true, email: true }
      })
    ).toEqual({
      social: { inApp: true, email: false },
      campaign: { inApp: true, email: true }
    })
  })

  it('updates exactly one notification category at a time', () => {
    expect(
      updateNotificationPreferencesInputSchema.parse({
        category: 'CAMPAIGN',
        inApp: false,
        email: true
      })
    ).toEqual({ category: 'CAMPAIGN', inApp: false, email: true })
  })
})
