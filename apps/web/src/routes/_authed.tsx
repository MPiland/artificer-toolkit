import { Outlet, createFileRoute, redirect, useLocation } from '@tanstack/react-router'
import { Shell, platformNavigation } from '#app/shell'

export const Route = createFileRoute('/_authed')({
  beforeLoad: ({ context }) => {
    if (!context.user) {
      throw redirect({ to: '/sign-in' })
    }
  },
  component: AuthedLayout
})

function AuthedLayout() {
  const { user } = Route.useRouteContext()
  const location = useLocation()

  return (
    <Shell
      navigation={platformNavigation}
      currentPath={location.pathname}
      isAuthenticated={Boolean(user)}
      userEmail={user?.email}
    >
      <Outlet />
    </Shell>
  )
}
