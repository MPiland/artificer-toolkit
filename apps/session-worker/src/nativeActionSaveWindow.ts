import { nextRollInt } from '@artificer-toolkit/rules-runtime/random'
import { settleEncounterD20Window } from '@artificer-toolkit/rules-runtime/encounterD20Window'
import type { RulesRuntimeService } from '@artificer-toolkit/rules-runtime/rulesRuntimeService'

import type { NativePauseAnswer } from './nativePauseTypes.js'

/**
 * The evidence an answered pause resumes its action's TEST save with: the roll's own evidence, or for
 * a d20 window the roll it froze with the die it spent added to it.
 */
export async function settledActionSaveWindow(
  pauseAnswer: NativePauseAnswer | null,
  options: { runtime: RulesRuntimeService; random?: (maxExclusive: number) => number }
) {
  if (pauseAnswer?.kind === 'EVIDENCE') return pauseAnswer.answer
  if (pauseAnswer?.kind !== 'ROLL_WINDOW') return null
  const { offer, continuation, selection } = pauseAnswer.answer
  const settled = await settleEncounterD20Window({
    runtime: options.runtime,
    window: offer,
    continuation,
    selection,
    random: options.random ?? nextRollInt
  })
  return { kind: 'ROLL_WINDOW' as const, d20: settled.d20 }
}
