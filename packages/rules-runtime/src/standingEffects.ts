import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import type { PathLifecycleReturnsOn } from '@artificer-toolkit/shared/core'
import type { CompiledEffectGroup } from '@artificer-toolkit/shared/compilers'

import type { CharacterRulePolicyFactsResult } from './character/characterRulePolicyFacts.js'
import type { CharacterRuleActionActiveEffectPlan } from './characterRuleActionSystemAdapter.js'

/**
 * An always-on effect of a passive feature (SPELLS-31.2): its holder holds it until one of its
 * authored ends, and the rest it returns on turns it back on. Held means its Active Rule Effect
 * exists; ended means it does not.
 */
export interface StandingEffect {
  /** The feature Effect, which the held effect names as its authored effect. */
  effectId: string
  label: string
  returnsOn: PathLifecycleReturnsOn
  plan: CharacterRuleActionActiveEffectPlan
}

/** The rest that turns a passive Effect back on once it ends; null for an Effect that is not standing. */
export function standingEffectReturnsOn(
  effect: CompiledEffectGroup
): PathLifecycleReturnsOn | null {
  if (effect.invocation.kind !== 'PASSIVE') return null
  for (const entry of effect.entries)
    if ('lifecycle' in entry && entry.lifecycle?.returnsOn) return entry.lifecycle.returnsOn
  return null
}

/**
 * The standing effects a Character's passive features name, as its Sheet lists them. Only arming
 * compiles their plans (`standingEffectPlans.ts`), which reaches the Encounter rules.
 */
export function listStandingEffects(
  sources: CharacterRulePolicyFactsResult['standingEffectSources']
): Omit<StandingEffect, 'plan'>[] {
  return sources.entryPoints.flatMap(({ actionId, effectId, compiledEffect }) => {
    const returnsOn = standingEffectReturnsOn(compiledEffect)
    const candidate = sources.candidates.find((entry) => entry.actionId === actionId)
    return returnsOn && candidate ? [{ effectId, label: candidate.label, returnsOn }] : []
  })
}

/** Whether its holder holds this standing effect: it has not ended since its rest turned it on. */
export function holdsStandingEffect(
  standing: Pick<StandingEffect, 'effectId'>,
  held: readonly Pick<ActiveRuleEffectRecord, 'definition'>[]
): boolean {
  return held.some(({ definition }) => definition.authoredEffectId === standing.effectId)
}
