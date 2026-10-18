import {
  activeRuleEffectDefinitionDtoSchema,
  activeRuleEffectLifecycleDtoSchema,
  type ServerPublishedRuleDefinitionDto,
  type ServerRuleExecutionD20EvidenceDto,
  type ServerCompletedRuleExecutionDto
} from '@artificer-toolkit/schema/shared/rulesExecution'
import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import { compileRuleGraph, createRuleOperationRegistry } from '@artificer-toolkit/shared/rules'
import { normalizeObserverActorIds } from './encounterConcealment.js'
import {
  installedGameSystemRuleOperations,
  requireInstalledGameSystemRuleCapability
} from './platformRulesRuntime.js'
import type { CharacterGrantFoldModifier } from '@artificer-toolkit/schema/api/characterGrantFoldRules'
import type {
  CharacterRuleActionApplication,
  CharacterRuleActionActiveEffectPlan
} from './characterRuleActionSystemAdapter.js'

export class EncounterActionEffectPlanError extends Error {}

export function compileEffectGraph(
  published: ServerPublishedRuleDefinitionDto,
  contractVersion: number
) {
  const graph = compileRuleGraph({
    definition: published.definition,
    sourceChecksum: published.checksum,
    capability: requireInstalledGameSystemRuleCapability(published.gameSystemId),
    operations: createRuleOperationRegistry(installedGameSystemRuleOperations)
  })
  if (!graph.ok)
    throw new EncounterActionEffectPlanError(
      graph.diagnostics.map((item) => item.message).join(' ')
    )
  if (graph.value.capabilityContractVersion !== contractVersion)
    throw new EncounterActionEffectPlanError('Encounter effect capability contract is stale.')
  return graph.value
}

type EffectPlan = {
  definition: ReturnType<typeof activeRuleEffectDefinitionDtoSchema.parse>
  lifecycle: ReturnType<typeof activeRuleEffectLifecycleDtoSchema.parse>
}

const sizeRank: Record<string, number> = {
  FINE: 0,
  DIMUNITIVE: 1,
  TINY: 2,
  SMALL: 3,
  MEDIUM: 4,
  LARGE: 5,
  HUGE: 6,
  GARGANTUAN: 7,
  GIANT: 8,
  COLOSSAL: 9
}

