import { absoluteMinute, deriveClock } from '@artificer-toolkit/rules-runtime/campaignClock'
import { campaignClockDtoSchema } from '@artificer-toolkit/schema/api/campaignSessions'
import type { QueryCtx } from '../_generated/server'

/**
 * The Campaign clock's absolute minute now, derived as play reads it; `null` without a clock. Carry-over
 * (D99) and a later Run's resume (D151) both count from it, so the two agree on every minute.
 */
export async function readCampaignClockMinute(db: QueryCtx['db'], campaignId: string) {
  const row = await db
    .query('campaignClocks')
    .withIndex('by_campaignId', (q) => q.eq('campaignId', campaignId))
    .unique()
  if (!row) return null
  const { _id, _creationTime, ...stored } = row
  const { clock } = deriveClock(campaignClockDtoSchema.parse(stored), new Date().toISOString())
  return absoluteMinute(clock.day, clock.minuteOfDay)
}
