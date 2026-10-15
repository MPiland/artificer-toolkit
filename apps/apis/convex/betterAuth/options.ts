import { convex } from '@convex-dev/better-auth/plugins'
import type { BetterAuthOptions } from 'better-auth/minimal'
import { admin } from 'better-auth/plugins/admin'
import { adminAc, userAc } from 'better-auth/plugins/admin/access'
import { emailOTP } from 'better-auth/plugins/email-otp'
import { username } from 'better-auth/plugins/username'
import { validateUsernameOnServer } from '@artificer-toolkit/shared/account/usernameServer'
import authConfig from '../auth.config'

export function createAuthAdapterOptions(
  sendVerificationOTP: Parameters<typeof emailOTP>[0]['sendVerificationOTP'] = async () => {
    throw new Error('Adapter schema discovery cannot deliver email.')
  }
) {
  const adminPlugin = admin({
    defaultRole: 'user',
    adminRoles: ['superadmin'],
    roles: { user: userAc, superadmin: adminAc }
  })
  return {
    rateLimit: { enabled: true, storage: 'database' },
    // OTP is recovery-only; don't expose a second signup or passwordless-login path.
    disabledPaths: [
      '/sign-in/email-otp',
      '/email-otp/send-verification-otp',
      '/email-otp/verify-email',
      '/email-otp/request-email-change',
      '/email-otp/change-email',
      '/forget-password/email-otp',
      // Account administration is internal-only; enabling roles must not expose these routes.
      ...Object.values(adminPlugin.endpoints).map((endpoint) => endpoint.path)
    ],
    plugins: [
      username({
        usernameNormalization: (value) => value.trim().toLowerCase(),
        displayUsernameNormalization: (value) => value.trim(),
        usernameValidator: (value) => validateUsernameOnServer(value).message === null,
        displayUsernameValidator: (value) => validateUsernameOnServer(value).message === null
      }),
      adminPlugin,
      emailOTP({
        disableSignUp: true,
        storeOTP: 'hashed',
        sendVerificationOTP
      }),
      convex({ authConfig, jwks: process.env.JWKS, jwt: { definePayload: async () => ({}) } })
    ]
  } satisfies BetterAuthOptions
}
