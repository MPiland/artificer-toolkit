import type { AuthSessionUserDto } from '@artificer-toolkit/schema/api/auth'

export function canAuthenticatedUserVisitGuestAuthPath(pathname: string) {
  return pathname === '/update-password' || pathname === '/verify-password-reset'
}

export function shouldRedirectRootToHome(user: Pick<AuthSessionUserDto, 'userId'> | null) {
  return Boolean(user)
}
