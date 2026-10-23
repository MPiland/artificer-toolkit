import {
  activeRuleEffectDefinitionDtoSchema,
  activeRuleEffectLifecycleDtoSchema,
  type ServerPublishedRuleDefinitionDto,
  type ServerRuleExecutionD20EvidenceDto,
  type ServerCompletedRuleExecutionDto
} from '@artificer-toolkit/schema/shared/rulesExecution'
import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import type { CompiledRepeatSourcePathOffer } from '@artificer-toolkit/schema/effects/storedEffectOffer'
import { sizeRank } from '@artificer-toolkit/shared/core'
import { compileRuleGraph, createRuleOperationRegistry } from '@artificer-toolkit/shared/rules'
import { normalizeObserverActorIds } from './encounterConcealment.js'
import { attackSlotConditionHolds, type AttackSlotAttack } from './encounterAttackSlots.js'
import { encounterSourceRelationships } from './encounterRelationshipActionFacts.js'
import {
  installedGameSystemRuleOperations,
  requireInstalledGameSystemRuleCapability
} from './platformRulesRuntime.js'
import type {
  CharacterGrantFoldModifier,
  EquipmentInstanceMechanicSource
} from '@artificer-toolkit/schema/api/characterGrantFoldRules'
import type {
  CharacterRuleActionApplication,
  CharacterRuleActionActiveEffectPlan
} from './characterRuleActionSystemAdapter.js'

type RiderEndsWith = NonNullable<
  CharacterRuleActionActiveEffectPlan['marginRiders'][number]['endsWith']
>

export class EncounterActionEffectPlanError extends Error {}

/**
 * Whether a condition an effect comes to own was present without it: the baseline the holder's
 * other owners of the condition already record, else whether the holder has the condition now.
 */
export function conditionBaselinePresent(
  holder: {
    activeEffects: readonly Pick<ActiveRuleEffectRecord, 'definition'>[]
    conditionIds: readonly string[]
  },
  conditionId: string
): boolean {
  const existingBaselines = holder.activeEffects.flatMap((effect) =>
    effect.definition.stateContributions.flatMap((contribution) =>
      contribution.kind === 'CONDITION_OWNERSHIP' && contribution.conditionId === conditionId
        ? [contribution.baselinePresent]
        : []
    )
  )
  const baselinePresent = existingBaselines[0] ?? holder.conditionIds.includes(conditionId)
  if (existingBaselines.some((existing) => existing !== baselinePresent))
    throw new EncounterActionEffectPlanError(
      'The target condition contribution baseline is inconsistent.'
    )
  return baselinePresent
}

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

export type EffectPlan = {
  definition: ReturnType<typeof activeRuleEffectDefinitionDtoSchema.parse>
  lifecycle: ReturnType<typeof activeRuleEffectLifecycleDtoSchema.parse>
  /** Set on a rider that ends with another effect of its action (D172); `linkedEffectId` is set at creation. */
  endsWith?: RiderEndsWith
}

