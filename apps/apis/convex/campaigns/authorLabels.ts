import { deletedCampaignAuthorLabel } from '@artificer-toolkit/schema/api/campaignCommunication'
import type { QueryCtx } from '../_generated/server'
import { readAuthUsers } from '../lib/authUserReads'

/** Shared Campaign authorship (chat, rolls, shared notes) needs a username to show. */
export function requireCampaignAuthorUsername(username: string | null): asserts username is string {
  if (!username) throw new Error('A username is required to post in this Campaign.')
}

/**
 * Resolves the author label for retained Campaign history, in input order. Records keep only the
 * opaque account id, so an author whose account is deleted reads as `deletedCampaignAuthorLabel`.
 * A `username` snapshot (chat) is shown while the account exists; otherwise the current username.
 */
export async function readCampaignAuthorLabels(
  ctx: QueryCtx,
  authors: ReadonlyArray<{ userId: string; username?: string }>
): Promise<string[]> {
  const userIds = [...new Set(authors.map((author) => author.userId))]
  const profiles = new Map(
    await Promise.all(
      userIds.map(
        async (userId) =>
          [
            userId,
            await ctx.db
              .query('userProfiles')
              .withIndex('by_userId', (q) => q.eq('userId', userId))
              .unique()
          ] as const
      )
    )
  )
  const unsnapshotted = new Set(
    authors.flatMap((author) => (author.username === undefined ? [author.userId] : []))
  )
  const users = await readAuthUsers(
    ctx,
    userIds.flatMap((userId) => {
      const profile = profiles.get(userId)
      return profile && unsnapshotted.has(userId) ? [profile.authUserId] : []
    })
  )
  const usersById = new Map(users.map((user) => [String(user._id), user]))
  return authors.map((author) => {
    const profile = profiles.get(author.userId)
    if (!profile) return deletedCampaignAuthorLabel
    const user = usersById.get(profile.authUserId)
    return author.username ?? user?.displayUsername ?? user?.username ?? deletedCampaignAuthorLabel
  })
}
