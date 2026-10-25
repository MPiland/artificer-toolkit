import {
  Outlet,
  createFileRoute,
  redirect,
  useMatches,
  useRouterState
} from '@tanstack/react-router'
import { Shell, useShellNavigation } from '#app/shell'
import { authoringSearchSchema } from '#app/forms/layout/authoringSearch'
import { hasPendingInvitationSetup } from '#app/auth/invitationStatus'
import { NotificationsProvider } from '#app/notifications/NotificationsProvider'

export const Route = createFileRoute('/_authed')({
  ssr: true,
  validateSearch: authoringSearchSchema,
  beforeLoad: ({ context, location }) => {
    if (!context.user) {
      throw redirect({
        to: '/sign-in',
        search: { redirect: location.href }
      })
    }
    if (hasPendingInvitationSetup(context.user)) {
      throw redirect({ to: '/update-password', search: { flow: 'invite' } })
    }
  },
  component: AuthedLayout
})

function AuthedLayout() {
  const { featureFlags, user } = Route.useRouteContext()
  const currentPath = useMatches({
    select: (matches) => matches.at(-1)?.pathname ?? '/'
  })
  const currentHref = useRouterState({
    select: (state) => (state.resolvedLocation ?? state.location).href
  })
  const navigation = useShellNavigation()
  const isStandaloneTabletop = currentPath.startsWith('/tabletop/')

  return (
    <NotificationsProvider>
      {isStandaloneTabletop ? (
        <Outlet />
      ) : (
        <Shell
          navigation={navigation}
          currentHref={currentHref}
          currentPath={currentPath}
          isAuthenticated={Boolean(user)}
          libraryImportEnabled={featureFlags?.libraryImportEnabled}
          publicSignUpEnabled={featureFlags?.publicSignUpEnabled}
          userEmail={user?.email}
        >
          <Outlet />
        </Shell>
      )}
    </NotificationsProvider>
  )
}
