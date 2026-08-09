import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { AccountSettingsPage } from '#app/settings/AccountSettingsPage'
import { getAccountEntitlementsQuery } from '#app/settings/accountQueries'
import { createServerApi } from '#app/lib/api'

export const Route = createFileRoute('/_authed/settings/account')({
  validateSearch: z.object({
    emailChanged: z.literal('1').optional()
  }),
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(getAccountEntitlementsQuery(createServerApi())),
  component: AccountSettingsRoute
})

function AccountSettingsRoute() {
  const { user } = Route.useRouteContext()
  const { emailChanged } = Route.useSearch()
  const entitlements = Route.useLoaderData()

  return (
    <AccountSettingsPage
      email={user?.email ?? ''}
      emailChanged={emailChanged === '1'}
      entitlements={entitlements}
    />
  )
}
