import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import { getRestRecoveryTriggers } from '../character/sheetRest.js'
import { eventVocabularyCapabilityRegistry } from '../platformPolicyModules.js'
import type { EncounterEffectHook } from './encounterEventTable.js'

/**
 * The hooks that follow from an effect's structure, in every System: a timed effect counts down at
 * its anchor's turn boundary of the stage its expiration names and ends with the source it counts its
 * turns on; an effect carried over ends with the Campaign clock it was carried until and with the
 * Concentration that stamps it; a scalar or hit-point-maximum reduction ends on the rest that
 * recovers it.
 */
function structuralHooks({
  definition: { recurrence, origin, stateContributions }
}: Pick<ActiveRuleEffectRecord, 'definition'>): EncounterEffectHook[] {
  const timed: EncounterEffectHook[] =
    recurrence.expiration.kind === 'TICKS'
      ? [
          {
            hook: 'COUNT_DOWN',
            subscription: { event: 'TURN_BOUNDARY', stage: recurrence.expiration.decrementStage }
          },
          ...(recurrence.anchor === 'SOURCE' && origin.kind === 'ENCOUNTER'
            ? [{ hook: 'END', subscription: { event: 'SOURCE_DEPARTED' } } as const]
            : [])
        ]
      : []
  const recovered = (['SHORT', 'LONG'] as const).filter((restKind) => {
    const triggers: ReadonlySet<string> = getRestRecoveryTriggers(restKind)
    return stateContributions.some(
      (contribution) =>
        (contribution.kind === 'SCALAR_REDUCTION' &&
          contribution.recoveryTriggers.some((trigger) => triggers.has(trigger))) ||
        (contribution.kind === 'HIT_POINT_MAXIMUM_REDUCTION' &&
          restKind === 'LONG' &&
          contribution.recoveryTags.includes('LONG_REST'))
    )
  })
  return [
    ...timed,
    // The lifecycle decides whether a carried-over or Concentration-stamped effect meets these.
    { hook: 'END', subscription: { event: 'CAMPAIGN_CLOCK' } },
    { hook: 'END', subscription: { event: 'CONCENTRATION_STARTED' } },
    ...recovered.map((restKind): EncounterEffectHook => ({
      hook: 'END',
      subscription: { event: 'REST', restKind }
    }))
  ]
}

/**
 * The hooks an effect authors, read through its own System's event vocabulary (the System its frozen
 * graph was compiled for), whatever its definition version, then its structural hooks (see
 * `structuralHooks`). The Sheet reads these too, so this module stays clear of Encounter rules (ADR
 * 0036 S6).
 */
export function effectHooks(
  effect: Pick<ActiveRuleEffectRecord, 'definition'>
): readonly EncounterEffectHook[] {
  return [
    ...eventVocabularyCapabilityRegistry
      .require(effect.definition.frozenGraph.source.gameSystemId)
      .effectHooks(effect.definition.recurrence),
    ...structuralHooks(effect)
  ]
}

/** The subscriptions whose event ends the effect (see `effectHooks`). */
export function endSubscriptions(effect: Pick<ActiveRuleEffectRecord, 'definition'>) {
  return effectHooks(effect).flatMap((hook) => (hook.hook === 'END' ? [hook.subscription] : []))
}
