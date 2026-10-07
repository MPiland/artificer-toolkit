import type { TestConvex } from 'convex-test'
import { readPendingSnapshot } from '@artificer-toolkit/encounter-persistence/pendingSnapshots'
import { createConvexEncounterStoreReader } from '../../convex/lib/convexEncounterStore'
import type schema from '../../convex/schema'
import { checkpointLiveRoom } from './localRoomWorker'

/**
 * The pending snapshot the real room stored for the occurrence a root command opened, as Convex
 * holds it once the room checkpoints (the room keeps a Run's history until then, D85). It is the
 * member-visible record of what the room's rules planned: the application context a pause resumes.
 */
export async function readRoomPendingSnapshot(
  t: TestConvex<typeof schema>,
  input: { campaignId: string; encounterId: string; rootCommandId: string }
) {
  await checkpointLiveRoom(input.campaignId)
  return t.run(async (ctx) => {
    const occurrences = await ctx.db
      .query('encounterRuleOccurrences')
      .withIndex('by_encounterId_state', (q) => q.eq('encounterId', input.encounterId))
      .collect()
    const occurrence = occurrences.find((entry) => entry.rootCommandId === input.rootCommandId)
    if (!occurrence) throw new Error('The room stored no occurrence for the root command.')
    return readPendingSnapshot({ db: createConvexEncounterStoreReader(ctx) }, occurrence)
  })
}
