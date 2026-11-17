import type { CharacterRuleActionActiveEffectPlan } from '../../characterRuleActionSystemAdapter.js'
import {
  DND5E_EFFECT_ACTION_CAPABILITY_CONTRACT_VERSION,
  UUID,
  type Dnd5eCompiledEffectActionSource
} from './effectActionContracts.js'
import { compiledCreatureFormFilter, formDuration } from './effectActionCreatureFormFilter.js'
import { maintenancePlan } from './effectActionLifetime.js'
import { entryResultGate } from './effectActionTest.js'

/**
 * A timed MANIFEST creature (Giant Insect): each creature the cast reached swaps into one of the
 * authored forms for the duration (D130). Which form is the caster's choice at cast time; the plan
 * carries every form and the Encounter effect records the chosen Creature. Polymorph authors it on
 * the failed-save path with a filter instead of fixed forms: the effect exists only for a creature
 * that failed, and the caster names any Creature that meets the filter.
 */
export function creatureFormPlan(
  action: Dnd5eCompiledEffectActionSource
): Omit<CharacterRuleActionActiveEffectPlan, 'frozenGraph'> | null {
  const [entry, ...otherEntries] = action.compiledEffect.entries
  if (otherEntries.length > 0 || !entry || !('outcome' in entry)) return null
  const { outcome } = entry
  if (
    outcome.effectKind !== 'MANIFEST' ||
    outcome.manifestKind !== 'CREATURE' ||
    (!outcome.forms?.length && !outcome.formFilter)
  )
    return null
  const duration = entry.duration ? formDuration(entry.duration) : null
  const forms = outcome.forms ?? []
  const filter = compiledCreatureFormFilter(outcome.formFilter)
  const retainedAbilityIds = [...new Set(outcome.retainedAbilityDefinitionIds ?? [])].sort()
  const resultGate = entryResultGate(action, entry.pathCode)
  // A form takes only the two lifecycle pieces that end it early (Wild Shape).
  const { holderEnd = null, endOnConditionIds = [], ...otherLifecycle } = entry.lifecycle ?? {}
  if (
    duration === null ||
    resultGate === undefined ||
    Object.values(otherLifecycle).some((value) => value !== undefined) ||
    retainedAbilityIds.some((abilityId) => !UUID.test(abilityId)) ||
    !UUID.test(entry.entryId) ||
    !UUID.test(outcome.id) ||
    forms.some(
      ({ id, creatureId, statBlock }) =>
        !UUID.test(id) ||
        statBlock !== undefined ||
        creatureId === undefined ||
        !UUID.test(creatureId)
    ) ||
    filter === undefined
  )
    return null
  return {
    authoredEffectId: action.effectId,
    compiledEntryId: entry.entryId,
    frozenGraphNodeId: 'creature-form',
    capabilityContractVersion: DND5E_EFFECT_ACTION_CAPABILITY_CONTRACT_VERSION,
    recurrenceStage: 'END_OF_TURN',
    initialRemaining: duration.initialRemaining,
    creatureFormContribution: {
      formOutcomeId: outcome.id,
      excessDamageCarriesOver: outcome.excessDamageCarriesOver ?? false,
      retainedAbilityIds,
      retainsProficiencies: outcome.retainsProficiencies ?? false,
      holderEnd,
      endOnConditionIds: [...new Set(endOnConditionIds)].sort(),
      forms: [...forms]
        .sort((a, b) => a.order - b.order)
        .flatMap(({ id, label, creatureId, maxTargets }) =>
          creatureId === undefined ? [] : [{ id, label, creatureId, maxTargets }]
        ),
      filter,
      initialRemainingScaling: duration.scaling
    },
    ...(resultGate && { resultGate }),
    adapterFacts: {},
    perceptionContributions: [],
    maintenance: maintenancePlan(action, entry),
    marginRiders: []
  }
}
