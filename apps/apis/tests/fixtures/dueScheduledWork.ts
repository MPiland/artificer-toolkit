import { setImmediate as nextMacrotask } from 'node:timers/promises'
import { vi } from 'vitest'
import type { RoomCaller } from './localRoomWorker'

/**
 * Runs the work committed mutations scheduled for now (a removal's per-Character reconcile steps),
 * as a deployment does before a client's next call. Later work (retry watchdogs) stays queued.
 */
export async function runDueScheduledWork(caller: Pick<RoomCaller, 'run'>) {
  let due: { name: string; state: { kind: string } }[] = []
  for (let attempt = 0; attempt < 1_000; attempt++) {
    due = (await caller.run((ctx) => ctx.db.system.query('_scheduled_functions').collect())).filter(
      (row) =>
        row.state.kind === 'inProgress' ||
        // Scheduled for now when queued (`runAfter(0)`), on either clock; delayed work stays queued.
        (row.state.kind === 'pending' && row.scheduledTime <= row._creationTime)
    )
    if (!due.length) return
    if (vi.isFakeTimers()) vi.advanceTimersByTime(0)
    await nextMacrotask()
  }
  throw new Error(
    `Scheduled work due now did not finish: ${due.map((row) => `${row.name} (${row.state.kind})`).join(', ')}.`
  )
}
