import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { AccountSettingsPage } from '#app/settings/AccountSettingsPage'

export const Route = createFileRoute('/_authed/settings/account')({
  validateSearch: z.object({
    emailChanged: z.literal('1').optional()
  }),
  component: AccountSettingsRoute
})

function AccountSettingsRoute() {
  const { user } = Route.useRouteContext()
  const { emailChanged } = Route.useSearch()

  return <AccountSettingsPage email={user?.email ?? ''} emailChanged={emailChanged === '1'} />
}
