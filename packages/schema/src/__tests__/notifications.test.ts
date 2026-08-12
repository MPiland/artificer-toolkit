import { describe, expect, it } from 'vitest'
import {
  notificationIntentDataSchema,
  notificationSessionDtoSchema,
  notificationWorkflowKeySchema
} from '../api/notifications.js'

const occurredAt = '2026-08-11T12:00:00.000Z'
const sourcePublicId = '00000000-0000-4000-8000-000000000001'
const listingPublicId = '00000000-0000-4000-8000-000000000002'

describe('notification contracts', () => {
  it('keeps the workflow set fixed to the four Social Hub workflows', () => {
    expect(notificationWorkflowKeySchema.options).toEqual([
      'social-application-submitted',
      'social-application-decided',
      'social-invitation-received',
      'social-invitation-decided'
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

  it('accepts the Novu subscriber hash without exposing server secrets', () => {
    expect(
      notificationSessionDtoSchema.parse({
        recipientId: sourcePublicId,
        subscriberHash: 'a'.repeat(64),
        applicationIdentifier: 'application-identifier'
      })
    ).toEqual({
      recipientId: sourcePublicId,
      subscriberHash: 'a'.repeat(64),
      applicationIdentifier: 'application-identifier'
    })
  })
})
