import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { VerifyPasswordResetPage } from '#app/auth/pages'

export const Route = createFileRoute('/_guest/_auth/verify-password-reset')({
  validateSearch: z.object({
    email: z.string().trim().email().max(320).optional().catch(undefined)
  }),
  component: VerifyPasswordResetRoute
})

function VerifyPasswordResetRoute() {
  const { email } = Route.useSearch()

  return <VerifyPasswordResetPage initialEmail={email} />
}
