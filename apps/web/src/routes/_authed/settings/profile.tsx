import { createFileRoute } from '@tanstack/react-router'
import { ProfileSettingsPage } from '#app/settings/ProfileSettingsPage'

export const Route = createFileRoute('/_authed/settings/profile')({
  component: ProfileSettingsPage
})
