import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import type { NativeEncounterActionSource } from './encounterActionSources.js'

/**
 * The label of the immunity a holder carries against this source for this effect or grant (D156), or
 * null. A Character source also matches by its Character, since a carried effect outlives the
 * Encounter actor.
 */
export function heldSourceImmunityLabel(input: {
  holderEffects: readonly ActiveRuleEffectRecord[]
  immuneToId: string
  sourceActorId: string
  sourceCharacterId: string | null
}): string | null {
  for (const { definition } of input.holderEffects) {
    const originActorId =
      definition.origin.kind === 'ENCOUNTER' ? definition.origin.sourceActorId : null
    for (const contribution of definition.stateContributions)
      if (
        contribution.kind === 'SOURCE_IMMUNITY' &&
        contribution.immuneToId === input.immuneToId &&
        (originActorId === input.sourceActorId ||
          (input.sourceCharacterId !== null &&
            contribution.sourceCharacterId === input.sourceCharacterId))
      )
        return contribution.sourceLabel
  }
  return null
}

/**
 * The label of the immunity a creature holds against this source's use of this action (D156), or
 * null. The immunity names the action's authored effect, or the grant a cast came through when that
 * grant locks each target out, and the actor that used it.
 */
export function encounterSourceImmunityLabel(input: {
  source: NativeEncounterActionSource
  holderEffects: readonly ActiveRuleEffectRecord[]
}): string | null {
  const { source } = input
  return heldSourceImmunityLabel({
    holderEffects: input.holderEffects,
    immuneToId:
      source.kind === 'CHARACTER_ACTION'
        ? (source.entry.compilation.activeEffectPlan?.sourceImmunity?.immuneToId ??
          source.entry.effectId)
        : source.capability.effectId,
    sourceActorId: source.actor.id,
    sourceCharacterId: source.actor.kind === 'CHARACTER' ? source.actor.sourceId : null
  })
}
