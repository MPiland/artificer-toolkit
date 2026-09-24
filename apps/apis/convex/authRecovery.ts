import {
  authRecoveryCommandSchema,
  authRecoveryResultSchema,
  type AuthRecoveryResult
} from '@artificer-toolkit/schema/api/auth'
import { isAPIError } from 'better-auth/api'
import type { RateLimit } from 'better-auth/types'
import { v } from 'convex/values'
import { internalMutation } from './lib/mutations'
import { createAuth } from './authFactory.helper'

export const execute = internalMutation({
  args: {
    command: v.union(
      v.object({ operation: v.literal('REQUEST'), email: v.string() }),
      v.object({ operation: v.literal('CHECK'), email: v.string(), token: v.string() }),
      v.object({
        operation: v.literal('RESET'),
        email: v.string(),
        token: v.string(),
        password: v.string()
      })
    )
  },
  returns: v.union(
    v.object({ success: v.literal(true) }),
    v.object({
      success: v.literal(false),
      status: v.number(),
      code: v.string(),
      message: v.string()
    })
  ),
  handler: async (ctx, args): Promise<AuthRecoveryResult> => {
    const command = authRecoveryCommandSchema.parse(args.command)
    const auth = createAuth(ctx)
    try {
      // Nested component calls share this mutation: consumption, attempts, password, and sessions.
      switch (command.operation) {
        case 'REQUEST': {
          // Account throttling also limits resends when an attacker rotates client IPs.
          const { adapter } = await auth.$context
          const key = `recovery-account:${command.email.toLowerCase()}`
          const bucket = await adapter.findOne<RateLimit>({
            model: 'rateLimit',
            where: [{ field: 'key', value: key }]
          })
          const now = Date.now()
          const count = bucket && now - bucket.lastRequest < 60_000 ? bucket.count : 0
          if (count >= 3) {
            return {
              success: false,
              status: 429,
              code: 'TOO_MANY_REQUESTS',
              message: 'Too many requests. Please try again later.'
            }
          }
          if (bucket) {
            await adapter.update({
              model: 'rateLimit',
              where: [{ field: 'key', value: key }],
              update: { count: count + 1, lastRequest: now }
            })
          } else {
            await adapter.create({ model: 'rateLimit', data: { key, count: 1, lastRequest: now } })
          }
          await auth.api.requestPasswordResetEmailOTP({ body: { email: command.email } })
          break
        }
        case 'CHECK':
          await auth.api.checkVerificationOTP({
            body: { email: command.email, type: 'forget-password', otp: command.token }
          })
          break
        case 'RESET':
          await auth.api.resetPasswordEmailOTP({
            body: { email: command.email, otp: command.token, password: command.password }
          })
          break
      }
      return { success: true }
    } catch (error) {
      // Return expected rejections so their failed-attempt updates commit. Unexpected errors roll back.
      if (!isAPIError(error) || error.statusCode < 400 || error.statusCode >= 500) throw error
      return authRecoveryResultSchema.parse({
        success: false,
        status: error.statusCode,
        code: error.body?.code ?? 'RECOVERY_REJECTED',
        message: error.body?.message ?? 'Password recovery was rejected.'
      })
    }
  }
})