/** Builds immutable effect definitions from one already-completed Encounter action. */
export function prepareEncounterActionEffectPlans(input: {
  encounterId: string
  occurrenceId: string
  commandId: string
  sourceActorId: string
  /** The acting Feature or action label a target state contribution freezes, when it has one. */
  sourceLabel: string | null
  /** Whether the acting actor is hidden from players; frozen with the label. */
  sourceHidden: boolean
  /** The Run's current actor, whose turn the action is taken in; null before the Run starts. */
  currentActorId: string | null
  target: {
    actorId: string
    conditionIds: readonly string[]
    effectiveSize: string | null
    lifetimeScope: 'OWNER' | 'ENCOUNTER'
    activeEffects: readonly ActiveRuleEffectRecord[]
  }
  activeEffectsByActorId: ReadonlyMap<string, readonly ActiveRuleEffectRecord[]>
  activeEffectPlan: CharacterRuleActionActiveEffectPlan | null
  /**
   * What a settled concealment check decided: the total it froze and the observers it beats, or
   * null when it beats none. Omitted for every action that plans no concealment.
   */
  concealment?: { concealmentTotal: number; observerActorIds: readonly string[] } | null
  /** The creatures a bonding action settled on, itself included; omitted for every other action. */
  link?: { memberActorIds: readonly string[] }
  /** The Creature the caster chose for a form-giving action (D130); omitted for every other action. */
  form?: { creatureId: string }
  published: ServerPublishedRuleDefinitionDto
  execution: ServerCompletedRuleExecutionDto
  d20: ServerRuleExecutionD20EvidenceDto | null
  applications: readonly CharacterRuleActionApplication[]
  /** What triggered a reaction, which its effect may bind (resistance to the triggering damage). */
  trigger?: { damageTypeIds: readonly string[] }
}): {
  stateEffect: EffectPlan | null
  recurringEffect: EffectPlan | null
  /**
   * The effect holding a failure-margin rider's conditions, beside the recurring effect it rides on.
   * It is created only when the save failed by the margin, which the caller reads from the rider's
   * applied conditions.
   */
  riderEffect: EffectPlan | null
  relationshipConditionApplications: readonly Extract<
    CharacterRuleActionApplication,
    { kind: 'CONDITION_APPLY' }
  >[]
} {
  const stateEffect = prepareTargetStateEffect(input)
  const recurringEffect = prepareRecurringActiveEffect(input)
  const plan = input.activeEffectPlan
  const rider = plan?.marginRider ?? null
  // The rider shares the effect's duration graph under its own entry, and ends on its own triggers.
  const riderEffect =
    plan && rider
      ? prepareRecurringActiveEffect({
          ...input,
          activeEffectPlan: {
            ...plan,
            compiledEntryId: rider.compiledEntryId,
            frozenGraphNodeId: rider.frozenGraphNodeId,
            conditionContributions: rider.conditionContributions,
            lifecycle: {
              consumeOnFirstEvents: [],
              endOnEvents: [],
              endOnTriggers: rider.lifecycle.endOnTriggers
            },
            marginRider: null
          }
        })
      : null
  const relationshipConditionApplications =
    recurringEffect?.definition.schemaVersion === 2
      ? (() => {
          const relationshipContribution = input.activeEffectPlan?.actorRelationshipContribution
          if (!relationshipContribution) return []
          const authoredPath =
            recurringEffect.definition.adapterFacts['dnd5e.relationship-authored-path']
          if (authoredPath !== 'ON_HIT' && authoredPath !== 'ON_CRIT')
            throw new EncounterActionEffectPlanError(
              'Encounter relationship authored path is unavailable.'
            )
          const relationshipConditionIds = recurringEffect.definition.stateContributions.flatMap(
            (contribution) =>
              contribution.kind === 'ACTOR_RELATIONSHIP' ? contribution.conditionIds : []
          )
          return recurringEffect.definition.stateContributions.flatMap((contribution) =>
            contribution.kind === 'CONDITION_OWNERSHIP' &&
            relationshipConditionIds.includes(contribution.conditionId) &&
            !contribution.baselinePresent &&
            !input.target.conditionIds.includes(contribution.conditionId)
              ? [
                  {
                    kind: 'CONDITION_APPLY' as const,
                    targetActorId: input.target.actorId,
                    conditionId: contribution.conditionId,
                    // The relationship's own active effect receipt binds these conditions.
                    sourceNodeId: recurringEffect.definition.frozenGraphNodeId,
                    sourceOperationKey: 'dnd5e.actor-relationship-state',
                    authoredPath,
                    resolvedPath: input.d20!.resultPath
                  }
                ]
              : []
          )
        })()
      : []
  return { stateEffect, recurringEffect, riderEffect, relationshipConditionApplications }
}

/**
 * A hit outcome applies on any hit, a critical-hit outcome only on a critical hit, and a failed-save
 * outcome only on a failed save.
 */
function reachesAuthoredPath(
  authoredPath: unknown,
  resultPath: string | undefined,
  outcome: 'grant' | 'relationship'
): boolean {
  if (outcome === 'grant' && authoredPath === 'ON_SAVE_FAIL') return resultPath === 'ON_SAVE_FAIL'
  if (authoredPath !== 'ON_HIT' && authoredPath !== 'ON_CRIT')
    throw new EncounterActionEffectPlanError(`Encounter ${outcome} authored path is unavailable.`)
  return resultPath === 'ON_CRIT' || (authoredPath === 'ON_HIT' && resultPath === 'ON_HIT')
}

/**
 * The concealment a settled Hide freezes on its roller, or null when its total beats no observer.
 * The roller is the effect's holder and source; nothing else about the action reaches it.
 */
