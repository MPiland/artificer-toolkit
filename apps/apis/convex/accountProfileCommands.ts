import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import {
  accountProfileDtoSchema,
  accountProfileUpdateInputSchema,
  type AccountProfileDto
} from '@artificer-toolkit/schema/api/account'
import {
  USERNAME_NOT_ALLOWED_MESSAGE,
  validateUsername
} from '@artificer-toolkit/shared/account/username'
import { internalMutation } from './lib/mutations'
import { createAuth } from './authFactory.helper'
import { authComponent } from './lib/authClient.helper'
import { getAuthenticatedProfile } from './lib/identity'

export const update = internalMutation({
  args: zodToConvexFields(accountProfileUpdateInputSchema.shape),
  returns: zodToConvex(accountProfileDtoSchema),
  handler: async (ctx, args): Promise<AccountProfileDto> => {
    const authenticated = await getAuthenticatedProfile(ctx)
    if (!authenticated) throw new Error('Unauthenticated')
    const input = accountProfileUpdateInputSchema.parse(args)
    const username = input.username ?? authenticated.username
    if (!username || validateUsername(username).message) {
      throw new Error(USERNAME_NOT_ALLOWED_MESSAGE)
    }

    if (input.username !== undefined) {
      const { auth, headers } = await authComponent.getAuth(createAuth, ctx)
      // Use Better Auth's normalization/uniqueness hooks within this same mutation.
      await auth.api.updateUser({
        headers,
        body: {
          ...(username.toLowerCase() !== authenticated.canonicalUsername ? { username } : {}),
          displayUsername: username
        }
      })
    }
    await ctx.db.patch(authenticated.profile._id, { bio: input.bio })
    return accountProfileDtoSchema.parse({ username, bio: input.bio })
  }
})
