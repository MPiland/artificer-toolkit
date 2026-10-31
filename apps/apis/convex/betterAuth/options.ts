import { convex } from '@convex-dev/better-auth/plugins'
import type { BetterAuthOptions } from 'better-auth/minimal'
import { admin } from 'better-auth/plugins/admin'
import { adminAc, userAc } from 'better-auth/plugins/admin/access'
import { emailOTP } from 'better-auth/plugins/email-otp'
import { username } from 'better-auth/plugins/username'
import { isUsernameFormatValid } from '@artificer-toolkit/shared/account/username'
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
    rateLimit: {
      enabled: true,
      storage: 'database',
      // The count resets only after `window` seconds with no allowed request, because every allowed
      // request refreshes `lastRequest`. The default (100 per 10s) therefore accumulates under steady
      // SSR traffic from one IP and eventually 429s the token mint. A 1s window resets after any
      // one-second lull, while still capping each IP at 20 mints per second.
      customRules: { '/convex/token': { window: 1, max: 20 } }
    },
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
        // Better Auth also runs this on the typed name at sign-in, so it checks format only;
        // moderation runs at sign-up and rename in the auth hook (authFactory.helper).
        usernameValidator: isUsernameFormatValid
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
