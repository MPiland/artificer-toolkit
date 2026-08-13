import {
  Outlet,
  createFileRoute,
  redirect,
  useMatches,
  useRouterState
} from '@tanstack/react-router'
import { Shell, platformNavigation } from '#app/shell'
import { authoringSearchSchema } from '#app/forms/layout/authoringSearch'
import { hasPendingInvitationSetup } from '#app/auth/invitationStatus'
import { NotificationsProvider } from '#app/notifications/NotificationsProvider'

export const Route = createFileRoute('/_authed')({
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
  const { featureFlags, isSuperAdmin, user } = Route.useRouteContext()
  const currentPath = useMatches({
    select: (matches) => matches.at(-1)?.pathname ?? '/'
  })
  const currentHref = useRouterState({
    select: (state) => (state.resolvedLocation ?? state.location).href
  })

  return (
    <NotificationsProvider>
      <Shell
        navigation={platformNavigation}
        currentHref={currentHref}
        currentPath={currentPath}
        isAuthenticated={Boolean(user)}
        isSuperAdmin={isSuperAdmin}
        libraryImportEnabled={featureFlags?.libraryImportEnabled}
        publicSignUpEnabled={featureFlags?.publicSignUpEnabled}
        userEmail={user?.email}
      >
        <Outlet />
      </Shell>
    </NotificationsProvider>
  )
}
