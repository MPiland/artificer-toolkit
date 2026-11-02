import { pendingSnapshotContinuation } from '@artificer-toolkit/rules-runtime/encounterActionPendingSnapshot'
import { encounterD20WindowSelection } from '@artificer-toolkit/rules-runtime/encounterD20Window'
import type { NativePauseHandler } from './nativePauseTypes.js'

export const d20WindowPause: NativePauseHandler<'ROLL_WINDOW'> = {
  read: ({ pause, snapshot, resolution }) => ({
    kind: 'ROLL_WINDOW',
    answer: {
      offer: pause.payload,
      continuation: pendingSnapshotContinuation(snapshot),
      selection: encounterD20WindowSelection(resolution)
    }
  })
}
