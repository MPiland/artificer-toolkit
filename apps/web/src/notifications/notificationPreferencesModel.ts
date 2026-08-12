export const socialWorkflowIdentifiers = [
  'social-application-submitted',
  'social-application-decided',
  'social-invitation-received',
  'social-invitation-decided'
] as const

export interface ChannelPreferences {
  email: boolean
  inApp: boolean
}

export interface NotificationPreferencesViewProps {
  channels: ChannelPreferences
  error?: string
  isSaving?: boolean
  onChange?: (channels: ChannelPreferences) => void
}

interface SocialPreference {
  channels: { email?: boolean; in_app?: boolean }
  workflow?: { identifier: string }
}

export function readNotificationChannels(
  preferences: readonly SocialPreference[] | undefined
): ChannelPreferences {
  return {
    email: socialWorkflowIdentifiers.every(
      (identifier) =>
        preferences?.find((preference) => preference.workflow?.identifier === identifier)?.channels
          .email !== false
    ),
    inApp: socialWorkflowIdentifiers.every(
      (identifier) =>
        preferences?.find((preference) => preference.workflow?.identifier === identifier)?.channels
          .in_app !== false
    )
  }
}
