import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { SignInPage } from '#app/auth/pages'

export const Route = createFileRoute('/_guest/_auth/sign-in')({
  validateSearch: z.object({
    redirect: z
      .string()
      .startsWith('/')
      .refine((value) => !value.startsWith('//'))
      .optional()
  }),
  component: SignInRoute
})

function SignInRoute() {
  const { featureFlags } = Route.useRouteContext()
  const { redirect } = Route.useSearch()

  return (
    <SignInPage publicSignUpEnabled={featureFlags?.publicSignUpEnabled} redirectTo={redirect} />
  )
}
