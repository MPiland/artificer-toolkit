import { createFileRoute } from '@tanstack/react-router'
import { ProfileSettingsPage } from '#app/settings/ProfileSettingsPage'

export const Route = createFileRoute('/_authed/settings/profile')({
  component: ProfileSettingsRoute
})

function ProfileSettingsRoute() {
  const { user } = Route.useRouteContext()
  return user ? <ProfileSettingsPage userId={user.userId} /> : null
}
