import type { CharacterRuleActionActiveEffectPlan } from '../../characterRuleActionSystemAdapter.js'
import { UUID, unsupported, type Dnd5eCompiledEffectActionSource } from './effectActionContracts.js'
import { conditionDurationTurns } from './effectActionFollowUp.js'
import { durationPublishedGraph } from './effectActionLifetime.js'
import { dnd5eTestKind } from './effectActionTest.js'

/**
 * The immunity the action leaves on its target against this source (D156). A successful save's
 * ("immune to this effect for 24 hours") is one SOURCE_IMMUNITY outcome on the success path, lasting
 * its result block's duration in the target's turns, keyed by the action. An at-will grant's lockout
 * (Chains of Carceri's "can't target it again until you finish a long rest") lands on every creature
 * the cast meets, keyed by the grant, and lasts until the source Character's long rest.
 */
export function sourceImmunityPlan(
  action: Dnd5eCompiledEffectActionSource
): CharacterRuleActionActiveEffectPlan['sourceImmunity'] {
  const entries = action.compiledEffect.entries.flatMap((entry) =>
    'outcome' in entry && entry.outcome.effectKind === 'SOURCE_IMMUNITY' ? [entry] : []
  )
  const entry = entries[0]
  const lockout = action.perTargetLockout
  if (lockout) {
    if (entry || !UUID.test(lockout.grantId))
      unsupported('A D&D lockout is the grant’s alone, keyed by the grant.')
    const plan = {
      compiledEntryId: lockout.grantId,
      frozenGraphNodeId: 'source-lockout'
    }
    return {
      ...plan,
      appliesTo: 'EVERY_TARGET',
      immuneToId: lockout.grantId,
      initialRemaining: null,
      frozenGraph: durationPublishedGraph({
        effectId: action.effectId,
        plan: { ...plan, marginRiders: [] }
      })
    }
  }
  if (!entry) return null
  const initialRemaining = entry.duration ? conditionDurationTurns(entry.duration) : null
  if (
    entries.length > 1 ||
    dnd5eTestKind(action.compiledEffect.invocation) !== 'SAVE' ||
    entry.pathCode !== 'ON_SAVE_SUCCESS' ||
    initialRemaining === null ||
    Object.values(entry.lifecycle ?? {}).some((value) => value !== undefined) ||
    entry.maintenanceDefinitionId ||
    !UUID.test(entry.entryId)
  )
    unsupported('D&D source immunity is one timed outcome of a successful saving throw.')
  const plan = {
    compiledEntryId: entry.entryId,
    frozenGraphNodeId: 'source-immunity'
  }
  return {
    ...plan,
    appliesTo: 'SAVE_SUCCESS',
    immuneToId: action.effectId,
    initialRemaining,
    frozenGraph: durationPublishedGraph({
      effectId: action.effectId,
      plan: { ...plan, marginRiders: [] }
    })
  }
}
