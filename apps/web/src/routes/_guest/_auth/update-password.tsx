import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { ResetPasswordPage } from '#app/auth/pages/ResetPasswordPage'
import { UpdatePasswordPage } from '#app/auth/pages/UpdatePasswordPage'

export const Route = createFileRoute('/_guest/_auth/update-password')({
  validateSearch: z.object({
    flow: z.literal('invite').optional()
  }),
  component: UpdatePasswordRoute
})

function UpdatePasswordRoute() {
  const { flow } = Route.useSearch()

  return flow === 'invite' ? <UpdatePasswordPage invitation /> : <ResetPasswordPage />
}
