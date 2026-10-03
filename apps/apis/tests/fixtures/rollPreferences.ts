import type { RollVisibilityDto } from '@artificer-toolkit/schema/api/rolls'
import type { TestConvex } from 'convex-test'
import type schema from '../../convex/schema'

/** How a fixture's roller supplies dice: the server rolls, or an Assisted prompt waits for them. */
export type FixtureRolls = 'AUTO_ROLL' | 'PROMPT'

/**
 * Sets a user's "Roll my dice automatically" preference. New profiles auto-roll, so tests that need
 * Assisted roll prompts turn it off for the roller (the GM in this slice).
 */
export async function setAutoRollDice(
  t: TestConvex<typeof schema>,
  userId: string,
  autoRollDice: boolean
) {
  await t.run(async (ctx) => {
    const profile = await ctx.db
      .query('userProfiles')
      .withIndex('by_userId', (query) => query.eq('userId', userId))
      .unique()
    if (!profile) throw new Error('Fixture profile is unavailable.')
    await ctx.db.patch(profile._id, { autoRollDice })
  })
}

/** Sets a GM's remembered Public/Private roll toggle; new profiles start on PUBLIC. */
export async function setGmRollVisibility(
  t: TestConvex<typeof schema>,
  userId: string,
  gmRollVisibility: RollVisibilityDto
) {
  await t.run(async (ctx) => {
    const profile = await ctx.db
      .query('userProfiles')
      .withIndex('by_userId', (query) => query.eq('userId', userId))
      .unique()
    if (!profile) throw new Error('Fixture profile is unavailable.')
    await ctx.db.patch(profile._id, { gmRollVisibility })
  })
}
