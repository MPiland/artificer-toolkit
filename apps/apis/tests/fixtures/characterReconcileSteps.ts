import { makeFunctionReference } from 'convex/server'
import type { DevelopmentClient } from '../developmentClient'
import { awaitInternalQuery } from './internalQueryWait'

// Internal fixture query (`characters/development.ts`), reached with the local admin key.
const characterReconcileState = makeFunctionReference<
  'query',
  { characterId: string },
  'NONE' | 'PENDING' | 'EXHAUSTED'
>('characters/development:characterReconcileState')

/**
 * Waits until no Campaign reconcile step is pending for a Character. A departure settles the
 * Character in that queued step (D81, PERF-6.T6), so proofs wait for it before reading what it
 * settles. An exhausted step fails the proof.
 */
export function awaitCharacterReconcile(characterId: string, client?: DevelopmentClient) {
  return awaitInternalQuery({
    query: characterReconcileState,
    args: { characterId },
    label: `Character ${characterId} reconcile step`,
    client,
    judge: (state) => {
      if (state === 'EXHAUSTED')
        return new Error(`Character ${characterId} reconcile step exhausted its runs.`)
      return state === 'PENDING' ? 'WAITING' : 'SETTLED'
    }
  })
}
