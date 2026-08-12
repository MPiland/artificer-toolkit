import { describe, expect, it } from 'vitest'
import { readNotificationChannels, socialWorkflowIdentifiers } from './notificationPreferencesModel'

describe('readNotificationChannels', () => {
  it('defaults both Social Hub channels to enabled', () => {
    expect(readNotificationChannels(undefined)).toEqual({ email: true, inApp: true })
  })

  it('requires every Social workflow to enable each channel', () => {
    const preferences = socialWorkflowIdentifiers.map((identifier) => ({
      workflow: { identifier },
      channels: { email: true, in_app: true }
    }))
    preferences[2] = {
      workflow: { identifier: socialWorkflowIdentifiers[2] },
      channels: { email: false, in_app: true }
    }

    expect(readNotificationChannels(preferences)).toEqual({ email: false, inApp: true })
  })
})
