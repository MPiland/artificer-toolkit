export interface ChannelPreferences {
  email: boolean
  inApp: boolean
}

export interface NotificationPreferencesViewProps {
  channels: ChannelPreferences
  label: string
  error?: string
  isSaving?: boolean
  onChange?: (channels: ChannelPreferences) => void
}

export function readNotificationChannels(
  preferences: NotificationPreferencesDto | undefined,
  category: 'SOCIAL' | 'CAMPAIGN'
): ChannelPreferences {
  return (
    preferences?.[category === 'SOCIAL' ? 'social' : 'campaign'] ?? {
      email: true,
      inApp: true
    }
  )
}
import type { NotificationPreferencesDto } from '@artificer-toolkit/schema/api/notifications'
