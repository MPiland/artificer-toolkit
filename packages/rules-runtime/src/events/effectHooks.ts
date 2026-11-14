import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import { eventVocabularyCapabilityRegistry } from '../platformPolicyModules.js'
import type { EncounterEffectHook } from './encounterEventTable.js'

/**
 * The hooks an effect authors, read through its own System's event vocabulary (the System its frozen
 * graph was compiled for), whatever its definition version, then the count of a timed effect: it
 * counts down at its anchor's turn boundary of the stage its expiration names, in every System. The
 * Sheet reads these too, so this module stays clear of Encounter rules (ADR 0036 S6).
 */
export function effectHooks(
  effect: Pick<ActiveRuleEffectRecord, 'definition'>
): readonly EncounterEffectHook[] {
  const { recurrence, frozenGraph } = effect.definition
  const authored = eventVocabularyCapabilityRegistry
    .require(frozenGraph.source.gameSystemId)
    .effectHooks(recurrence)
  return recurrence.expiration.kind === 'TICKS'
    ? [
        ...authored,
        {
          hook: 'COUNT_DOWN',
          subscription: { event: 'TURN_BOUNDARY', stage: recurrence.expiration.decrementStage }
        }
      ]
    : authored
}

/** The subscriptions whose event ends the effect (see `effectHooks`). */
export function endSubscriptions(effect: Pick<ActiveRuleEffectRecord, 'definition'>) {
  return effectHooks(effect).flatMap((hook) => (hook.hook === 'END' ? [hook.subscription] : []))
}
