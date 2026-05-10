import { getRequest } from '@tanstack/react-start/server'
import { isTrustedSameOriginMutationRequest } from '#app/lib/trpcRequestSecurity'

export type BlockedAuthRequest = {
  error: true
  message: string
}

export function getBlockedAuthRequest(): BlockedAuthRequest | null {
  if (isTrustedSameOriginMutationRequest(getRequest())) {
    return null
  }

  return {
    error: true,
    message: 'Cross-site request blocked'
  }
}
