import {
  Outlet,
  createFileRoute,
  redirect,
  useMatches,
  useRouterState
} from '@tanstack/react-router'
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
  const currentPath = useMatches({
    select: (matches) => matches.at(-1)?.pathname ?? '/'
  })
  const currentHref = useRouterState({
    select: (state) => (state.resolvedLocation ?? state.location).href
  })

  return (
    <Shell
      navigation={platformNavigation}
      currentHref={currentHref}
      currentPath={currentPath}
      isAuthenticated={Boolean(user)}
      libraryImportEnabled={featureFlags?.libraryImportEnabled}
      publicSignUpEnabled={featureFlags?.publicSignUpEnabled}
      userEmail={user?.email}
    >
      <Outlet />
    </Shell>
  )
}
