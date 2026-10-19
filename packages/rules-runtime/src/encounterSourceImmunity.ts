import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import type { NativeEncounterActionSource } from './encounterActionSources.js'

/**
 * The label of the immunity a creature holds against this source's use of this action (D156), or
 * null. The immunity names the action's authored effect, or the grant a cast came through when that
 * grant locks each target out, and the actor that used it; a Character's immunity also matches by
 * the source Character, since a carried effect outlives the Encounter actor.
 */
export function encounterSourceImmunityLabel(input: {
  source: NativeEncounterActionSource
  holderEffects: readonly ActiveRuleEffectRecord[]
}): string | null {
  const { source } = input
  const immuneToId =
    source.kind === 'CHARACTER_ACTION'
      ? (source.entry.compilation.activeEffectPlan?.sourceImmunity?.immuneToId ??
        source.entry.effectId)
      : source.capability.effectId
  const sourceCharacterId = source.actor.kind === 'CHARACTER' ? source.actor.sourceId : null
  for (const { definition } of input.holderEffects) {
    if (definition.schemaVersion !== 2) continue
    const sourceActorId =
      definition.origin.kind === 'ENCOUNTER' ? definition.origin.sourceActorId : null
    for (const contribution of definition.stateContributions)
      if (
        contribution.kind === 'SOURCE_IMMUNITY' &&
        contribution.immuneToId === immuneToId &&
        (sourceActorId === source.actor.id ||
          (sourceCharacterId !== null && contribution.sourceCharacterId === sourceCharacterId))
      )
        return contribution.sourceLabel
  }
  return null
}