export function prepareEncounterConcealmentEffect(
  input: Pick<
    Parameters<typeof prepareEncounterActionEffectPlans>[0],
    | 'encounterId'
    | 'occurrenceId'
    | 'commandId'
    | 'sourceActorId'
    | 'sourceLabel'
    | 'sourceHidden'
    | 'currentActorId'
    | 'activeEffectPlan'
    | 'published'
  > & {
    concealment: NonNullable<Parameters<typeof prepareEncounterActionEffectPlans>[0]['concealment']>
  }
): EffectPlan | null {
  return prepareRecurringActiveEffect({
    ...input,
    target: {
      actorId: input.sourceActorId,
      conditionIds: [],
      effectiveSize: null,
      lifetimeScope: 'ENCOUNTER',
      activeEffects: []
    },
    activeEffectsByActorId: new Map(),
    d20: null
  })
}

/** The distinct events of both lists, sorted. */
function sortedUnion<Event extends string>(
  first: readonly Event[] | undefined,
  second: readonly Event[] | undefined
): Event[] {
  return [...new Set([...(first ?? []), ...(second ?? [])])].sort()
}

/**
 * Resistance to "the triggering damage type" becomes one resistance per damage type that triggered the
 * reaction; any other modifier stays as authored.
 */
function bindTriggerDamageTypes(
  modifier: CharacterGrantFoldModifier,
  damageTypeIds: readonly string[]
): CharacterGrantFoldModifier[] {
  const { payload } = modifier
  if (payload === undefined || !('damageTypeSource' in payload)) return [modifier]
  if (damageTypeIds.length === 0)
    throw new EncounterActionEffectPlanError(
      'A resistance to the triggering damage type needs the damage that triggered the reaction.'
    )
  return damageTypeIds.map((damageTypeId) => ({
    ...modifier,
    grantId: `${modifier.grantId}:${damageTypeId}`,
    payload: { damageTypeId }
  }))
}

