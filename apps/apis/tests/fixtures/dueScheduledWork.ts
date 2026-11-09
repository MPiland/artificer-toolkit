import { setImmediate as nextMacrotask, setTimeout as sleep } from 'node:timers/promises'
import { vi } from 'vitest'
import { CAMPAIGN_BACKGROUND_SETTLE_MS } from '../../convex/characters/sheetSectionStores'
import type { RoomCaller } from './localRoomWorker'

/** A departure's reconcile step runs after `CAMPAIGN_BACKGROUND_SETTLE_MS` (D216), not at once. */
function isReconcileRun(row: { name: string }) {
  return row.name.includes('characterReconcileSteps') && row.name.endsWith(':run')
}

/**
 * Runs the work committed mutations scheduled for now (a removal's per-Character reconcile steps,
 * which wait out the settle delay), as a deployment does before a client's next call. Later work
 * (retry watchdogs) stays queued.
 */
export async function runDueScheduledWork(caller: Pick<RoomCaller, 'run'>) {
  let due: { name: string; state: { kind: string } }[] = []
  for (let attempt = 0; attempt < 1_000; attempt++) {
    due = (await caller.run((ctx) => ctx.db.system.query('_scheduled_functions').collect())).filter(
      (row) =>
        row.state.kind === 'inProgress' ||
        // Scheduled for now when queued (`runAfter(0)`), on either clock; delayed work stays queued.
        (row.state.kind === 'pending' &&
          (row.scheduledTime <= row._creationTime || isReconcileRun(row)))
    )
    if (!due.length) return
    if (vi.isFakeTimers()) {
      vi.advanceTimersByTime(CAMPAIGN_BACKGROUND_SETTLE_MS)
      await nextMacrotask()
    } else await sleep(50)
  }
  throw new Error(
    `Scheduled work due now did not finish: ${due.map((row) => `${row.name} (${row.state.kind})`).join(', ')}.`
  )
}
