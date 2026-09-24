'use node'

import { randomBytes } from 'node:crypto'
import { authInvitationIssueInputSchema } from '@artificer-toolkit/schema/api/auth'
import { zodToConvexFields } from 'convex-helpers/server/zod4'
import { v } from 'convex/values'
import { internal } from './_generated/api'
import { internalAction } from './_generated/server'

// Deployment-admin CLI only. Never return the bearer secret or print the email link.
export const invite = internalAction({
  args: zodToConvexFields(authInvitationIssueInputSchema.shape),
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    const { email } = authInvitationIssueInputSchema.parse(args)
    await ctx.runMutation(internal.authInvitations.issue, {
      email,
      token: randomBytes(32).toString('hex')
    })
    return null
  }
})
