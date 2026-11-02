import { nextRollInt } from '@artificer-toolkit/rules-runtime/random'
import { settleEncounterD20Window } from '@artificer-toolkit/rules-runtime/encounterD20Window'
import { settleEncounterDamageRollWindow } from '@artificer-toolkit/rules-runtime/encounterDamageRollWindow'
import type { RulesRuntimeService } from '@artificer-toolkit/rules-runtime/rulesRuntimeService'
import { isDamageRollWindow } from '@artificer-toolkit/schema/shared/ruleExecutionDamageRollWindow'

import type { NativePauseAnswer } from './nativePauseTypes.js'

/**
 * The evidence an answered pause resumes its action with: the roll's own evidence; for a d20 window,
 * the roll it froze with the die it spent added to it; for a damage roll's window, the dice it rolls
 * again and the cost that pays for them (D208).
 */
export async function settledActionSaveWindow(
  pauseAnswer: NativePauseAnswer | null,
  options: { runtime: RulesRuntimeService; random?: (maxExclusive: number) => number }
) {
  if (pauseAnswer?.kind === 'EVIDENCE') return pauseAnswer.answer
  if (pauseAnswer?.kind !== 'ROLL_WINDOW') return null
  const { offer, continuation, selection } = pauseAnswer.answer
  const random = options.random ?? nextRollInt
  if (isDamageRollWindow(offer))
    return settleEncounterDamageRollWindow({
      runtime: options.runtime,
      window: offer,
      continuation,
      selection,
      random
    })
  const settled = await settleEncounterD20Window({
    runtime: options.runtime,
    window: offer,
    continuation,
    selection,
    random
  })
  return { kind: 'ROLL_WINDOW' as const, d20: settled.d20 }
}
