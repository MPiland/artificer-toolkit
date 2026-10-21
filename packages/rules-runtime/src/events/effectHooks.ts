import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import { eventVocabularyCapabilityRegistry } from '../platformPolicyModules.js'

/**
 * The hooks an effect authors, read through its own System's event vocabulary (the System its frozen
 * graph was compiled for). Only a stored effect with state contributions (schema 2) subscribes. The
 * Sheet reads these too, so this module stays clear of Encounter rules (ADR 0036 S6).
 */
export function effectHooks(effect: Pick<ActiveRuleEffectRecord, 'definition'>) {
  const { definition } = effect
  if (definition.schemaVersion !== 2) return []
  return eventVocabularyCapabilityRegistry
    .require(definition.frozenGraph.source.gameSystemId)
    .effectHooks(definition.recurrence)
}

/** The subscriptions whose event ends the effect (see `effectHooks`). */
export function endSubscriptions(effect: Pick<ActiveRuleEffectRecord, 'definition'>) {
  return effectHooks(effect).flatMap((hook) => (hook.hook === 'END' ? [hook.subscription] : []))
}
