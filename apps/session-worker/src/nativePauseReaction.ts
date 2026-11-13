import { resolveNativeActionOnHit } from '@artificer-toolkit/rules-runtime/encounterActionOnHit'
import type { NativePauseHandler } from './nativePauseTypes.js'

export const onHitPause: NativePauseHandler<'ON_HIT'> = {
  read: ({ pause, decision }) => {
    if (!decision) throw new Error('The action requires an on-hit decision.')
    return { kind: 'ON_HIT', answer: { offer: pause.payload, selection: decision } }
  },
  settle: async ({ offer, selection }, { actionSource, onHitNow }) => {
    const resolved = await resolveNativeActionOnHit({
      ...actionSource,
      offer,
      selection,
      candidates: onHitNow
    })
    return { execution: resolved.execution, onHit: resolved }
  }
}
