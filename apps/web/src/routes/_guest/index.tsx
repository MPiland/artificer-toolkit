import { createFileRoute, redirect } from '@tanstack/react-router'
import type { User } from '@supabase/supabase-js'
import { MarketingPage } from '#app/marketing/pages'

type AuthenticatedUserSnapshot = Pick<User, 'id'>

export function shouldRedirectRootToHome(user: AuthenticatedUserSnapshot | null) {
  return Boolean(user)
}

export const Route = createFileRoute('/_guest/')({
  beforeLoad: ({ context }) => {
    if (shouldRedirectRootToHome(context.user)) {
      throw redirect({ to: '/home' })
    }
  },
  component: MarketingPage
})
