import { describe, expect, it } from 'vitest'
import { readNotificationChannels } from './notificationPreferencesModel'

describe('readNotificationChannels', () => {
  it('defaults Social channels to enabled when preferences are unavailable', () => {
    expect(readNotificationChannels(undefined, 'SOCIAL')).toEqual({ email: true, inApp: true })
  })

  it('reads the persisted Social category channels', () => {
    expect(
      readNotificationChannels(
        {
          campaign: { email: true, inApp: true },
          social: { email: false, inApp: true }
        },
        'SOCIAL'
      )
    ).toEqual({ email: false, inApp: true })
  })

  it('reads the persisted Campaign category channels', () => {
    expect(
      readNotificationChannels(
        {
          campaign: { email: false, inApp: true },
          social: { email: true, inApp: true }
        },
        'CAMPAIGN'
      )
    ).toEqual({ email: false, inApp: true })
  })
})
