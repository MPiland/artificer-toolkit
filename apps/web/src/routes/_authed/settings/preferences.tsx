import { createFileRoute } from '@tanstack/react-router'
import { PreferencesSettingsPage } from '#app/settings/PreferencesSettingsPage'

export const Route = createFileRoute('/_authed/settings/preferences')({
  component: PreferencesSettingsRoute
})

function PreferencesSettingsRoute() {
  return <PreferencesSettingsPage />
}
