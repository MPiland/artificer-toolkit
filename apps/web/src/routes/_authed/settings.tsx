import { Outlet, createFileRoute } from '@tanstack/react-router'
import { SettingsLayout } from '#app/settings/SettingsLayout'

export const Route = createFileRoute('/_authed/settings')({
  component: SettingsRouteLayout
})

function SettingsRouteLayout() {
  const { user } = Route.useRouteContext()

  return (
    <SettingsLayout email={user?.email ?? 'Account'}>
      <Outlet />
    </SettingsLayout>
  )
}
