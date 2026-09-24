import { createFileRoute } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'
import { accountEmailConfirmationSearchSchema } from '@artificer-toolkit/schema/api/account'
import { AccountSettingsPage } from '#app/settings/AccountSettingsPage'
import { getAccountEntitlementsQuery } from '#app/settings/accountQueries'

export const Route = createFileRoute('/_authed/settings/account')({
  validateSearch: accountEmailConfirmationSearchSchema,
  loader: ({ context }) => context.queryClient.ensureQueryData(getAccountEntitlementsQuery()),
  component: AccountSettingsRoute
})

function AccountSettingsRoute() {
  const { user } = Route.useRouteContext()
  const { emailChanged, error } = Route.useSearch()
  const { data: entitlements } = useSuspenseQuery(getAccountEntitlementsQuery())

  return (
    <AccountSettingsPage
      email={user?.email ?? ''}
      emailChanged={emailChanged === '1'}
      emailConfirmationFailed={error !== undefined}
      entitlements={entitlements}
    />
  )
}