function prepareRecurringActiveEffect(
  input: Omit<Parameters<typeof prepareEncounterActionEffectPlans>[0], 'execution' | 'applications'>
): EffectPlan | null {
  const plan = input.activeEffectPlan
  if (!plan) return null
  const frozenGraph = plan.frozenGraph
  if (
    plan.authoredEffectId !== input.published.id ||
    frozenGraph.id !== plan.authoredEffectId ||
    frozenGraph.definition.sourceEntryBindings?.filter(
      (binding) =>
        binding.sourceEntryId === plan.compiledEntryId && binding.nodeId === plan.frozenGraphNodeId
    ).length !== 1
  )
    throw new EncounterActionEffectPlanError('Encounter Feature recurring-effect plan is stale.')
  const conditionContributions = plan.conditionContributions ?? []
  const endLifecycle = plan.lifecycle
  const relationshipContribution = plan.actorRelationshipContribution ?? null
  const grantContribution = plan.modifierGrantContribution ?? null
  if (plan.concealmentContribution && input.concealment === undefined)
    throw new EncounterActionEffectPlanError('A concealment plan requires its settled check.')
  const concealment = plan.concealmentContribution ? (input.concealment ?? null) : null
  const linkContribution = plan.actorLinkContribution ?? null
  if (linkContribution && !input.link)
    throw new EncounterActionEffectPlanError('A link plan requires the creatures it bonds.')
  const linkMemberActorIds = linkContribution ? (input.link?.memberActorIds ?? []) : []
  if (linkContribution && linkMemberActorIds.length < 2) return null
  const formContribution = plan.creatureFormContribution ?? null
  // A form after a saving throw (Polymorph) is entered only by a creature that failed it.
  if (formContribution && plan.adapterFacts['dnd5e.form-authored-path'] === 'ON_SAVE_FAIL') {
    if (input.d20?.resultPath !== 'ON_SAVE_FAIL') return null
  }
  if (formContribution) {
    if (!input.form)
      throw new EncounterActionEffectPlanError('A form plan requires its chosen form.')
    // A filtered choice is checked against the System creature corpus where the cast is read.
    if (
      formContribution.filter === null &&
      !formContribution.forms.some(({ creatureId }) => creatureId === input.form?.creatureId)
    )
      throw new EncounterActionEffectPlanError('The chosen form is not one the action authors.')
    // An actor already in a form keeps it: the new form does not stack on it.
    if (
      input.target.activeEffects.some(
        (effect) =>
          effect.definition.schemaVersion === 2 &&
          effect.definition.stateContributions.some(({ kind }) => kind === 'CREATURE_FORM')
      )
    )
      throw new EncounterActionEffectPlanError('The target cannot take a creature form.')
  }
  if (plan.concealmentContribution && !concealment?.observerActorIds.length) return null
  const grantLabel = input.sourceLabel?.trim() ?? ''
  if (grantContribution && !grantLabel)
    throw new EncounterActionEffectPlanError('A modifier grant requires a source label.')
  const grantHitPath = grantContribution
    ? plan.adapterFacts['dnd5e.grant-authored-path']
    : undefined
  if (
    grantHitPath !== undefined &&
    !reachesAuthoredPath(grantHitPath, input.d20?.resultPath, 'grant')
  )
    return null
  if (relationshipContribution) {
    if (
      !reachesAuthoredPath(
        plan.adapterFacts['dnd5e.relationship-authored-path'],
        input.d20?.resultPath,
        'relationship'
      )
    )
      return null
    const maximum = relationshipContribution.modules.find(
      (module) => module.kind === 'TARGET_SIZE_MAXIMUM'
    )
    if (
      maximum &&
      (input.target.effectiveSize === null ||
        sizeRank[input.target.effectiveSize] === undefined ||
        sizeRank[maximum.sizeCode] === undefined ||
        sizeRank[input.target.effectiveSize] > sizeRank[maximum.sizeCode])
    )
      return null
    const sameSourceRelationships = [...input.activeEffectsByActorId.entries()].flatMap(
      ([actorId, effects]) =>
        effects.flatMap((effect) =>
          effect.definition.schemaVersion === 2 &&
          effect.definition.origin.kind === 'ENCOUNTER' &&
          effect.definition.origin.sourceActorId === input.sourceActorId
            ? effect.definition.stateContributions.flatMap((contribution) =>
                contribution.kind === 'ACTOR_RELATIONSHIP' ? [{ actorId, contribution }] : []
              )
            : []
        )
    )
    const heldByOutcome = new Set(
      sameSourceRelationships.flatMap(({ actorId, contribution }) =>
        actorId !== input.target.actorId &&
        contribution.relationshipOutcomeId === relationshipContribution.relationshipOutcomeId
          ? [actorId]
          : []
      )
    )
    if (heldByOutcome.size >= relationshipContribution.heldAtOnce) return null
    if (
      relationshipContribution.modules.some(
        (module) =>
          module.kind === 'SOURCE_ACTION_TARGET_RESTRICTION' &&
          module.actionEffectIds.includes(plan.authoredEffectId)
      ) &&
      sameSourceRelationships.some(
        ({ actorId, contribution }) =>
          actorId === input.target.actorId &&
          contribution.modules.some(
            (module) =>
              module.kind === 'SOURCE_ACTION_TARGET_RESTRICTION' &&
              module.actionEffectIds.includes(plan.authoredEffectId)
          )
      )
    )
      return null
  }
  const conditionBaselinePresent = (conditionId: string): boolean => {
    const existingBaselines = input.target.activeEffects.flatMap((effect) =>
      effect.definition.schemaVersion === 2
        ? effect.definition.stateContributions.flatMap((contribution) =>
            contribution.kind === 'CONDITION_OWNERSHIP' && contribution.conditionId === conditionId
              ? [contribution.baselinePresent]
              : []
          )
        : []
    )
    const baselinePresent = existingBaselines[0] ?? input.target.conditionIds.includes(conditionId)
    if (existingBaselines.some((existing) => existing !== baselinePresent))
      throw new EncounterActionEffectPlanError(
        'The target condition contribution baseline is inconsistent.'
      )
    return baselinePresent
  }
  const relationshipConditionIds = relationshipContribution
    ? [
        ...relationshipContribution.conditionIds,
        ...(input.d20?.rollMode === 'ADVANTAGE'
          ? relationshipContribution.modules.flatMap((module) =>
              module.kind === 'CONDITIONAL_TARGET_STATE' ? module.conditionIds : []
            )
          : [])
      ].filter((conditionId, index, values) => values.indexOf(conditionId) === index)
    : []
  if (plan.castSaveDcFactKey && !input.d20)
    throw new EncounterActionEffectPlanError('The repeated save needs the cast save DC.')
  const castSaveDcFact =
    plan.castSaveDcFactKey && input.d20
      ? { key: plan.castSaveDcFactKey, dc: input.d20.defenseOrDc }
      : null
  const tickAnchor = grantContribution?.tickAnchor ?? 'HOLDER'
  // A grant made on its anchor actor's own turn would otherwise lose a counted turn to the very
  // end of turn it was made in, so "until the end of the next turn" counts one more. A duration
  // "for the turn" already is that end of turn.
  const initialRemaining =
    plan.initialRemaining !== null &&
    grantContribution &&
    !grantContribution.includesCurrentTurn &&
    !grantContribution.countedByTurnEffects &&
    plan.recurrenceStage === 'END_OF_TURN' &&
    input.currentActorId ===
      (grantContribution.tickAnchor === 'SOURCE' ? input.sourceActorId : input.target.actorId)
      ? plan.initialRemaining + 1
      : plan.initialRemaining
  const definition = activeRuleEffectDefinitionDtoSchema.parse({
    schemaVersion:
      conditionContributions.length > 0 ||
      relationshipContribution ||
      grantContribution ||
      concealment ||
      linkContribution ||
      formContribution
        ? 2
        : 1,
    origin: {
      kind: 'ENCOUNTER',
      sourceAggregateId: input.encounterId,
      sourceOccurrenceId: input.occurrenceId,
      rootCommandId: input.commandId,
      sourceActorId: input.sourceActorId
    },
    authoredEffectId: plan.authoredEffectId,
    compiledEntryId: plan.compiledEntryId,
    frozenGraphNodeId: plan.frozenGraphNodeId,
    frozenGraph: compileEffectGraph(frozenGraph, plan.capabilityContractVersion),
    adapterFacts: castSaveDcFact
      ? { ...plan.adapterFacts, [castSaveDcFact.key]: castSaveDcFact.dc }
      : plan.adapterFacts,
    perceptionContributions: plan.perceptionContributions,
    recurrence: {
      // The grant tick planner counts a grant, so the turn-effect kernel never selects it, unless the
      // grant repeats a save: the kernel then rolls, counts and ends it.
      recurrenceStage:
        grantContribution && !grantContribution.countedByTurnEffects
          ? 'NONE'
          : plan.recurrenceStage,
      // A grant held beside conditions (Hypnotic Pattern's speed 0) ends with them, so the plan's
      // own lifecycle joins the grant's.
      consumeOnFirstEvents: sortedUnion(
        grantContribution?.consumeOnFirstEvents ??
          plan.concealmentContribution?.consumeOnFirstEvents,
        endLifecycle?.consumeOnFirstEvents
      ),
      endOnEvents: sortedUnion(grantContribution?.endOnEvents, endLifecycle?.endOnEvents),
      endOnTriggers: endLifecycle?.endOnTriggers ?? [],
      endOnConditionIds: grantContribution?.endOnConditionIds ?? [],
      holderEnd: grantContribution?.holderEnd ?? null,
      // A grant or condition outlasts the Encounter when the target's lifetime scope says so. A
      // Concentration effect keeps its maintenance link while the Run lasts and is detached from it
      // at COMPLETE.
      lifetimeScope:
        grantContribution || conditionContributions.length > 0 || linkContribution
          ? input.target.lifetimeScope
          : 'ENCOUNTER',
      expiration:
        initialRemaining === null
          ? { kind: 'INDEFINITE' }
          : {
              kind: 'TICKS',
              initialRemaining,
              decrementStage: plan.recurrenceStage,
              anchor: tickAnchor
            }
    },
    ...(conditionContributions.length > 0 ||
    relationshipContribution ||
    grantContribution ||
    concealment ||
    linkContribution ||
    formContribution
      ? {
          stateContributions: [
            ...(formContribution && input.form
              ? [
                  {
                    kind: 'CREATURE_FORM' as const,
                    formOutcomeId: formContribution.formOutcomeId,
                    creatureId: input.form.creatureId,
                    excessDamageCarriesOver: formContribution.excessDamageCarriesOver
                  }
                ]
              : []),
            ...(linkContribution
              ? [
                  {
                    kind: 'ACTOR_LINK' as const,
                    linkOutcomeId: linkContribution.linkOutcomeId,
                    linkKind: linkContribution.linkKind,
                    memberActorIds: [...linkMemberActorIds].sort()
                  }
                ]
              : []),
            ...(concealment
              ? [
                  {
                    kind: 'LOCATION_CONCEALMENT' as const,
                    concealmentTotal: concealment.concealmentTotal
                  }
                ]
              : []),
            ...(grantContribution
              ? [
                  {
                    kind: 'MODIFIER_GRANT' as const,
                    applyGrantOutcomeId: grantContribution.applyGrantOutcomeId,
                    modifiers: grantContribution.modifiers.flatMap((modifier) =>
                      bindTriggerDamageTypes(modifier, input.trigger?.damageTypeIds ?? [])
                    ),
                    senses: grantContribution.senses,
                    sourceLabel: grantLabel,
                    sourceHidden: input.sourceHidden
                  }
                ]
              : []),
            ...conditionContributions.map((contribution) => ({
              kind: 'CONDITION_OWNERSHIP' as const,
              conditionId: contribution.conditionId,
              baselinePresent: conditionBaselinePresent(contribution.conditionId),
              ...(contribution.recordsSource && {
                sourceActorId: input.sourceActorId,
                ...(contribution.fleesSource && { fleesSource: true })
              })
            })),
            ...relationshipConditionIds.map((conditionId) => ({
              kind: 'CONDITION_OWNERSHIP' as const,
              conditionId,
              baselinePresent: conditionBaselinePresent(conditionId)
            })),
            ...(relationshipContribution
              ? [
                  {
                    kind: 'ACTOR_RELATIONSHIP' as const,
                    relationshipOutcomeId: relationshipContribution.relationshipOutcomeId,
                    modules: relationshipContribution.modules,
                    conditionIds: relationshipConditionIds,
                    capabilitySuppressions: [
                      ...relationshipContribution.capabilitySuppressions,
                      ...(input.d20?.rollMode === 'ADVANTAGE'
                        ? relationshipContribution.modules.flatMap((module) =>
                            module.kind === 'CONDITIONAL_TARGET_STATE'
                              ? [
                                  {
                                    contributionId: module.id,
                                    capabilityDefinitionIds: module.capabilityDefinitionIds
                                  }
                                ]
                              : []
                          )
                        : [])
                    ]
                  }
                ]
              : [])
          ]
        }
      : {})
  })
  return {
    definition,
    lifecycle: activeRuleEffectLifecycleDtoSchema.parse({
      schemaVersion: 1,
      remainingTicks: initialRemaining,
      ...(concealment
        ? { concealedFromActorIds: normalizeObserverActorIds(concealment.observerActorIds) }
        : {})
    })
  }
}

