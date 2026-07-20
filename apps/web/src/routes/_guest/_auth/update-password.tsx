import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { UpdatePasswordPage } from '#app/auth/pages'

export const Route = createFileRoute('/_guest/_auth/update-password')({
  validateSearch: z.object({
    flow: z.literal('invite').optional()
  }),
  component: UpdatePasswordRoute
})

function UpdatePasswordRoute() {
  const { flow } = Route.useSearch()

  return <UpdatePasswordPage invitation={flow === 'invite'} />
}
