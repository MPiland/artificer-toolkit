import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'

import { discoverEncounterEventHooks } from '../events/encounterEventHooks.js'
import { getRestRecoveryTriggers } from './sheetRest.js'

/**
 * Whether finishing a rest deletes this Character active effect: one the rest, raised on it as a
 * `REST` event, ends (Contact Other Plane's madness ends on a long rest), a scalar reduction whose
 * recovery triggers match, or a hit point maximum reduction that ends on a long rest (Life Drain,
 * D62). Server only: event discovery is Encounter rules, which the browser never loads (ADR 0036
 * S6).
 */
export function activeEffectEndsOnRest(
  effect: Pick<ActiveRuleEffectRecord, 'id' | 'definition' | 'lifecycle'>,
  restKind: 'SHORT' | 'LONG'
): boolean {
  const rest = discoverEncounterEventHooks({
    effects: [effect],
    events: [{ kind: 'REST', restKind }]
  })
  if (rest.ended.length > 0) return true
  const triggers = getRestRecoveryTriggers(restKind)
  return effect.definition.stateContributions.some(
    (contribution) =>
      (contribution.kind === 'SCALAR_REDUCTION' &&
        contribution.recoveryTriggers.some((trigger) => triggers.has(trigger))) ||
      (contribution.kind === 'HIT_POINT_MAXIMUM_REDUCTION' &&
        restKind === 'LONG' &&
        contribution.recoveryTags.includes('LONG_REST'))
  )
}