function prepareTargetStateEffect(
  input: Parameters<typeof prepareEncounterActionEffectPlans>[0]
): EffectPlan | null {
  const contributions = input.applications.filter(
    (
      application
    ): application is Extract<
      CharacterRuleActionApplication,
      { kind: 'HIT_POINT_MAXIMUM_REDUCTION' | 'SCALAR_REDUCTION' }
    > =>
      application.kind === 'HIT_POINT_MAXIMUM_REDUCTION' || application.kind === 'SCALAR_REDUCTION'
  )
  if (!contributions.length) return null
  if (contributions.length !== 1)
    throw new EncounterActionEffectPlanError(
      'An action may create at most one target state contribution.'
    )
  const contribution = contributions[0]!
  const sourceLabel = input.sourceLabel?.trim() ?? ''
  if (contribution.kind === 'HIT_POINT_MAXIMUM_REDUCTION' && !sourceLabel)
    throw new EncounterActionEffectPlanError(
      'A hit point maximum reduction requires its action label.'
    )
  const evidence = input.execution.evidence
  if (
    evidence.source.definitionId !== input.published.id ||
    evidence.source.gameSystemId !== input.published.gameSystemId ||
    evidence.source.definitionFamilyKey !== input.published.definitionFamilyKey ||
    evidence.source.checksum !== input.published.checksum
  )
    throw new EncounterActionEffectPlanError(
      'The active-effect source graph changed before settlement.'
    )
  const bindings = (evidence.sourceEntryBindings ?? []).filter(
    (binding) => binding.nodeId === contribution.sourceNodeId
  )
  if (bindings.length !== 1)
    throw new EncounterActionEffectPlanError(
      'The target state contribution must retain one exact compiled source binding.'
    )
  const binding = bindings[0]!
  const graphNode = input.published.definition.nodes.find((node) => node.id === binding.nodeId)
  if (!graphNode || graphNode.operation.key !== contribution.sourceOperationKey)
    throw new EncounterActionEffectPlanError(
      'The target state contribution source binding is stale.'
    )
  const definition = activeRuleEffectDefinitionDtoSchema.parse({
    schemaVersion: 2,
    origin: {
      kind: 'ENCOUNTER',
      sourceAggregateId: input.encounterId,
      sourceOccurrenceId: input.occurrenceId,
      rootCommandId: input.commandId,
      sourceActorId: input.sourceActorId
    },
    authoredEffectId: input.published.id,
    compiledEntryId: binding.sourceEntryId,
    frozenGraphNodeId: binding.nodeId,
    frozenGraph: compileEffectGraph(input.published, evidence.capabilityContractVersion),
    adapterFacts: {},
    perceptionContributions: [],
    recurrence: {
      recurrenceStage: 'NONE',
      consumeOnFirstEvents: [],
      endOnEvents: [],
      endOnTriggers: [],
      endOnConditionIds: [],
      holderEnd: null,
      lifetimeScope: input.target.lifetimeScope,
      expiration: { kind: 'INDEFINITE' }
    },
    stateContributions: [
      contribution.kind === 'HIT_POINT_MAXIMUM_REDUCTION'
        ? {
            kind: 'HIT_POINT_MAXIMUM_REDUCTION' as const,
            amount: contribution.reductionAmount,
            sourceDamageOutcomeId: contribution.sourceDamageOutcomeId,
            sourceDamageNodeId: contribution.sourceDamageNodeId,
            sourceDamageOperationKey: contribution.sourceDamageOperationKey,
            recoveryTags: contribution.recoveryTags,
            sourceLabel,
            sourceHidden: input.sourceHidden
          }
        : {
            kind: 'SCALAR_REDUCTION' as const,
            valueDefinitionId: contribution.valueDefinitionId,
            amount: contribution.reductionAmount,
            stacking: contribution.stacking,
            floor: contribution.floor,
            recoveryTriggers: contribution.recoveryTriggers,
            terminalConsequence: contribution.terminalConsequence,
            sourceOutcomeId: contribution.sourceOutcomeId,
            sourceNodeId: contribution.sourceNodeId,
            sourceOperationKey: contribution.sourceOperationKey
          }
    ]
  })
  return {
    definition,
    lifecycle: activeRuleEffectLifecycleDtoSchema.parse({ schemaVersion: 1, remainingTicks: null })
  }
}
