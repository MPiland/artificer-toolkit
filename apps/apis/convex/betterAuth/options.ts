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
      // request refreshes `lastRequest`, so steady traffic from one IP accumulates toward `max`. Each
      // page view mints about 3 tokens (SSR plus the client provider), and one IP can be a household,
      // an office NAT or a CI shard. Measured CI peaks: 51 mints in one journey, 187 across an
      // 11-minute shard. 600 per 10s gives more than 3x that headroom and still caps one IP at an
      // average of 60 mints per second; the default 100 per 10s is what 429ed the journeys.
      customRules: { '/convex/token': { window: 10, max: 600 } }
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
