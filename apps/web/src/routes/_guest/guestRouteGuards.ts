import type { User } from '@supabase/supabase-js'

type AuthenticatedUserSnapshot = Pick<User, 'id'>

export function canAuthenticatedUserVisitGuestAuthPath(pathname: string) {
  return pathname === '/update-password'
}

export function shouldRedirectRootToHome(user: AuthenticatedUserSnapshot | null) {
  return Boolean(user)
}
