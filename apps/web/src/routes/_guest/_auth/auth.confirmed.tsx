import { createFileRoute, redirect } from '@tanstack/react-router'
import { z } from 'zod'
import { AuthConfirmedPage, InviteLinkErrorPage } from '#app/auth/pages'
import { confirmInviteFn } from '#app/server/auth/confirmInviteFn'

export const Route = createFileRoute('/_guest/_auth/auth/confirmed')({
  validateSearch: z.object({
    token_hash: z.string().min(1).optional(),
    type: z.literal('invite').optional()
  }),
  beforeLoad: async ({ search }) => {
    if (search.type !== 'invite' || !search.token_hash) return

    const result = await confirmInviteFn({
      data: { tokenHash: search.token_hash }
    })

    if (!result.ok) {
      return { invitationError: true }
    }

    throw redirect({
      to: '/update-password',
      search: { flow: 'invite' }
    })
  },
  component: AuthConfirmedRoute
})

function AuthConfirmedRoute() {
  const context = Route.useRouteContext()
  const invitationError = 'invitationError' in context && context.invitationError

  return invitationError ? <InviteLinkErrorPage /> : <AuthConfirmedPage />
}
