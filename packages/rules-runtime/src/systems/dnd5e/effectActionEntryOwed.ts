import type { CompiledEffectGroup } from '@artificer-toolkit/shared/compilers'

import { attackRestrictionsMet, oncePerTurnUsageKey } from './attackRestrictions.js'
import { unsupported } from './effectActionContracts.js'
import type { Dnd5eEffectScalingFacts } from './effectActionScalingFacts.js'

/**
 * An entry resolves for this attack when its optional rider, if any, was chosen, the attack has not
 * spent its once-per-turn use this turn, and, when it was reduced to circumstance checks, its
 * circumstances meet them.
 */
export function entryOwed(
  entry: CompiledEffectGroup['entries'][number],
  effectId: string,
  facts: Dnd5eEffectScalingFacts
): boolean {
  const optionalRider = 'optionalRider' in entry ? entry.optionalRider : undefined
  if (optionalRider && !facts.selectedOptionalRiderIds.includes(optionalRider.riderId)) return false
  const usageKey = oncePerTurnUsageKey(entry, effectId)
  if (usageKey !== null) {
    if (facts.attackTurnUses === undefined)
      unsupported('D&D once-per-turn paths need the turn record of an attack.')
    if (facts.attackTurnUses.includes(usageKey)) return false
  }
  // An ON_USE entry's restrictions admitted its user before the action ran.
  if (!('restrictions' in entry) || !entry.restrictions || entry.pathCode === 'ON_USE') return true
  return attackRestrictionsMet(entry.restrictions, {
    rollMode: facts.attackRollMode,
    enemyProximity: facts.attackEnemyProximity ?? null,
    moveToward: facts.attackMoveToward ?? null,
    targetCreatureTypeId: facts.targetCreatureTypeId ?? null,
    targetBelowMaximumHitPoints: facts.targetBelowMaximumHitPoints === true,
    attackItemBindingEffectIds: facts.attackItemBindingEffectIds ?? []
  })
}
