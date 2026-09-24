'use node'

import { authInvitationRedeemInputSchema } from '@artificer-toolkit/schema/api/auth'
import { hashPassword } from 'better-auth/crypto'
import { zodToConvexFields } from 'convex-helpers/server/zod4'
import { v } from 'convex/values'
import { internal } from './_generated/api'
import { internalAction } from './_generated/server'

export const redeem = internalAction({
  args: zodToConvexFields(authInvitationRedeemInputSchema.shape),
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    const input = authInvitationRedeemInputSchema.parse(args)
    const passwordHash = await hashPassword(input.password)
    await ctx.runMutation(internal.authInvitations.redeem, { ...input, passwordHash })
    return null
  }
})
