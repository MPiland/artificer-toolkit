import type { MutationCtx, QueryCtx } from '../_generated/server'

export async function retainedFeed(ctx: QueryCtx | MutationCtx, userId: string) {
  const items = await ctx.db
    .query('notificationFeedItems')
    .withIndex('by_userId_occurredAt_id', (q) => q.eq('userId', userId))
    .order('desc')
    .take(26)
  // Delivery must prune to the existing latest-25 retention bound in its transaction.
  // Detect drift instead of silently understating the unseen count or partially marking seen.
  if (items.length > 25) throw new Error('Notification retention limit exceeded.')
  return items.sort(
    (left, right) =>
      Date.parse(right.occurredAt) - Date.parse(left.occurredAt) ||
      (left.id < right.id ? 1 : left.id > right.id ? -1 : 0)
  )
}
