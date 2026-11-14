import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'

import { discoverEncounterEventHooks } from '../events/encounterEventHooks.js'

/**
 * Whether finishing a rest deletes this Character active effect: one the rest, raised on it as a
 * `REST` event, ends (Contact Other Plane's madness ends on a long rest, a scalar reduction whose
 * recovery triggers match, a hit point maximum reduction that ends on a long rest: Life Drain, D62).
 * Server only: event discovery is Encounter rules, which the browser never loads (ADR 0036 S6).
 */
export function activeEffectEndsOnRest(
  effect: Pick<ActiveRuleEffectRecord, 'id' | 'definition' | 'lifecycle'>,
  restKind: 'SHORT' | 'LONG'
): boolean {
  return (
    discoverEncounterEventHooks({
      effects: [effect],
      events: [{ kind: 'REST', restKind }]
    }).ended.length > 0
  )
}
