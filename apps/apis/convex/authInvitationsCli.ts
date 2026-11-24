'use node'
import { randomBytes } from 'node:crypto'
import { authInvitationBatchInputSchema } from '@artificer-toolkit/schema/api/auth'
import { zodToConvexFields } from 'convex-helpers/server/zod4'
import { v } from 'convex/values'
import { internal } from './_generated/api'
import { internalAction } from './_generated/server'

// Deployment-admin CLI only. Never return the bearer secret or print the email link. Each address is
// issued in its own transaction, so one refusal (an existing account) does not block the others.
export const invite = internalAction({
  args: zodToConvexFields(authInvitationBatchInputSchema.shape),
  returns: v.object({
    invited: v.array(v.string()),
    failed: v.array(v.object({ email: v.string(), reason: v.string() }))
  }),
  handler: async (ctx, args) => {
    const { emails } = authInvitationBatchInputSchema.parse(args)
    const invited: string[] = []
    const failed: { email: string; reason: string }[] = []
    for (const email of new Set(emails)) {
      try {
        await ctx.runMutation(internal.authInvitations.issue, {
          email,
          token: randomBytes(32).toString('hex')
        })
        invited.push(email)
      } catch (error) {
        failed.push({ email, reason: error instanceof Error ? error.message : String(error) })
      }
    }
    return { invited, failed }
  }
})
