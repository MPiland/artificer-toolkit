import { Outlet, createFileRoute, redirect, useLocation } from '@tanstack/react-router'
import { Shell, platformNavigation } from '#app/shell'
import { authoringSearchSchema } from '#app/forms/layout/authoringSearch'

export const Route = createFileRoute('/_authed')({
  validateSearch: authoringSearchSchema,
  beforeLoad: ({ context }) => {
    if (!context.user) {
      throw redirect({ to: '/sign-in' })
    }
  },
  component: AuthedLayout
})

function AuthedLayout() {
  const { featureFlags, user } = Route.useRouteContext()
  const location = useLocation()

  return (
    <Shell
      navigation={platformNavigation}
      currentPath={location.pathname}
      isAuthenticated={Boolean(user)}
      publicSignUpEnabled={featureFlags?.publicSignUpEnabled}
      userEmail={user?.email}
    >
      <Outlet />
    </Shell>
  )
}
