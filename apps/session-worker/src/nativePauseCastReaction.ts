import { pendingSnapshotContinuation } from '@artificer-toolkit/rules-runtime/encounterActionPendingSnapshot'
import type { NativePauseHandler } from './nativePauseTypes.js'

export const castReactionPause: NativePauseHandler<'CAST_REACTION'> = {
  read: ({ pause, snapshot, decision, dice }) => {
    const { check } = pause.payload
    // A counter's check is its own d20: the answer settles it and never resumes the cast's graphs.
    if (check) {
      if (!dice) throw new Error('The counter requires dice evidence.')
      return {
        kind: 'CAST_REACTION',
        answer: {
          kind: 'CHECK',
          offer: { ...pause.payload, check },
          continuation: pendingSnapshotContinuation(snapshot),
          evidence: dice
        }
      }
    }
    if (!decision) throw new Error('The action requires a reaction decision.')
    return {
      kind: 'CAST_REACTION',
      answer: { kind: 'SELECTION', offer: pause.payload, selection: decision }
    }
  }
}
