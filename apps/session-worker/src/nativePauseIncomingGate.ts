import { pendingSnapshotContinuation } from '@artificer-toolkit/rules-runtime/encounterActionPendingSnapshot'
import type { NativePauseHandler } from './nativePauseTypes.js'

export const incomingGatePause: NativePauseHandler<'INCOMING_GATE'> = {
  // The source's roll against its gate is its own d20: the answer settles it and the action replays.
  read: ({ pause, snapshot, dice }) => {
    if (!dice) throw new Error('The incoming gate requires dice evidence.')
    return {
      kind: 'INCOMING_GATE',
      answer: {
        offer: pause.payload,
        continuation: pendingSnapshotContinuation(snapshot),
        evidence: dice
      }
    }
  }
}
