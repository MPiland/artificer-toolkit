import { Outlet, createFileRoute, redirect, useLocation, useMatches } from '@tanstack/react-router'
import { Shell, platformNavigation } from '#app/shell'
import { buildShellBreadcrumbs } from '#app/shell/breadcrumbs'

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
  const breadcrumbs = useMatches({
    select: (matches) =>
      buildShellBreadcrumbs({
        currentPath: location.pathname,
        matches: matches.map((match) => ({
          loaderData: match.loaderData,
          routeId: match.routeId
        })),
        navigation: platformNavigation
      })
  })

  return (
    <Shell
      breadcrumbs={breadcrumbs}
      navigation={platformNavigation}
      currentPath={location.pathname}
      userEmail={user?.email}
    >
      <Outlet />
    </Shell>
  )
}