/** Builds immutable effect definitions from one already-completed Encounter action. */
export function prepareEncounterActionEffectPlans(input: {
  encounterId: string
  occurrenceId: string
  commandId: string
  sourceActorId: string
  /** The acting Feature or action label a target state contribution freezes, when it has one. */
  sourceLabel: string | null
  /**
   * The acting Character, which a source immunity keys beyond the Run; null for a Creature. Omitted
   * for every action that plans no immunity.
   */
  sourceCharacterId?: string | null
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
  /** The source's reach in feet a relationship plan seals; omitted for every action that plans none. */
  sealedReachFeet?: number
  /**
   * The open Attack action's earlier attacks and this one, which a relationship gated by
   * `appliesWhen` reads; null or omitted outside an open Attack action, where a gated hold never applies.
   */
  attacks?: { earlier: readonly AttackSlotAttack[]; current: AttackSlotAttack } | null
  /**
   * What a settled concealment check decided: the total it froze and the observers it beats, or
   * null when it beats none. Omitted for every action that plans no concealment.
   */
  concealment?: { concealmentTotal: number; observerActorIds: readonly string[] } | null
  /** The creatures a bonding action settled on, itself included; omitted for every other action. */
  link?: { memberActorIds: readonly string[] }
  /** The Creature the caster chose for a form-giving action (D130); omitted for every other action. */
  form?: { creatureId: string }
  /**
   * The target's item the action was used on and whether the target dropped it; omitted for every
   * action that chooses none.
   */
  chosenItem?: { item: EquipmentInstanceMechanicSource; released: boolean }
  /** The level the spell was cast at, which a repeat offer freezes; omitted for a cast that has none. */
  spellCastLevel?: number
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
   * The effects the action adds beside the recurring effect, one per planned rider and in its
   * order: a failure-margin rider's or a timed band condition's conditions, each created only when
   * its conditions were applied (which the caller reads from them), or the one source immunity (a
   * successful save's, or a grant's lockout on every target). A rider not created is null, so
   * `endsWith` indices stay valid. Immunity and riders never meet.
   */
  riderEffects: (EffectPlan | null)[]
  relationshipConditionApplications: readonly Extract<
    CharacterRuleActionApplication,
    { kind: 'CONDITION_APPLY' }
  >[]
} {
  const stateEffect = prepareTargetStateEffect(input)
  const recurringEffect = prepareRecurringActiveEffect(input)
  const plan = input.activeEffectPlan
  // A rider shares the effect's duration graph under its own entry, and ends on its own triggers.
  const immunity = plan?.sourceImmunity ?? null
  const riderEffects =
    immunity &&
    (immunity.appliesTo === 'EVERY_TARGET' || input.d20?.resultPath === 'ON_SAVE_SUCCESS')
      ? [prepareSourceImmunityEffect(input)]
      : plan?.repeatCarrier
        ? [prepareRepeatCarrierEffect(input)]
        : (plan?.marginRiders ?? []).map((rider) => {
            const effect = prepareRecurringActiveEffect({
              ...input,
              activeEffectPlan: {
                ...plan!,
                compiledEntryId: rider.compiledEntryId,
                frozenGraphNodeId: rider.frozenGraphNodeId,
                conditionContributions: rider.conditionContributions,
                initialRemaining: rider.initialRemaining ?? plan!.initialRemaining,
                lifecycle: {
                  consumeOnFirstEvents: [],
                  endOnEvents: [],
                  endOnTriggers: rider.lifecycle.endOnTriggers
                },
                marginRiders: []
              }
            })
            return effect && rider.endsWith !== null
              ? { ...effect, endsWith: rider.endsWith }
              : effect
          })
  const relationshipApplications =
    recurringEffect && input.activeEffectPlan?.actorRelationshipContribution
      ? relationshipConditionApplications({
          definition: recurringEffect.definition,
          target: input.target,
          resolvedPath: input.d20?.resultPath ?? 'ON_USE'
        })
      : []
  return {
    stateEffect,
    recurringEffect,
    riderEffects,
    relationshipConditionApplications: relationshipApplications
  }
}

/** A rider's seed in a deterministic effect id: the first keeps the bare name every action has used. */
export const riderEffectKey = (index: number) => (index === 0 ? 'RIDER' : `RIDER${index + 1}`)

/**
 * Creates a plan's riders in order, each naming (D172) the effect it ends with: the recurring
 * effect, or an earlier rider. Whatever ends that effect ends the rider in the same transaction.
 * Every root that creates an action's effects calls this, so the link is made one way. A rider whose
 * target was not created (its target holds none) is created unlinked and lasts its own duration.
 */
export function createLinkedRiders<TRecord extends { readonly id: string }>(
  riders: readonly (EffectPlan | null)[],
  recurring: { readonly id: string } | null,
  create: (plan: EffectPlan | null, index: number) => TRecord | null
): (TRecord | null)[] {
  const created: (TRecord | null)[] = []
  for (const [index, rider] of riders.entries()) {
    if (rider?.endsWith === undefined) {
      created.push(create(rider, index))
      continue
    }
    const { endsWith, ...plan } = rider
    const target = endsWith === 'PRIMARY' ? recurring : (created[endsWith] ?? null)
    created.push(
      create(
        target ? { ...plan, definition: { ...plan.definition, linkedEffectId: target.id } } : plan,
        index
      )
    )
  }
  return created
}

/**
 * The conditions a relationship effect (Grapple's hold) newly applies to its target: each one its
 * relationship names that was absent without it and that the target lacks now. Its own receipt binds
 * them, so planning and settlement derive the same applications from the stored definition.
 */
export function relationshipConditionApplications(input: {
  definition: ActiveRuleEffectRecord['definition']
  target: { actorId: string; conditionIds: readonly string[] }
  resolvedPath: string
}): Extract<CharacterRuleActionApplication, { kind: 'CONDITION_APPLY' }>[] {
  const { definition } = input
  const authoredPath = definition.adapterFacts['dnd5e.relationship-authored-path']
  if (
    authoredPath !== 'ON_HIT' &&
    authoredPath !== 'ON_CRIT' &&
    authoredPath !== 'ON_CHECK_SUCCESS' &&
    authoredPath !== 'ON_USE'
  )
    throw new EncounterActionEffectPlanError('Encounter relationship authored path is unavailable.')
  const relationshipConditionIds = definition.stateContributions.flatMap((contribution) =>
    contribution.kind === 'ACTOR_RELATIONSHIP' ? contribution.conditionIds : []
  )
  return definition.stateContributions.flatMap((contribution) =>
    contribution.kind === 'CONDITION_OWNERSHIP' &&
    relationshipConditionIds.includes(contribution.conditionId) &&
    !contribution.baselinePresent &&
    !input.target.conditionIds.includes(contribution.conditionId)
      ? [
          {
            kind: 'CONDITION_APPLY' as const,
            targetActorId: input.target.actorId,
            conditionId: contribution.conditionId,
            sourceNodeId: definition.frozenGraphNodeId,
            sourceOperationKey: 'dnd5e.actor-relationship-state',
            authoredPath,
            resolvedPath: input.resolvedPath
          }
        ]
      : []
  )
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
  if (
    payload === undefined ||
    !('damageTypeSource' in payload) ||
    payload.damageTypeSource !== 'TRIGGER'
  )
    return [modifier]
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

/** An action's lasting effect on one creature, from its plan alone; null when the plan yields none. */
export function prepareRecurringActiveEffect(
  input: Omit<
    Parameters<typeof prepareEncounterActionEffectPlans>[0],
    'execution' | 'applications'
  > &
    Partial<Pick<Parameters<typeof prepareEncounterActionEffectPlans>[0], 'execution'>>
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
  // An effect authored on a test's result path is made only when the test resolved to one of its paths.
  if (plan.resultGate && !plan.resultGate.paths.some((path) => path === input.d20?.resultPath))
    return null
  const conditionContributions = plan.conditionContributions ?? []
  const endLifecycle = plan.lifecycle
  const relationshipContribution = plan.actorRelationshipContribution ?? null
  const sealedReachFeet = relationshipContribution ? input.sealedReachFeet : 0
  if (sealedReachFeet === undefined)
    throw new EncounterActionEffectPlanError('A relationship plan requires the reach it seals.')
  const chosenItem = plan.chosenItem ?? null
  if (chosenItem && !input.chosenItem)
    throw new EncounterActionEffectPlanError('A chosen-item plan requires the item it was used on.')
  // A grant owed only while the target keeps the item (Heat Metal's disadvantage) is not made once
  // it drops it.
  if (chosenItem?.grantUnlessReleased && input.chosenItem?.released) return null
  const boundItem = chosenItem?.bindsGrant ? input.chosenItem?.item : undefined
  const grantContribution = plan.modifierGrantContribution ?? null
  if (plan.concealmentContribution && input.concealment === undefined)
    throw new EncounterActionEffectPlanError('A concealment plan requires its settled check.')
  const concealment = plan.concealmentContribution ? (input.concealment ?? null) : null
  const linkContribution = plan.actorLinkContribution ?? null
  if (linkContribution && !input.link)
    throw new EncounterActionEffectPlanError('A link plan requires the creatures it bonds.')
  const linkMemberActorIds = linkContribution ? (input.link?.memberActorIds ?? []) : []
  if (linkContribution && linkMemberActorIds.length < 2) return null
  const absenceContribution = plan.playAbsenceContribution ?? null
  const formContribution = plan.creatureFormContribution ?? null
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
      input.target.activeEffects.some((effect) =>
        effect.definition.stateContributions.some(({ kind }) => kind === 'CREATURE_FORM')
      )
    )
      throw new EncounterActionEffectPlanError('The target cannot take a creature form.')
  }
  if (plan.concealmentContribution && !concealment?.observerActorIds.length) return null
  const grantLabel = input.sourceLabel?.trim() ?? ''
  if (grantContribution && !grantLabel)
    throw new EncounterActionEffectPlanError('A modifier grant requires a source label.')
  if (relationshipContribution) {
    const { appliesWhen } = relationshipContribution
    if (
      appliesWhen &&
      !(
        input.attacks &&
        attackSlotConditionHolds(appliesWhen, input.attacks.current, input.attacks.earlier)
      )
    )
      return null
    const maximum = relationshipContribution.modules.find(
      (module) => module.kind === 'TARGET_SIZE_MAXIMUM'
    )
    const targetRank = sizeRank(input.target.effectiveSize)
    const maximumRank = maximum ? sizeRank(maximum.sizeCode) : null
    if (maximum && (targetRank === null || maximumRank === null || targetRank > maximumRank))
      return null
    const sameSourceRelationships = encounterSourceRelationships(
      input.activeEffectsByActorId,
      input.sourceActorId
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
  const castFacts = Object.fromEntries(
    (plan.castFactKeys ?? []).map((key) => {
      const value = input.execution?.evidence.facts[key]
      if (value === undefined)
        throw new EncounterActionEffectPlanError('The effect needs a fact its cast settles.')
      return [key, value]
    })
  )
  const ownsTemporaryHitPoints = plan.ownsTemporaryHitPoints === true
  const tickAnchor = plan.tickAnchor ?? 'HOLDER'
  // The grant tick planner counts a grant, unless it repeats a save, and any other effect counted on
  // its source's turns (Color Spray's blindness); the turn-effect kernel counts the rest.
  const countedByGrantTicks = grantContribution
    ? !grantContribution.countedByTurnEffects
    : tickAnchor === 'SOURCE'
  // An effect made on its anchor actor's own turn would otherwise lose a counted turn to the very
  // end of turn it was made in, so "until the end of the next turn" counts one more. A duration
  // "for the turn" already is that end of turn.
  const initialRemaining =
    plan.initialRemaining !== null &&
    countedByGrantTicks &&
    !grantContribution?.includesCurrentTurn &&
    plan.recurrenceStage === 'END_OF_TURN' &&
    input.currentActorId === (tickAnchor === 'SOURCE' ? input.sourceActorId : input.target.actorId)
      ? plan.initialRemaining + 1
      : plan.initialRemaining
  const definition = activeRuleEffectDefinitionDtoSchema.parse({
    schemaVersion: 2,
    linkedEffectId: null,
    originLevel: input.spellCastLevel ?? null,
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
    adapterFacts: {
      ...plan.adapterFacts,
      ...castFacts,
      ...(castSaveDcFact && { [castSaveDcFact.key]: castSaveDcFact.dc })
    },
    perceptionContributions: plan.perceptionContributions,
    recurrence: {
      // An effect the grant tick planner counts stores no stage, so the turn-effect kernel never
      // selects it.
      recurrenceStage: countedByGrantTicks ? 'NONE' : plan.recurrenceStage,
      // A grant held beside conditions (Hypnotic Pattern's speed 0) ends with them, so the plan's
      // own lifecycle joins the grant's.
      consumeOnFirstEvents: sortedUnion(
        grantContribution?.consumeOnFirstEvents ??
          plan.concealmentContribution?.consumeOnFirstEvents,
        endLifecycle?.consumeOnFirstEvents
      ),
      endOnEvents: sortedUnion(grantContribution?.endOnEvents, endLifecycle?.endOnEvents),
      endOnTriggers: endLifecycle?.endOnTriggers ?? [],
      ...(endLifecycle?.repeatTriggers?.length && { repeatTriggers: endLifecycle.repeatTriggers }),
      endOnConditionIds: grantContribution?.endOnConditionIds ?? [],
      holderEnd: grantContribution?.holderEnd ?? null,
      ...(grantContribution?.fromSourceOnly && { fromSourceOnly: true }),
      ...(grantContribution?.activeOnlyOnFinalAnchorTurn && { activeOnlyOnFinalAnchorTurn: true }),
      ...(grantContribution?.uses !== undefined && { uses: grantContribution.uses }),
      ...(plan.saveThresholds && { saveThresholds: plan.saveThresholds }),
      // A grant or condition outlasts the Encounter when the target's lifetime scope says so. A
      // Concentration effect keeps its maintenance link while the Run lasts and is detached from it
      // at COMPLETE.
      lifetimeScope:
        grantContribution ||
        conditionContributions.length > 0 ||
        linkContribution ||
        absenceContribution
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
    stateContributions: [
      ...(ownsTemporaryHitPoints ? [{ kind: 'TEMPORARY_HIT_POINTS_OWNERSHIP' as const }] : []),
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
      ...(absenceContribution
        ? [{ kind: 'PLAY_ABSENCE' as const, keepsTurn: absenceContribution.keepsTurn }]
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
              sourceHidden: input.sourceHidden,
              ...(boundItem && { boundItem }),
              ...(grantContribution.onEnd && { onEnd: grantContribution.onEnd }),
              ...(grantContribution.grantedActions && {
                grantedActions: grantContribution.grantedActions
              }),
              ...(grantContribution.effectOffers && {
                effectOffers: grantContribution.effectOffers.map((offer) =>
                  offer.kind === 'REPEAT_SOURCE_PATH' ? frozenRepeatOffer(offer, input) : offer
                )
              })
            }
          ]
        : []),
      ...conditionContributions.map((contribution) => ({
        kind: 'CONDITION_OWNERSHIP' as const,
        conditionId: contribution.conditionId,
        baselinePresent: conditionBaselinePresent(input.target, contribution.conditionId),
        ...(contribution.recordsSource && {
          sourceActorId: input.sourceActorId,
          ...(contribution.fleesSource && { fleesSource: true })
        })
      })),
      ...relationshipConditionIds.map((conditionId) => ({
        kind: 'CONDITION_OWNERSHIP' as const,
        conditionId,
        baselinePresent: conditionBaselinePresent(input.target, conditionId)
      })),
      ...(relationshipContribution
        ? [
            {
              kind: 'ACTOR_RELATIONSHIP' as const,
              relationshipOutcomeId: relationshipContribution.relationshipOutcomeId,
              sealedReachFeet,
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
  })
  return {
    definition,
    lifecycle: activeRuleEffectLifecycleDtoSchema.parse({
      schemaVersion: 1,
      remainingTicks: initialRemaining,
      ...(grantContribution?.uses !== undefined && { remainingUses: grantContribution.uses }),
      ...(concealment
        ? { concealedFromActorIds: normalizeObserverActorIds(concealment.observerActorIds) }
        : {})
    })
  }
}

/**
 * A repeat offer as the cast that made it settles it (D166): its saving throw is the DC the cast
 * rolled against and its scaling is the level the cast used, so a later repeat never reads the
 * caster's current stats or slots.
 */
function frozenRepeatOffer(
  offer: CompiledRepeatSourcePathOffer,
  input: Pick<Parameters<typeof prepareRecurringActiveEffect>[0], 'd20' | 'spellCastLevel'>
): CompiledRepeatSourcePathOffer {
  if (!input.d20)
    throw new EncounterActionEffectPlanError('A repeat offer freezes the DC its cast settled.')
  const { invocation } = offer.effect
  return {
    ...offer,
    ...(input.spellCastLevel !== undefined && { castLevel: input.spellCastLevel }),
    effect: {
      ...offer.effect,
      invocation:
        'savingThrow' in invocation
          ? {
              ...invocation,
              savingThrow: {
                id: invocation.savingThrow.id,
                abilityDefinitionId: invocation.savingThrow.abilityDefinitionId,
                dcMethod: 'FIXED_DC',
                baseDc: input.d20.defenseOrDc
              }
            }
          : invocation
    }
  }
}

/**
 * The effect a repeat-offering action leaves on its target beside the recurring effect (D166): the
 * carrier holds the frozen offer, is bound to the chosen item, and is not made once the item is
 * released. Null when the action offers no repeat.
 */
function prepareRepeatCarrierEffect(
  input: Parameters<typeof prepareEncounterActionEffectPlans>[0]
): EffectPlan | null {
  const plan = input.activeEffectPlan
  const carrier = plan?.repeatCarrier
  if (!plan?.chosenItem || !carrier) return null
  return prepareRecurringActiveEffect({
    ...input,
    activeEffectPlan: {
      ...plan,
      compiledEntryId: carrier.compiledEntryId,
      frozenGraphNodeId: carrier.frozenGraphNodeId,
      chosenItem: { ...plan.chosenItem, bindsGrant: true, grantUnlessReleased: true },
      modifierGrantContribution: {
        applyGrantOutcomeId: carrier.applyGrantOutcomeId,
        modifiers: [],
        senses: [],
        includesCurrentTurn: false,
        consumeOnFirstEvents: [],
        endOnEvents: ['ON_CHOSEN_ITEM_RELEASED'],
        endOnConditionIds: [],
        holderEnd: null,
        effectOffers: carrier.effectOffers
      },
      adapterFacts: {},
      initialRemaining: null,
      recurrenceStage: 'NONE',
      lifecycle: undefined,
      marginRiders: [],
      repeatCarrier: null
    }
  })
}

/**
 * The immunity the target holds against this source's action or grant (D156): an effect that holds
 * only the SOURCE_IMMUNITY fact admission reads, counted down on the target's turns, or (a lockout)
 * lasting until the source Character's long rest ends it.
 */
function prepareSourceImmunityEffect(
  input: Parameters<typeof prepareEncounterActionEffectPlans>[0]
): EffectPlan | null {
  const plan = input.activeEffectPlan
  const immunity = plan?.sourceImmunity
  if (!plan || !immunity) return null
  const sourceLabel = input.sourceLabel?.trim() ?? ''
  if (!sourceLabel || input.sourceCharacterId === undefined)
    throw new EncounterActionEffectPlanError(
      'A source immunity requires its action label and source Character.'
    )
  return sourceImmunityEffect({
    authoredEffectId: plan.authoredEffectId,
    capabilityContractVersion: plan.capabilityContractVersion,
    immunity,
    origin: {
      encounterId: input.encounterId,
      occurrenceId: input.occurrenceId,
      commandId: input.commandId,
      sourceActorId: input.sourceActorId
    },
    sourceCharacterId: input.sourceCharacterId,
    sourceLabel,
    lifetimeScope: input.target.lifetimeScope
  })
}

/**
 * The immunity effect a source leaves on its holder: a saved action's, a grant's lockout, or the
 * immunity a creature that passed a holder's ward leaves on that holder.
 */
export function sourceImmunityEffect(input: {
  authoredEffectId: string
  capabilityContractVersion: number
  immunity: NonNullable<CharacterRuleActionActiveEffectPlan['sourceImmunity']>
  origin: { encounterId: string; occurrenceId: string; commandId: string; sourceActorId: string }
  sourceCharacterId: string | null
  sourceLabel: string
  lifetimeScope: 'OWNER' | 'ENCOUNTER'
}): EffectPlan {
  const { immunity, origin } = input
  if (
    immunity.frozenGraph.id !== input.authoredEffectId ||
    immunity.frozenGraph.definition.sourceEntryBindings?.filter(
      (binding) =>
        binding.sourceEntryId === immunity.compiledEntryId &&
        binding.nodeId === immunity.frozenGraphNodeId
    ).length !== 1
  )
    throw new EncounterActionEffectPlanError('Encounter source-immunity plan is stale.')
  const definition = activeRuleEffectDefinitionDtoSchema.parse({
    schemaVersion: 2,
    linkedEffectId: null,
    originLevel: null,
    origin: {
      kind: 'ENCOUNTER',
      sourceAggregateId: origin.encounterId,
      sourceOccurrenceId: origin.occurrenceId,
      rootCommandId: origin.commandId,
      sourceActorId: origin.sourceActorId
    },
    authoredEffectId: input.authoredEffectId,
    compiledEntryId: immunity.compiledEntryId,
    frozenGraphNodeId: immunity.frozenGraphNodeId,
    frozenGraph: compileEffectGraph(immunity.frozenGraph, input.capabilityContractVersion),
    adapterFacts: {},
    perceptionContributions: [],
    recurrence: {
      recurrenceStage: immunity.initialRemaining === null ? 'NONE' : 'END_OF_TURN',
      consumeOnFirstEvents: [],
      endOnEvents: [],
      endOnTriggers: [],
      endOnConditionIds: [],
      holderEnd: null,
      // A Run holds no rest, so a lockout lasts the Run, ending before the source's long rest can.
      lifetimeScope: immunity.initialRemaining === null ? 'ENCOUNTER' : input.lifetimeScope,
      expiration:
        immunity.initialRemaining === null
          ? { kind: 'INDEFINITE' }
          : {
              kind: 'TICKS',
              initialRemaining: immunity.initialRemaining,
              decrementStage: 'END_OF_TURN',
              anchor: 'HOLDER'
            }
    },
    stateContributions: [
      {
        kind: 'SOURCE_IMMUNITY' as const,
        immuneToId: immunity.immuneToId,
        sourceCharacterId: input.sourceCharacterId,
        sourceLabel: input.sourceLabel
      }
    ]
  })
  return {
    definition,
    lifecycle: activeRuleEffectLifecycleDtoSchema.parse({
      schemaVersion: 1,
      remainingTicks: immunity.initialRemaining
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
    linkedEffectId: null,
    originLevel: null,
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
