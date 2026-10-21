import {
  pendingSnapshotContinuation,
  restoreEncounterActionPending
} from '@artificer-toolkit/rules-runtime/encounterActionPendingSnapshot'
import { restoreHeldNativeActionCompletion } from '@artificer-toolkit/rules-runtime/encounterActionExecution'
import type { NativePauseHandler } from './nativePauseTypes.js'

export const forcedMovementPause: NativePauseHandler<'FORCED_MOVEMENT'> = {
  read: ({ pause, snapshot, resolution }) => {
    if (
      resolution.kind !== 'FORCED_MOVEMENT' ||
      snapshot.request.requestId !== resolution.requestId
    )
      throw new Error('The action requires a forced-movement destination.')
    return {
      kind: 'FORCED_MOVEMENT',
      answer: {
        offer: pause.payload,
        continuation: pendingSnapshotContinuation(snapshot),
        outcomePhase: restoreEncounterActionPending(snapshot).twoPhase,
        position: resolution.position
      }
    }
  },
  // A held destination pick resumes the action its OUTCOME already settled, running no graph again.
  settle: ({ offer, outcomePhase }, { actionSource }) =>
    Promise.resolve({
      execution: restoreHeldNativeActionCompletion({
        adapter: actionSource.adapter,
        binding: actionSource.binding,
        occurrenceId: actionSource.occurrenceId,
        offer,
        outcomePhase
      })
    })
}
