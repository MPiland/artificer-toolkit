import { convexClient } from '@convex-dev/better-auth/client/plugins'
import { createAuthClient } from 'better-auth/react'
import { emailOTPClient, usernameClient } from 'better-auth/client/plugins'

export const betterAuthClient = createAuthClient({
  baseURL: `${typeof window === 'undefined' ? 'http://localhost' : window.location.origin}/api/auth`,
  sessionOptions: { refetchOnWindowFocus: false },
  plugins: [convexClient(), usernameClient(), emailOTPClient()]
})
