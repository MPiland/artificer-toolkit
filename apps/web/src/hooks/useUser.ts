import { useAuth } from '@hooks'
import { useRouteContext } from '@tanstack/react-router'

/**
 * Unified SSR + Client user.
 *
 * - SSR user (router context) is authoritative for initial page load
 * - Client user (AuthProvider) updates immediately on login/logout
 *
 * This gives the UI a correct user at all times.
 */
export function useUser() {
  const { user: clientUser, isAuthenticating } = useAuth()

  // SSR user from root.beforeLoad()
  const { user: ssrUser } = useRouteContext({
    from: '__root__',
  }) as { user: { email: string } | null }

  // Priority:
  // 1. SSR user (authoritative at first load)
  // 2. Client user (after login/logout)
  // 3. "null" only if both missing AND not authenticating
  return ssrUser ?? (isAuthenticating ? null : clientUser)
}
