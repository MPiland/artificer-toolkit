import { encounterHeldSavingThrowDice } from '@artificer-toolkit/rules-runtime/encounterActiveGrants'
import { nextRollInt } from '@artificer-toolkit/rules-runtime/random'
import { settleEncounterD20Window } from '@artificer-toolkit/rules-runtime/encounterD20Window'
import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import type { RulesRuntimeService } from '@artificer-toolkit/rules-runtime/rulesRuntimeService'

import type { NativePauseAnswer } from './nativePauseTypes.js'

/**
 * The evidence an answered d20 window resumes its action's TEST save with: the roll it froze, with the
 * die it spent added to it.
 */
export async function settledActionSaveWindow(
  pauseAnswer: NativePauseAnswer | null,
  options: { runtime: RulesRuntimeService; random?: (maxExclusive: number) => number }
) {
  if (pauseAnswer?.kind !== 'D20_WINDOW') return null
  const { offer, continuation, selection } = pauseAnswer.answer
  const settled = await settleEncounterD20Window({
    runtime: options.runtime,
    window: offer,
    continuation,
    selection,
    random: options.random ?? nextRollInt
  })
  return { kind: 'D20_WINDOW' as const, d20: settled.d20 }
}

/** The dice the target of an action's TEST save holds for after its d20. */
export const targetSaveWindow = (
  gameSystemId: string,
  targetEffects: readonly ActiveRuleEffectRecord[]
) => ({
  heldDice: (abilityDefinitionId: string) =>
    encounterHeldSavingThrowDice(gameSystemId, targetEffects, abilityDefinitionId)
})

type SpentDiceHolder = { addedDice?: readonly { spentEffectId?: string }[] } | null | undefined

/** The effects whose held die a window spent on the action's settled saves; each is used up with the action. */
export function windowSpentEffects(
  execution: Readonly<Record<'d20' | 'nestedD20', SpentDiceHolder>>,
  targetEffects: readonly ActiveRuleEffectRecord[]
) {
  return [execution.d20, execution.nestedD20]
    .flatMap((d20) => d20?.addedDice ?? [])
    .flatMap(({ spentEffectId }) => {
      if (!spentEffectId) return []
      const spent = targetEffects.find(({ id }) => id === spentEffectId)
      if (!spent) throw new Error('The d20 window die is no longer held.')
      return [spent]
    })
}
