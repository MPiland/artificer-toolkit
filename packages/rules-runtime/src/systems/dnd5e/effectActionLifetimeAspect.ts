import type { ServerPublishedRuleDefinitionDto } from '@artificer-toolkit/schema/shared/ruleExecutionCore'
import type { CharacterRuleActionActiveEffectPlan } from '../../characterRuleActionSystemAdapter.js'
import { canonicalEndTriggers } from './effectActionBandConditions.js'
import {
  DND5E_EFFECT_ACTION_CAPABILITY_CONTRACT_VERSION,
  UUID,
  unsupported,
  type Dnd5eCompiledEffectActionSource
} from './effectActionContracts.js'
import { dnd5eRepeatSave } from './effectActionFollowUp.js'
import {
  activeEffectGraphNodeId,
  isGrantEndTrigger,
  maintenancePlan
} from './effectActionLifetime.js'

type LifetimePlan = Omit<CharacterRuleActionActiveEffectPlan, 'frozenGraph'>

/**
 * The plan that holds what an action leaves behind once it is used (ADR 0039 decision 1), one per
 * action, by precedence:
 * - SEQUENTIAL: a composed heal and grant cast (D156), with its own frozen graph;
 * - REPEAT_SAVE: an effect a follow-up save repeats in, frozen as that save;
 * - TIMED: a condition, grant, link or form its own duration counts down;
 * - RELATIONSHIP: a hold on a target (Grapple), with its own frozen graph;
 * - RECURRING: a result that fires again at a turn boundary, frozen as the action's graph;
 * - CONCEALMENT: a check's concealment until dispelled, frozen as the action's graph.
 */
export type Dnd5eLifetime =
  | { kind: 'SEQUENTIAL'; plan: CharacterRuleActionActiveEffectPlan }
  | { kind: 'REPEAT_SAVE' | 'TIMED' | 'RECURRING' | 'CONCEALMENT'; plan: LifetimePlan }
  | {
      kind: 'RELATIONSHIP'
      plan: LifetimePlan & { frozenGraph: ServerPublishedRuleDefinitionDto }
    }

/** The compiler's own plan builders, which the lifetime aspect chooses among and does not build. */
export type Dnd5eLifetimeCandidates = Readonly<{
  sequential: (
    action: Dnd5eCompiledEffectActionSource
  ) => CharacterRuleActionActiveEffectPlan | null
  repeatSave: (action: Dnd5eCompiledEffectActionSource) => LifetimePlan | null
  timed: (action: Dnd5eCompiledEffectActionSource) => LifetimePlan | null
  relationship: (
    action: Dnd5eCompiledEffectActionSource
  ) => (LifetimePlan & { frozenGraph: ServerPublishedRuleDefinitionDto }) | null
}>

/**
 * The lifetime aspect's rule: the first plan by precedence holds the action's lifetime. A relationship
 * holds its target in a graph of its own, so a save or duration plan cannot hold it beside theirs.
 */
export function dnd5eLifetime(
  action: Dnd5eCompiledEffectActionSource,
  candidates: Dnd5eLifetimeCandidates
): Dnd5eLifetime | null {
  const sequential = candidates.sequential(action)
  if (sequential) return { kind: 'SEQUENTIAL', plan: sequential }
  const repeatSave = candidates.repeatSave(action)
  const timed = repeatSave ? null : candidates.timed(action)
  const relationship = candidates.relationship(action)
  if (relationship && (repeatSave || timed))
    unsupported('D&D relationship cannot share an action with another lasting effect.')
  if (repeatSave) return { kind: 'REPEAT_SAVE', plan: repeatSave }
  if (timed) return { kind: 'TIMED', plan: timed }
  if (relationship) return { kind: 'RELATIONSHIP', plan: relationship }
  const recurring = dnd5eRecurringPlan(action)
  if (recurring) return { kind: 'RECURRING', plan: recurring }
  const concealment = concealmentPlan(action)
  return concealment && { kind: 'CONCEALMENT', plan: concealment }
}

/**
 * Whether the lifetime holds its entry's duration, lifecycle or maintenance. A relationship's hold
 * lasts until its own release, so an entry's lifecycle has no plan to ride.
 */
export function holdsEntryLifetime(lifetime: Dnd5eLifetime | null): boolean {
  return lifetime !== null && lifetime.kind !== 'RELATIONSHIP'
}

/**
 * Whether a rolled test's lifetime holds the whole action as one graph, its test and outcomes not
 * split into templates: a result that recurs, or a hold that is the action's only result.
 */
export function holdsWholeGraph(
  action: Dnd5eCompiledEffectActionSource,
  lifetime: Dnd5eLifetime | null
): boolean {
  return (
    lifetime?.kind === 'RECURRING' ||
    (lifetime?.kind === 'RELATIONSHIP' &&
      action.compiledEffect.entries.every(
        (entry) => 'outcome' in entry && entry.outcome.effectKind === 'ACTOR_RELATIONSHIP'
      ))
  )
}

