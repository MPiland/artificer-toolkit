import { createFileRoute } from '@tanstack/react-router'
import { SignUpPage } from '#app/auth/pages'

export const Route = createFileRoute('/_guest/_auth/sign-up')({
  ssr: true,
  component: SignUpRoute
})

function SignUpRoute() {
  const { featureFlags } = Route.useRouteContext()

  return <SignUpPage publicSignUpEnabled={featureFlags?.publicSignUpEnabled} />
}
