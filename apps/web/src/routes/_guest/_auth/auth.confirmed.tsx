import { createFileRoute } from '@tanstack/react-router'
import { authEmailConfirmationSearchSchema } from '@artificer-toolkit/schema/api/auth'
import { AuthConfirmedPage } from '#app/auth/pages'

export const Route = createFileRoute('/_guest/_auth/auth/confirmed')({
  validateSearch: authEmailConfirmationSearchSchema,
  component: AuthConfirmedRoute
})

function AuthConfirmedRoute() {
  const search = Route.useSearch()
  return <AuthConfirmedPage verificationFailed={search.error !== undefined} />
}
