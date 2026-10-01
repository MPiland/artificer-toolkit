import { campaignClockDtoSchema } from '@artificer-toolkit/schema/api/campaignSessions'
import { absoluteMinute, deriveClock } from '@artificer-toolkit/rules-runtime/campaignClock'
import type { MutationCtx } from '../_generated/server'
import { closeOpenClockSegment, openClockSegment } from './clockSegments'

/**
 * Combat pauses the Campaign clock and its end resumes only that pause. Runs inside the transaction
 * that changed a Run's status, so the clock never disagrees with the Runs a reader sees. A pause
 * moves no recovery watermark: the next clock command processes the boundaries it crossed.
 */
export async function syncCampaignClockWithCombat(db: MutationCtx['db'], campaignId: string) {
  const campaign = await db
    .query('campaigns')
    .withIndex('by_publicId', (q) => q.eq('id', campaignId))
    .unique()
  if (campaign?.status !== 'ACTIVE') return
  const row = await db
    .query('campaignClocks')
    .withIndex('by_campaignId', (q) => q.eq('campaignId', campaignId))
    .unique()
  if (!row) return
  const { _id, _creationTime, ...stored } = row
  const clock = campaignClockDtoSchema.parse(stored)
  const inCombat =
    (await db
      .query('encounterRuns')
      .withIndex('by_campaignId_status', (q) =>
        q.eq('campaignId', campaignId).eq('status', 'ACTIVE')
      )
      .first()) !== null
  const at = new Date().toISOString()
  if (inCombat && clock.running) {
    const derived = deriveClock(clock, at).clock
    await closeOpenClockSegment(db, campaignId, absoluteMinute(derived.day, derived.minuteOfDay), at)
    await db.patch(
      _id,
      campaignClockDtoSchema.parse({
        ...derived,
        running: false,
        runningSince: null,
        pausedForCombat: true,
        version: clock.version + 1,
        updatedAt: at
      })
    )
  } else if (!inCombat && clock.pausedForCombat) {
    await openClockSegment(db, campaignId, absoluteMinute(clock.day, clock.minuteOfDay), at)
    await db.patch(
      _id,
      campaignClockDtoSchema.parse({
        ...clock,
        running: true,
        runningSince: at,
        pausedForCombat: false,
        version: clock.version + 1,
        updatedAt: at
      })
    )
  }
}
