import type { CharacterRuleActionSummonPlacementPlan } from '../../characterRuleActionSystemAdapter.js'
import {
  DND5E_EFFECT_ACTION_CAPABILITY_CONTRACT_VERSION,
  UUID,
  unsupported
} from './effectActionContracts.js'
import type { Dnd5eCompiledEffectActionSource } from './effectActionContracts.js'
import { conditionDurationTurns } from './effectActionFollowUp.js'
import { durationPublishedGraph, maintenancePlan } from './effectActionLifetime.js'

/**
 * The creature an action summons: its one ON_USE entry is a timed SUMMON manifest, whose stat
 * block rides the plan and whose carrier effect ends the summon with its duration or the
 * Concentration the cast opens. Null for any other action. A summon that authors anything the
 * plan does not carry (behaviors, a missing stat block or duration, a second entry) is refused
 * rather than partly honored.
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
  const [entry] = entries
  if (entries.length !== 1 || !entry || !('outcome' in entry) || entry.pathCode !== 'ON_USE')
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
  if (
    initialRemaining === null ||
    Object.values(entry.lifecycle ?? {}).some((value) => value !== undefined) ||
    !UUID.test(entry.entryId) ||
    !UUID.test(outcome.id)
  )
    unsupported('A summon lasts a bounded duration and authors no lifecycle of its own.')
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
    summonOutcomeId: outcome.id,
    label: outcome.label ?? null,
    statBlock: outcome.statBlock,
    entry: { ...plan, frozenGraph: durationPublishedGraph({ effectId: action.effectId, plan }) }
  }
}
