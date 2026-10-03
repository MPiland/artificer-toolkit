import type { RollVisibilityDto } from '@artificer-toolkit/schema/api/rolls'
import type { QueryCtx } from '../_generated/server'

/**
 * The roller's "Roll my dice automatically" preference. Read inside the transaction that would
 * otherwise create a roll prompt, so the choice applies on every device and without a client.
 */
export async function readAutoRollDice(ctx: QueryCtx, userId: string): Promise<boolean> {
  return (await readRollPreferences(ctx, userId)).autoRollDice
}

/** The GM's remembered Public/Private roll toggle (Q14); it decides rolls the GM did not start. */
export async function readGmRollVisibility(
  ctx: QueryCtx,
  userId: string
): Promise<RollVisibilityDto> {
  return (await readRollPreferences(ctx, userId)).gmRollVisibility
}

async function readRollPreferences(ctx: QueryCtx, userId: string) {
  const profile = await ctx.db
    .query('userProfiles')
    .withIndex('by_userId', (query) => query.eq('userId', userId))
    .unique()
  if (!profile) throw new Error('User profile is missing.')
  return profile
}
