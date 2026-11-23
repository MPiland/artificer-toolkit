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
      // page view mints two tokens (one on the server, one in the browser), and
      // one IP can be a household, an office NAT or a CI shard. Measured CI peaks, taken when a page
      // view minted about 3: 51 mints in one journey, 187 across an 11-minute shard, so about 25 and
      // 94 now. The limit stays at 600 per 10s, the value sized from those peaks: fewer mints per
      // view only widen the headroom, and lowering it needs fresh CI measurements first.
      customRules: {
        '/convex/token': { window: 10, max: 600 },
        // One per server-rendered page view, replacing the token mint on the document path.
        '/session-snapshot': { window: 10, max: 600 },
        // Convex fetches this on every token validation, with no proxy context and so no client IP of
        // its own: all of those fetches would share one bucket. It serves public key data only, so
        // it is exempt. Limiting it could only fail validation reads, never protect anything.
        '/convex/jwks': false
      }
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
      convex({ authConfig, jwt: { definePayload: async () => ({}) } })
    ]
  } satisfies BetterAuthOptions
}
