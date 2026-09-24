import { ENTITLEMENT_LIMITS } from '@artificer-toolkit/shared/account/entitlements'
import type { MutationCtx } from '../_generated/server'

export async function assertNewHomebrewRootAllowed(ctx: MutationCtx, userId: string) {
  const entitlement = await ctx.db
    .query('accountEntitlements')
    .withIndex('by_userId', (q) => q.eq('userId', userId))
    .unique()
  const limit = ENTITLEMENT_LIMITS[entitlement?.tier ?? 'FREE'].homebrewRoots
  if (limit === null) return
  const [active, drafts] = await Promise.all([
    ctx.db
      .query('authoredRoots')
      .withIndex('by_ownerUserId', (q) => q.eq('ownerUserId', userId))
      .take(limit),
    ctx.db
      .query('authoredDrafts')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .take(limit)
  ])
  const roots = new Set([
    ...active.map((root) => `${root.subjectKind}:${root.id}`),
    ...drafts.map((draft) => `${draft.subjectKind}:${draft.subjectId}`)
  ])
  if (roots.size >= limit) throw new Error('Your account has reached its homebrewRoots limit.')
}
