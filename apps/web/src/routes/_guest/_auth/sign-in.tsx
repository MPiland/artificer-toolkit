import { createFileRoute } from '@tanstack/react-router'
import { SignInPage } from '#app/auth/pages'
import { signInRedirectSearchSchema } from './-signInRedirect'

export const Route = createFileRoute('/_guest/_auth/sign-in')({
  validateSearch: signInRedirectSearchSchema,
  component: SignInRoute
})

function SignInRoute() {
  const { featureFlags } = Route.useRouteContext()
  const { redirect } = Route.useSearch()

  return (
    <SignInPage publicSignUpEnabled={featureFlags?.publicSignUpEnabled} redirectTo={redirect} />
  )
}
