import type { User } from '@supabase/supabase-js'

type AuthenticatedUserSnapshot = Pick<User, 'id'>

export function canAuthenticatedUserVisitGuestAuthPath(pathname: string) {
  return pathname === '/update-password' || pathname === '/verify-password-reset'
}

export function shouldRedirectRootToHome(user: AuthenticatedUserSnapshot | null) {
  return Boolean(user)
}
