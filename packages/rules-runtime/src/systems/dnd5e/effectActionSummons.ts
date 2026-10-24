import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import type { CharacterRuleActionSummonPlacementPlan } from '../../characterRuleActionSystemAdapter.js'
import {
  DND5E_EFFECT_ACTION_CAPABILITY_CONTRACT_VERSION,
  UUID,
  unsupported
} from './effectActionContracts.js'
import type { Dnd5eCompiledEffectActionSource } from './effectActionContracts.js'
import { conditionDurationTurns } from './effectActionFollowUp.js'
import { durationPublishedGraph, maintenancePlan } from './effectActionLifetime.js'
import { modifierGrantEntryPlan } from './effectActionModifierGrants.js'

/**
 * The creature an action summons: its first ON_USE entry is a timed SUMMON manifest, whose stat
 * block rides the plan and whose carrier effect ends the summon with its duration or the
 * Concentration the cast opens. A second ON_USE entry may be an empty APPLY_GRANT of the same
 * duration whose effect offers the carrier holds. Null for any other action. A summon that
 * authors anything the plan does not carry (behaviors, a missing stat block or duration, a third
 * entry) is refused rather than partly honored.
 */
export function compileDnd5eSummonPlacement(
  action: Dnd5eCompiledEffectActionSource
): CharacterRuleActionSummonPlacementPlan | null {
  const { entries } = action.compiledEffect
  if (
    !entries.some(
      (entry) =>
        'outcome' in entry &&
        entry.outcome.effectKind === 'MANIFEST' &&
        entry.outcome.manifestKind === 'SUMMON'
    )
  )
    return null
  const [entry, carrierEntry, ...rest] = entries
  if (
    rest.length > 0 ||
    !entry ||
    !('outcome' in entry) ||
    entry.pathCode !== 'ON_USE' ||
    (carrierEntry && (!('outcome' in carrierEntry) || carrierEntry.pathCode !== 'ON_USE'))
  )
    unsupported('A summon is the only outcome of its action’s use.')
  const { outcome } = entry
  if (outcome.effectKind !== 'MANIFEST' || outcome.manifestKind !== 'SUMMON')
    unsupported('A summon is the only outcome of its action’s use.')
  if (!outcome.statBlock) unsupported('A summon authors the stat block of its creature.')
  if (outcome.behaviors?.length)
    unsupported('A summoned creature’s own behaviors are not yet modelled.')
  if (outcome.attachmentKind || outcome.shape)
    unsupported('A summon is placed by its creature, not by an attachment or a shape.')
  const initialRemaining = entry.duration ? conditionDurationTurns(entry.duration) : null
  // The result block's lifecycle is shared by its outcomes: the summon may carry only the offers
  // its carrier grant holds.
  const { effectOffers, ...otherLifecycle } = entry.lifecycle ?? {}
  if (
    initialRemaining === null ||
    Object.values(otherLifecycle).some((value) => value !== undefined) ||
    (effectOffers !== undefined &&
      (!carrierEntry ||
        checksumCanonicalJson(effectOffers) !==
          checksumCanonicalJson(carrierEntry.lifecycle?.effectOffers ?? null))) ||
    !UUID.test(entry.entryId) ||
    !UUID.test(outcome.id)
  )
    unsupported('A summon lasts a bounded duration and authors no lifecycle of its own.')
  const summon = {
    summonOutcomeId: outcome.id,
    label: outcome.label ?? null,
    statBlock: outcome.statBlock
  }
  if (carrierEntry) {
    // The carrier may also hold what its owner can do through the summon: an empty grant whose
    // offers (a CONJURED repeat) last exactly as long as the creature.
    const plan = modifierGrantEntryPlan({
      action,
      entry: carrierEntry,
      resultGated: false,
      untilEndEvent: false
    })
    const contribution = plan?.modifierGrantContribution
    if (
      !plan ||
      !contribution?.effectOffers?.length ||
      contribution.modifiers.length + contribution.senses.length > 0 ||
      contribution.grantedActions?.length ||
      plan.lifecycle ||
      plan.initialRemaining !== initialRemaining ||
      plan.recurrenceStage !== 'END_OF_TURN' ||
      plan.tickAnchor !== 'HOLDER'
    )
      unsupported('A summon’s carrier holds only the offers that last as long as the summon.')
    return {
      ...summon,
      entry: { ...plan, frozenGraph: durationPublishedGraph({ effectId: action.effectId, plan }) }
    }
  }
  const plan = {
    authoredEffectId: action.effectId,
    compiledEntryId: entry.entryId,
    frozenGraphNodeId: 'summon',
    capabilityContractVersion: DND5E_EFFECT_ACTION_CAPABILITY_CONTRACT_VERSION,
    recurrenceStage: 'END_OF_TURN' as const,
    initialRemaining,
    adapterFacts: {},
    perceptionContributions: [],
    maintenance: maintenancePlan(action, entry),
    marginRiders: []
  }
  return {
    ...summon,
    entry: { ...plan, frozenGraph: durationPublishedGraph({ effectId: action.effectId, plan }) }
  }
}