/**
 * A result that fires again at the start or end of each of its holder's turns for a counted number of
 * rounds: a failed save's (repeated against the same DC) or a use's.
 */
function dnd5eRecurringPlan(action: Dnd5eCompiledEffectActionSource): LifetimePlan | null {
  const { invocation, entries } = action.compiledEffect
  const entry = entries[0]
  if (!entry || !('outcome' in entry)) return null
  const duration = entry.duration
  const lifecycle = entry.lifecycle
  const recurringStage =
    lifecycle?.recurringKind === 'START_OF_TURN' || lifecycle?.recurringKind === 'END_OF_TURN'
      ? lifecycle.recurringKind
      : null
  const recurringAmount =
    duration?.durationKind === 'ROUND' &&
    Number.isSafeInteger(duration.amount) &&
    duration.amount > 0
      ? duration.amount
      : null
  const recurringScaling = duration?.durationKind === 'ROUND' ? duration.scaling : true
  if (
    recurringAmount === null ||
    recurringScaling ||
    !lifecycle ||
    recurringStage === null ||
    (lifecycle.endTriggers?.length ?? 0) !== 0 ||
    (lifecycle.endOnConditionIds?.length ?? 0) !== 0 ||
    invocation.kind !== 'ACTION' ||
    entries.length !== 1 ||
    entry.resolutionKind !== 'DIRECT' ||
    entry.groupKind !== 'SINGLE' ||
    entry.rangeOverride ||
    entry.targetingOverride
  )
    return null
  const repeatSave =
    invocation.triggerCode === 'SAVING_THROW' && entry.pathCode === 'ON_SAVE_FAIL'
      ? (dnd5eRepeatSave({
          abilityDefinitionId: action.savingThrowAbilityDefinitionId,
          savingThrow: invocation.savingThrow,
          requestNodeId: 'd20'
        }) ??
        unsupported(
          'D&D recurring saving throws require one pinned ability definition and a fixed or caster save DC.'
        ))
      : null
  if (!repeatSave && (invocation.triggerCode !== 'ACTIVATED' || entry.pathCode !== 'ON_USE'))
    return null
  if (!UUID.test(entry.resultBlockId))
    unsupported('D&D recurring active-effect result blocks require a UUID-backed identity.')
  return {
    authoredEffectId: action.effectId,
    compiledEntryId: entry.resultBlockId,
    frozenGraphNodeId: repeatSave
      ? 'proposal-on_save_fail'
      : activeEffectGraphNodeId(entry.resultBlockId),
    capabilityContractVersion: DND5E_EFFECT_ACTION_CAPABILITY_CONTRACT_VERSION,
    recurrenceStage: recurringStage,
    initialRemaining: recurringAmount,
    ...(repeatSave ?? { adapterFacts: {} }),
    perceptionContributions: [],
    maintenance: maintenancePlan(action, entry),
    marginRiders: []
  }
}

/**
 * Hide: a successful check conceals the actor from the observers its total beats. It lasts until
 * dispelled and the events its lifecycle authors consume it (Hide: the first attack roll); any
 * other lifecycle stays unsupported. Its check settles it with no maintenance link, so a maintained
 * concealment is refused rather than settled unmaintained.
 */
function concealmentPlan(action: Dnd5eCompiledEffectActionSource): LifetimePlan | null {
  const { entries } = action.compiledEffect
  const entry = entries[0]
  if (entries.length !== 1 || !entry || !('outcome' in entry)) return null
  if (entry.outcome.effectKind !== 'CONCEAL_FROM_OBSERVERS') return null
  const { endTriggers = [], ...otherLifecycle } = entry.lifecycle ?? {}
  if (
    entry.duration?.durationKind !== 'UNTIL_DISPELLED' ||
    !endTriggers.every(
      (trigger) =>
        trigger.event === 'LIFECYCLE' && trigger.timing === 'CONSUME' && isGrantEndTrigger(trigger)
    ) ||
    Object.values(otherLifecycle).some((value) => value !== undefined) ||
    !UUID.test(entry.entryId)
  )
    return null
  if (maintenancePlan(action, entry))
    unsupported(
      'D&D concealment cannot be maintained: its check settles it with no maintenance link.'
    )
  return {
    authoredEffectId: action.effectId,
    compiledEntryId: entry.entryId,
    frozenGraphNodeId: 'conceal',
    capabilityContractVersion: DND5E_EFFECT_ACTION_CAPABILITY_CONTRACT_VERSION,
    recurrenceStage: 'NONE',
    initialRemaining: null,
    concealmentContribution: {
      observers: entry.outcome.observers,
      endTriggers: canonicalEndTriggers(endTriggers)
    },
    adapterFacts: {},
    perceptionContributions: [],
    maintenance: null,
    marginRiders: []
  }
}
