import { Outlet, createFileRoute, redirect, useLocation } from '@tanstack/react-router'
import { Shell, platformNavigation } from '#app/shell'
import { authoringSearchSchema } from '#app/forms/layout/authoringSearch'
import { getAccountProfileRedirect } from '#app/settings/accountProfileGuard'

export const Route = createFileRoute('/_authed')({
  validateSearch: authoringSearchSchema,
  beforeLoad: async ({ context }) => {
    const target = await getAccountProfileRedirect(context)
    if (target === 'sign-in') throw redirect({ to: '/sign-in' })
    if (target === 'invite') {
      throw redirect({ to: '/update-password', search: { flow: 'invite' } })
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
