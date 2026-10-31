import {
  type ActiveEffectSaveTally,
  type ActiveEffectSaveThresholds
} from '@artificer-toolkit/schema/shared/activeRuleEffectLifecycle'
import { type ReceiptD20ContributorDto } from '@artificer-toolkit/schema/shared/ruleExecutionEvidence'
import {
  serverPublishedRuleDefinitionDtoSchema,
  type ServerPublishedRuleDefinitionDto
} from '@artificer-toolkit/schema/shared/ruleExecutionCore'
import { attackKindSchema } from '@artificer-toolkit/schema/shared/enums'
import { createCharacterMechanicSourceKey } from '@artificer-toolkit/shared/character'
import {
  compileConditionEffect,
  type CompiledDuration,
  type CompiledEffectGroup
} from '@artificer-toolkit/shared/compilers'
import { abilityModifier } from './abilityModifier.js'
import { recurringHealAmountFacts, spentHealAmountFacts } from './effectActionHealAmountFacts.js'
import type { ActorRelationshipAuthored } from '@artificer-toolkit/shared/authored'
import {
  checksumRuleDocument,
  compareCanonicalD20Contributors,
  type CompiledRuleGraph,
  type RuleGraphDefinition
} from '@artificer-toolkit/shared/rules'
import { v5 as uuidv5 } from 'uuid'
import type { CompiledActionCompilerSource } from '@artificer-toolkit/schema/projections/characterMechanics'
import type {
  CharacterRuleActionSystemAdapter,
  CharacterRuleActionActiveEffectPlan
} from '../../characterRuleActionSystemAdapter.js'
import { CharacterRuleActionTargetDefenseUnavailableError } from '../../characterRuleActionSystemAdapter.js'
import {
  chosenCreaturesAreaSupported,
  chosenCreaturesCap,
  hitPointPoolIsAuthored,
  resolveChosenCreaturesTargeting
} from '../../encounterAreaAction.js'
import {
  gateFacts,
  gateNodeInputs,
  isGated,
  refuseUnboundGate,
  testPathGates,
  type Dnd5eAuthoredGates
} from './effectActionGates.js'
import { hitPointTierCeilings, hitPointTierFloor, selectHitPointTier } from '../../hitPointTiers.js'
import { ZONE_SIGHT_REQUIREMENT_MET_FACT_KEY } from '../../encounterZonePlacement.js'
import { diceGraphDefinition } from './effectActionDiceGraph.js'
import {
  activeEffectGraphNodeId,
  durationPublishedGraph,
  isGrantEndTrigger,
  maintenancePlan
} from './effectActionLifetime.js'
import {
  modifierGrantEntryPlan,
  passiveDamageGrantPlan,
  standingEffectPlan
} from './effectActionModifierGrants.js'
import { entryOwed } from './effectActionEntryOwed.js'
import { publishedGraph } from './effectActionPublishedGraph.js'
import { saveDamageMultiplierFacts, withSaveDamageMultiplier } from './effectActionSaveDamage.js'
import {
  relationshipOperationKey,
  relationshipRecurrenceGraph,
  relationshipRecurrencePlan,
  relationshipStateGraph
} from './effectActionRelationshipGraphs.js'
import {
  directResultSequence,
  mergeDirectResultGraphs,
  rulingSequence,
  sequentialComposition,
  singleEntryAction
} from './effectActionResultSequences.js'
import {
  boundedTestOutcome,
  damageSourceOutcomeId,
  hasLifecycleOverride,
  specializedTestOutcome,
  fixedHealAmount,
  healDiceConfiguration,
  positiveFixedAmount,
  validateHealBonuses,
  type SpecializedOutcome
} from './effectActionTestOutcomes.js'
import {
  authoredAlike,
  canonicalRepeatTriggers,
  isRepeatCarrierEntry,
  repeatCarrierPlan
} from './effectActionRepeatCarrier.js'
import { compileTestDefinition, type TestPlan } from './effectActionTestPhase.js'
import {
  bindMovementInterruptionOutput,
  bindMovementInterruptionTestOutput
} from './effectActionMovementInterruption.js'
import { compileDnd5eSummonPlacement } from './effectActionSummons.js'
import { compileDnd5eZonePlacement } from './effectActionZones.js'
import { selectScalingRow } from '../../scalingRowSelection.js'
import { dnd5eAttackKind, dnd5eAttackModifierDomain } from './attackKind.js'
import { DND5E_SYSTEM_ID } from './characterActionCapabilityDiscovery.js'
import { DND5E_KEEP_BY_ROLL_MODE, resolveDnd5eRollMode } from './rollModePolicy.js'
import {
  DND5E_POISON_DAMAGE_TYPE_DEFINITION_ID,
  DND5E_POISONED_CONDITION_DEFINITION_ID
} from './identity.js'
import {
  dnd5eAddedDiceFacts,
  dnd5eAddedDiceNode,
  derivedAddedDice,
  derivedSaveDice
} from './d20AddedDiceGraph.js'
import { damageAddedDiceDtoSchema } from '@artificer-toolkit/schema/shared/d20AddedDice'
import { foldD20Operands } from '@artificer-toolkit/schema/shared/d20FoldedBonuses'
import { incomingDamageProfileDtoSchema } from '@artificer-toolkit/schema/grants/modifier'
import {
  attackCriticalRulesDtoSchema,
  DEFAULT_CRITICAL_HIT_THRESHOLD
} from '@artificer-toolkit/schema/shared/attackCriticalRules'
import { createDnd5eContestGraph } from './optionalCombatContestGraph.js'
import { createDnd5eCheckDefinition } from './encounterLifecyclePolicy.js'
import {
  DND5E_ATTACK_TEST_OPERATION_KEY,
  DND5E_SAVE_TEST_OPERATION_KEY
} from './dnd5eTestOperationKeys.js'
import {
  DND5E_EFFECT_ACTION_FAMILY_KEY,
  DND5E_HEAL_PROPOSAL_OPERATION_KEY,
  DND5E_TEMPORARY_HIT_POINTS_PROPOSAL_OPERATION_KEY,
  DND5E_MANUAL_ADJUDICATION_PROPOSAL_OPERATION_KEY,
  DND5E_DAMAGE_PROPOSAL_OPERATION_KEY,
  DND5E_HEAL_TOTAL_OPERATION_KEY,
  DND5E_CONDITION_APPLY_PROPOSAL_OPERATION_KEY,
  DND5E_CONDITION_DURATION_OPERATION_KEY,
  DND5E_EFFECT_ACTION_CAPABILITY_CONTRACT_VERSION,
  DND5E_TARGET_ACTOR_FACT_KEY,
  DND5E_ATTACK_MODIFIER_FACT_KEY,
  DND5E_TARGET_DEFENSE_FACT_KEY,
  DND5E_SAVE_MODIFIER_FACT_KEY,
  DND5E_SAVE_DC_FACT_KEY,
  DND5E_ROLL_CONTRIBUTOR_CHECKSUM_FACT_KEY,
  DND5E_TEST_OUTCOME_RULE_FACT_KEY,
  dnd5eSaveOutcomeRule,
  DND5E_ATTACK_CRITICAL_THRESHOLD_FACT_KEY,
  DND5E_CRITICAL_EXTRA_DICE_FACT_KEY,
  DND5E_TARGET_STATE_CHECKSUM_FACT_KEY,
  DND5E_TARGET_CONDITION_IMMUNE_FACT_KEY,
  DND5E_TARGET_CURRENT_HIT_POINTS_FACT_KEY,
  MAX_CONDITIONS_PER_PATH,
  conditionImmuneFactKey,
  DND5E_RESOLVED_DAMAGE_EXPRESSION_FACT_KEYS,
  DND5E_RESOLVED_DAMAGE_OUTCOME_EXPRESSIONS_FACT_KEY,
  DND5E_HEALING_MAXIMIZED_FACT_KEY,
  DND5E_RESOLVED_HEAL_MODIFIER_FACT_KEY,
  DND5E_RECURRING_HEAL_AMOUNT_FACT_KEY,
  DND5E_SPELL_CAST_LEVEL_FACT_KEY,
  DND5E_SELECTED_OPTIONAL_RIDERS_FACT_KEY,
  DND5E_CLASS_LEVELS_FACT_KEY,
  DND5E_WEAPON_DAMAGE_DIE_FACT_KEY,
  DND5E_TARGET_CREATURE_TYPE_FACT_KEY,
  DND5E_ATTACK_ENEMY_PROXIMITY_FACT_KEY,
  DND5E_ATTACK_MOVE_TOWARD_FACT_KEY,
  DND5E_ATTACK_TURN_USES_FACT_KEY,
  DND5E_ATTACK_ITEM_BINDINGS_FACT_KEY,
  DND5E_DAMAGE_ADDED_DICE_FACT_KEY,
  DND5E_INCOMING_DAMAGE_REDUCTIONS_FACT_KEY,
  DND5E_ACTIVE_EFFECT_SAVE_ABILITY_DEFINITION_FACT_KEY,
  DND5E_ACTIVE_EFFECT_SAVE_REQUEST_NODE_FACT_KEY,
  DND5E_ACTIVE_EFFECT_REPEAT_SAVE_ESCALATION_CONDITION_FACT_KEY,
  DND5E_ACTIVE_EFFECT_TIMED_CONDITION_FACT_KEY,
  DND5E_ACTIVE_EFFECT_REPEAT_SAVE_ROLL_INFLUENCE_FACT_KEY,
  DND5E_ACTIVE_EFFECT_REPEAT_SAVE_PERCEPTION_REQUIREMENT_FACT_KEY,
  DND5E_ACTIVE_EFFECT_SAVE_SUCCESS_IMMUNITY_FACT_KEY,
  DND5E_ACTIVE_EFFECT_REPEAT_SAVE_ATTEMPT_GATE_FACT_KEY,
  DND5E_REPEAT_SAVE_ATTEMPT_ALLOWED_FACT_KEY,
  DND5E_TEST_DAMAGE_PROPOSAL_OPERATION_KEY,
  DND5E_TEST_CONDITION_PROPOSAL_OPERATION_KEY,
  UUID,
  Dnd5eEffectActionCompilerError,
  type Dnd5eCompiledEffectActionSource,
  type Outcome,
  type TestKind,
  TEST_HOLD_PATHS,
  type SpecializedPath,
  isSpecializedPath,
  uuid,
  unsupported,
  multipliedDamageAmount
} from './effectActionContracts.js'
import { repeatSaveConditionIds, conditionImmunityFacts } from './effectActionEvidenceChecks.js'
import {
  canonicalEndTriggers,
  marginRiderPlan,
  timedBandConditions
} from './effectActionBandConditions.js'
import { conditionDurationTurns, dnd5eRepeatSave, planTickAnchor } from './effectActionFollowUp.js'
import { compiledCreatureFormFilter, formDuration } from './effectActionCreatureFormFilter.js'
import { repeatFollowUpSavePublishedGraph } from './effectActionRepeatSaveGraph.js'
import { turnEndGateEvidenceBinding, turnEndGatePlan } from './effectActionTurnEndGate.js'
import {
  effectOutcomeProposalNode,
  effectOutcomeProposalOutputs
} from '../../effectOutcomeRegistry.js'
import {
  DND5E_CANCEL_NEEDS_SPELL_CAST_REACTION,
  dnd5eOutcomeDefinition,
  dnd5eOutcomeTargetPreconditions,
  dnd5eTargetOnlyOutcome,
  type Dnd5eAuthoredOutcome
} from './effectActionOutcomes.js'
import { damageSizedOutcomeGraph } from './effectActionDamageSized.js'
import {
  forcedMovementProposalNode,
  dnd5eResultGate,
  saveAudit,
  saveOutcomeFact,
  testContractVersion
} from './effectActionOperationRegistry.js'
import {
  testApplications,
  interpretDirect,
  interpret,
  interpretSpatial
} from './effectActionInterpretation.js'
import {
  repeatedFollowUpSaveResultPath,
  repeatSaveAttemptAllowed,
  repeatSaveGated
} from './effectActionRepeatSaveEvidence.js'
import {
  isChargedFreeActivation,
  isSupportedArea,
  isSupportedTestActivation,
  isSupportedTestTargetPolicy,
  namesOnlyItsUser
} from './effectActionTargetPolicy.js'
import {
  dnd5eEffectScalingFacts,
  parseBoundedDiceConfiguration,
  scalingLevel,
  type Dnd5eEffectScalingFacts
} from './effectActionScalingFacts.js'

import { DND5E_OUTCOME_TARGET, damageMultiplier } from './effectActionOutcomeNodes.js'
import { isCriticalHitDamage, withDamageAddedDice } from './effectActionDamageAddedDice.js'
import {
  isImmediateFollowUpSave,
  escalationCondition,
  escalatingImmediateSave,
  immediateFollowUpSaveEntries,
  exactFailureMarginRider,
  immediateFollowUpSaveGraphDefinition
} from './effectActionNestedSave.js'
import { hitPointTierActions } from './effectActionNarrowing.js'
import {
  admitRollTablePaths,
  directRollTableGraph,
  rollTableOutcomeTemplate,
  rollTablePath,
  rollTableRowActions
} from './effectActionRollTable.js'

const DND5E_ORDINARY_SIGHT_DEFINITION_ID = '0b4d8603-8e15-4e5a-89a6-9e1a179c4371'
const DND5E_ORDINARY_SIGHT_NAMESPACE = '6871f0d5-9ac4-45d4-84c0-30cbd4e7df0c'
const DND5E_ORDINARY_SIGHT_CAPABILITY = {
  channel: 'VISUAL' as const,
  accessGrade: 'PRECISE' as const,
  satisfies: ['DETECT', 'LOCATE', 'PRECISE', 'SEE'] as const,
  illuminationAccess: 'DIM' as const,
  obscurementAccess: 'LIGHT' as const,
  perceivesInvisible: false,
  physicalConstraints: ['LINE_OF_EFFECT'] as const
}
const DND5E_ORDINARY_SIGHT_CHECKSUM = checksumRuleDocument(DND5E_ORDINARY_SIGHT_CAPABILITY)

type Dnd5eEffectActionTemplate = Readonly<{
  phase: 'TEST' | 'OUTCOME'
  published: ServerPublishedRuleDefinitionDto
  templateChecksum: string
}>

function templateIdentity(template: Dnd5eEffectActionTemplate) {
  return {
    definitionId: template.published.id,
    gameSystemId: template.published.gameSystemId,
    definitionFamilyKey: template.published.definitionFamilyKey,
    checksum: template.templateChecksum
  }
}

/**
 * Resolves the bounded Creature-only `XdY + ability modifier` source form
 * from immutable stat-block facts.  This happens while facts are bound under
 * the Encounter lock; the authored outcome still owns every die, bonus, and
 * bound, plus the `damageBonus` its bound loadout weapon adds (ATTACK-6.3).
 * Character callers continue to supply their already-resolved expressions
 * through their policy output.
 */
export function resolveCreatureDamageExpression(input: {
  outcome: Record<string, unknown>
  sourceDerivedFacts: Record<string, unknown>
  /** The source's locked hit points; they select authored half-hit-point dice (a swarm's). */
  sourceHitPoints: { current: number; maximum: number } | null
}): string | null {
  const values = input.outcome.values
  if (!Array.isArray(values) || values.length !== 1) return null
  const [value] = values
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const { dice: fullDice, halfHitPointsDice } = value as Record<string, unknown>
  if (typeof fullDice !== 'string') return null
  let dice = fullDice
  if (typeof halfHitPointsDice === 'string') {
    // "If the swarm has half of its hit points or fewer" reads the source's current hit points.
    if (!input.sourceHitPoints) return null
    if (2 * input.sourceHitPoints.current <= input.sourceHitPoints.maximum) dice = halfHitPointsDice
  }
  const weaponDamageBonus = input.outcome.damageBonus ?? 0
  const bonuses = input.outcome.bonuses ?? []
  if (typeof weaponDamageBonus !== 'number' || !Array.isArray(bonuses)) return null
  const abilityScores = (input.sourceDerivedFacts.statBlock as { abilityScores?: unknown } | null)
    ?.abilityScores
  const scoresRead =
    abilityScores && typeof abilityScores === 'object' && !Array.isArray(abilityScores)
  if (bonuses.length > 0 && !scoresRead) return null
  let modifier = weaponDamageBonus
  for (const bonus of bonuses) {
    if (!bonus || typeof bonus !== 'object' || Array.isArray(bonus)) return null
    const row = bonus as Record<string, unknown>
    if (row.bonusKind !== 'ABILITY_BONUS' || typeof row.ability !== 'string') return null
    const score = (abilityScores as Record<string, unknown>)[row.ability]
    if (typeof score !== 'number' || !Number.isSafeInteger(score)) return null
    const multiplier = row.multiplier === null || row.multiplier === undefined ? 1 : row.multiplier
    if (typeof multiplier !== 'number' || !Number.isSafeInteger(multiplier)) return null
    let resolved = abilityModifier(score) * multiplier
    if (row.min !== null && row.min !== undefined) {
      if (typeof row.min !== 'number' || !Number.isSafeInteger(row.min)) return null
      resolved = Math.max(resolved, row.min)
    }
    if (row.max !== null && row.max !== undefined) {
      if (typeof row.max !== 'number' || !Number.isSafeInteger(row.max)) return null
      resolved = Math.min(resolved, row.max)
    }
    modifier += resolved
  }
  if (!Number.isSafeInteger(modifier)) return null
  return modifier === 0 ? dice : `${dice}${modifier > 0 ? '+' : ''}${modifier}`
}

/**
 * A check whose success runs its ON_CHECK_SUCCESS outcome after the check test: a contest's win
 * (Shove, D105) or a fixed-DC check's success (D173).
 */
function isCheckOutcomeAction(action: Dnd5eCompiledEffectActionSource): boolean {
  return (
    action.compiledEffect.invocation.triggerCode === 'CHECK' &&
    supported(action).kind === 'CHECK_OUTCOME'
  )
}

function testPhaseKindOrNull(action: Dnd5eCompiledEffectActionSource): TestKind | null {
  const trigger = action.compiledEffect.invocation.triggerCode
  if (dnd5eAttackKind(trigger) !== null) return 'ATTACK'
  return trigger === 'SAVING_THROW' ? 'SAVE' : null
}

/**
 * Outcomes a test action leaves to its active-effect plan rather than its TEST/OUTCOME graphs, which
 * the plan makes only on the result paths its `resultGate` lists: an actor relationship, a grant on
 * an attack's result (Shocking Grasp's "can't take reactions"), a grant a failed save applies beside
 * the timed conditions the same effect owns (Hypnotic Pattern's speed of 0), a save's grant the plan
 * holds alone (see `saveGrantPlan`; Enthrall's disadvantage on Perception, Vicious Mockery's on an
 * attack), and a bond or a creature form its plan carries on a test's result path. Any other save
 * grant, bond or form stays a test outcome, which refuses it. A source immunity and a chosen item's
 * release are always the plan's (see `sourceImmunityPlan` and `chosenItemPlan`). An equipment
 * degradation is the resolver's (see `planEncounterEquipmentDegradation`).
 */
function isActiveEffectPlanOutcome(
  entry: CompiledEffectGroup['entries'][number],
  action: Dnd5eCompiledEffectActionSource
): boolean {
  if (!('outcome' in entry)) return false
  return (
    entry.outcome.effectKind === 'ACTOR_RELATIONSHIP' ||
    entry.outcome.effectKind === 'SOURCE_IMMUNITY' ||
    entry.outcome.effectKind === 'RELEASE_CHOSEN_ITEM' ||
    entry.outcome.effectKind === 'DEGRADE_EQUIPMENT' ||
    (entry.outcome.effectKind === 'APPLY_GRANT' &&
      (entry.pathCode === 'ON_HIT' ||
        entry.pathCode === 'ON_MISS' ||
        entry.pathCode === 'ON_CRIT')) ||
    (entry.outcome.effectKind === 'APPLY_GRANT' && saveGrantPlan(action) !== null) ||
    (entry.outcome.effectKind === 'APPLY_GRANT' &&
      entry.pathCode === 'ON_SAVE_FAIL' &&
      timedConditionPlan(action) !== null) ||
    (entry.outcome.effectKind === 'REMOVE_FROM_PLAY' && timedConditionPlan(action) !== null) ||
    (entry.outcome.effectKind === 'TELEPATHIC_LINK' &&
      entry.pathCode !== 'ON_USE' &&
      actorLinkPlan(action) !== null) ||
    (entry.outcome.effectKind === 'MANIFEST' &&
      entry.outcome.manifestKind === 'CREATURE' &&
      entry.pathCode !== 'ON_USE' &&
      creatureFormPlan(action) !== null)
  )
}

/**
 * The gate of an outcome an active-effect plan carries: none on use, and on a test's result path the
 * resolved paths that select it. Undefined for a path the action's test never resolves to.
 */
function entryResultGate(
  action: Dnd5eCompiledEffectActionSource,
  pathCode: string
): { paths: string[] } | null | undefined {
  if (pathCode === 'ON_USE') return null
  const kind = testPhaseKindOrNull(action)
  const testPaths =
    kind === 'ATTACK'
      ? ['ON_HIT', 'ON_MISS', 'ON_CRIT']
      : kind === 'SAVE'
        ? ['ON_SAVE_FAIL', 'ON_SAVE_SUCCESS']
        : []
  return testPaths.includes(pathCode) ? dnd5eResultGate(pathCode) : undefined
}

function supportedRecurringPlan(
  action: Dnd5eCompiledEffectActionSource
): Omit<CharacterRuleActionActiveEffectPlan, 'frozenGraph'> | null {
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
  const recurringLifecycleIsSupported =
    recurringAmount !== null &&
    !recurringScaling &&
    lifecycle &&
    recurringStage !== null &&
    (lifecycle.endTriggers?.length ?? 0) === 0 &&
    (lifecycle.endOnConditionIds?.length ?? 0) === 0
  const maintenance = maintenancePlan(action, entry)
  if (
    invocation.kind === 'ACTION' &&
    invocation.triggerCode === 'SAVING_THROW' &&
    isSupportedTestActivation(invocation) &&
    entries.length === 1 &&
    entry.resolutionKind === 'DIRECT' &&
    entry.groupKind === 'SINGLE' &&
    entry.pathCode === 'ON_SAVE_FAIL' &&
    !entry.rangeOverride &&
    !entry.targetingOverride &&
    recurringLifecycleIsSupported
  ) {
    if (recurringStage === null || recurringAmount === null) return null
    const repeatSave = dnd5eRepeatSave({
      abilityDefinitionId: action.savingThrowAbilityDefinitionId,
      savingThrow: invocation.savingThrow,
      requestNodeId: 'd20'
    })
    if (!repeatSave) {
      unsupported(
        'D&D recurring saving throws require one pinned ability definition and a fixed or caster save DC.'
      )
    }
    if (!UUID.test(entry.resultBlockId))
      unsupported('D&D recurring active-effect result blocks require a UUID-backed identity.')
    return {
      authoredEffectId: action.effectId,
      compiledEntryId: entry.resultBlockId,
      frozenGraphNodeId: 'proposal-on_save_fail',
      capabilityContractVersion: DND5E_EFFECT_ACTION_CAPABILITY_CONTRACT_VERSION,
      recurrenceStage: recurringStage,
      initialRemaining: recurringAmount,
      ...repeatSave,
      perceptionContributions: [],
      maintenance,
      marginRiders: []
    }
  }
  if (
    invocation.kind !== 'ACTION' ||
    invocation.triggerCode !== 'ACTIVATED' ||
    invocation.activation.code !== 'ACTION' ||
    invocation.activation.amount !== 1 ||
    entries.length !== 1 ||
    entry.resolutionKind !== 'DIRECT' ||
    entry.groupKind !== 'SINGLE' ||
    entry.pathCode !== 'ON_USE' ||
    entry.rangeOverride ||
    entry.targetingOverride ||
    !recurringLifecycleIsSupported
  )
    return null
  if (recurringStage === null || recurringAmount === null) return null
  if (!UUID.test(entry.resultBlockId))
    unsupported('D&D recurring active-effect result blocks require a UUID-backed identity.')
  return {
    authoredEffectId: action.effectId,
    compiledEntryId: entry.resultBlockId,
    frozenGraphNodeId: activeEffectGraphNodeId(entry.resultBlockId),
    capabilityContractVersion: DND5E_EFFECT_ACTION_CAPABILITY_CONTRACT_VERSION,
    recurrenceStage: recurringStage,
    initialRemaining: recurringAmount,
    adapterFacts: {},
    perceptionContributions: [],
    maintenance,
    marginRiders: []
  }
}

/**
 * The one active effect a sequential composition holds (D156). A recurring heal is its graph: it
 * fires at each authored turn boundary of the holder, never at cast, for a duration in turns (a
 * minute or an hour counts too), and a fixed amount may add the caster's ability modifier, settled
 * at cast. A grant rides on it, counted with it; without a recurring heal the grant is the effect.
 * The effect owns the temporary hit points any of its heals give.
 */
function sequentialCompositionPlan(
  action: Dnd5eCompiledEffectActionSource
): CharacterRuleActionActiveEffectPlan | null {
  const composition = sequentialComposition(action)
  if (!composition) return null
  const { grant, recurring, immediate } = composition
  const grantPlan = grant
    ? modifierGrantEntryPlan({ action, entry: grant, resultGated: false, untilEndEvent: false })
    : null
  if (grant && !grantPlan?.modifierGrantContribution)
    unsupported('D&D composed grant must be a timed modifier grant.')
  const temporary = [recurring, immediate].some(
    (entry) => entry?.outcome.effectKind === 'HEAL' && entry.outcome.temporary === true
  )
  if (!recurring) {
    if (!grantPlan) return null
    return {
      ...grantPlan,
      ...(temporary && { ownsTemporaryHitPoints: true }),
      frozenGraph: durationPublishedGraph({ effectId: action.effectId, plan: grantPlan })
    }
  }
  const { outcome, lifecycle, duration } = recurring
  const stage = lifecycle?.recurringKind
  const turns = duration ? conditionDurationTurns(duration) : null
  const { recurringKind: _recurringKind, ...otherLifecycle } = lifecycle ?? {}
  if (
    outcome.effectKind !== 'HEAL' ||
    outcome.valueKind !== 'FIXED' ||
    outcome.scalingKind !== 'NONE' ||
    !Number.isSafeInteger(outcome.amount) ||
    outcome.amount < 0 ||
    (stage !== 'START_OF_TURN' && stage !== 'END_OF_TURN') ||
    turns === null ||
    Object.values(otherLifecycle).some((value) => value !== undefined) ||
    !UUID.test(recurring.resultBlockId)
  )
    unsupported('D&D composed recurring heal must be a fixed timed heal at a turn boundary.')
  validateHealBonuses(outcome.bonuses)
  const bonuses = outcome.bonuses ?? []
  if (bonuses.some((bonus) => bonus.bonusKind !== 'ABILITY_BONUS'))
    unsupported('D&D composed recurring heal adds only an ability modifier.')
  if (bonuses.length === 0 && outcome.amount === 0)
    unsupported('D&D composed recurring heal must give hit points.')
  const nodeId = activeEffectGraphNodeId(recurring.resultBlockId)
  const definition: RuleGraphDefinition = {
    schemaVersion: 1,
    id: action.effectId,
    gameSystemId: DND5E_SYSTEM_ID,
    definitionFamilyKey: DND5E_EFFECT_ACTION_FAMILY_KEY,
    nodes: [
      {
        id: nodeId,
        operation: {
          key: outcome.temporary
            ? DND5E_TEMPORARY_HIT_POINTS_PROPOSAL_OPERATION_KEY
            : DND5E_HEAL_PROPOSAL_OPERATION_KEY,
          contractVersion: 1
        },
        inputs: {
          targetActorId: { kind: 'FACT', factKey: DND5E_TARGET_ACTOR_FACT_KEY },
          targetStateChecksum: { kind: 'FACT', factKey: DND5E_TARGET_STATE_CHECKSUM_FACT_KEY },
          amount:
            bonuses.length > 0
              ? { kind: 'FACT', factKey: DND5E_RECURRING_HEAL_AMOUNT_FACT_KEY }
              : { kind: 'LITERAL', value: outcome.amount }
        }
      }
    ],
    outputs: {
      targetActorId: { kind: 'NODE_OUTPUT', nodeId, port: 'targetActorId' },
      amount: { kind: 'NODE_OUTPUT', nodeId, port: 'amount' }
    },
    sourceEntryBindings: [{ sourceEntryId: recurring.resultBlockId, nodeId }]
  }
  return {
    authoredEffectId: action.effectId,
    compiledEntryId: recurring.resultBlockId,
    frozenGraphNodeId: nodeId,
    frozenGraph: publishedGraph(definition),
    capabilityContractVersion: DND5E_EFFECT_ACTION_CAPABILITY_CONTRACT_VERSION,
    recurrenceStage: stage,
    initialRemaining: turns,
    ...(grantPlan?.modifierGrantContribution && {
      modifierGrantContribution: {
        ...grantPlan.modifierGrantContribution,
        countedByTurnEffects: true
      }
    }),
    adapterFacts: {},
    ...(bonuses.length > 0 && { castFactKeys: [DND5E_RECURRING_HEAL_AMOUNT_FACT_KEY] }),
    recurrenceDeferred: true,
    ...(temporary && { ownsTemporaryHitPoints: true }),
    perceptionContributions: [],
    maintenance: maintenancePlan(action, recurring),
    marginRiders: []
  }
}

/**
 * The cast graph of a sequential composition: its immediate heal, else its grant, as that entry
 * alone compiles. A recurring heal names its outcome on the graph, so the cast heals only its own
 * row; one with an ability bonus also has its amount settled at cast (see `bindFacts`).
 */
function compileSequentialComposition(
  action: Dnd5eCompiledEffectActionSource,
  composition: NonNullable<ReturnType<typeof sequentialComposition>>
): ServerPublishedRuleDefinitionDto {
  const { grant, recurring, immediate } = composition
  // The composition's plan holds the duration and the maintenance; the immediate heal is instant.
  const cast = immediate
    ? (({ duration: _duration, maintenanceDefinitionId: _maintenance, ...instant }) => instant)(
        immediate
      )
    : grant
  if (!cast) unsupported('D&D sequential composition has no cast entry.')
  const castAction = singleEntryAction(action, cast)
  const { requiresConcentration: _concentration, ...instantEffect } = castAction.compiledEffect
  const { invocation } = instantEffect
  // The composition's grant is what lets the cast ask for a willing target (Enhance Ability); the
  // instant entry is compiled alone only for its graph, so it keeps the grant's allowance.
  const instantInvocation =
    grant &&
    invocation.kind === 'ACTION' &&
    invocation.targeting?.selectionKind === 'SINGLE_TARGET' &&
    invocation.targeting.dispositionKind === 'WILLING'
      ? { ...invocation, targeting: { ...invocation.targeting, dispositionKind: 'ANY' as const } }
      : invocation
  const published = compileDnd5eEffectAction({
    action: { ...castAction, compiledEffect: { ...instantEffect, invocation: instantInvocation } }
  })
  if (recurring?.outcome.effectKind !== 'HEAL') return published
  const definition: RuleGraphDefinition = {
    ...published.definition,
    outputs: {
      ...published.definition.outputs,
      recurringHealOutcomeId: { kind: 'LITERAL', value: recurring.outcome.id },
      ...((recurring.outcome.bonuses?.length ?? 0) > 0 && {
        recurringHealAmount: { kind: 'FACT', factKey: DND5E_RECURRING_HEAL_AMOUNT_FACT_KEY }
      })
    }
  }
  return serverPublishedRuleDefinitionDtoSchema.parse({
    ...published,
    checksum: checksumRuleDocument(definition),
    definition
  })
}

function holdsLastingEffect(action: Dnd5eCompiledEffectActionSource): boolean {
  return (
    timedActiveEffectPlan(action) !== null ||
    relationshipPlan(action) !== null ||
    (supportedRecurringPlan(action) ?? concealmentPlan(action)) !== null
  )
}

function compileDirectResultSequence(
  results: readonly Dnd5eCompiledEffectActionSource[]
): ServerPublishedRuleDefinitionDto {
  return mergeDirectResultGraphs(
    results.map((result) => {
      // The sequence's own maintained effect was checked once for the whole action.
      const { requiresConcentration: _concentration, ...effect } = result.compiledEffect
      return compileEffectActionGraph({ ...result, compiledEffect: effect }).definition
    })
  )
}

export function relationshipPlan(action: Dnd5eCompiledEffectActionSource):
  | (Omit<CharacterRuleActionActiveEffectPlan, 'frozenGraph'> & {
      frozenGraph: ServerPublishedRuleDefinitionDto
    })
  | null {
  const entries = action.compiledEffect.entries.filter(
    (entry): entry is typeof entry & { outcome: ActorRelationshipAuthored } =>
      'outcome' in entry && entry.outcome.effectKind === 'ACTOR_RELATIONSHIP'
  )
  if (entries.length === 0) return null
  if (entries.length !== 1) unsupported('D&D action has more than one relationship outcome.')
  const entry = entries[0]!
  const relationship = entry.outcome
  // An attack holds its target on a hit; a save on a failure; a contest (Grapple) on the
  // initiator's win; an action with no roll (Engulf) as soon as it is used.
  const invocation = action.compiledEffect.invocation
  const contest = invocation.triggerCode === 'CHECK' && invocation.check.dc.kind === 'CONTEST'
  const direct = invocation.triggerCode === 'ACTIVATED'
  const testKind = testPhaseKindOrNull(action)
  if (
    invocation.kind !== 'ACTION' ||
    entry.resolutionKind !== 'DIRECT' ||
    (entry.groupKind !== 'SINGLE' && entry.groupKind !== 'SEQUENTIAL') ||
    (contest
      ? entry.pathCode !== 'ON_CHECK_SUCCESS'
      : direct
        ? entry.pathCode !== 'ON_USE'
        : !testKind || !TEST_HOLD_PATHS[testKind].includes(entry.pathCode)) ||
    !UUID.test(relationship.id)
  ) {
    unsupported('D&D relationship outcomes need a bounded hit, failed save, contest win or use.')
  }
  const orderedModules = [...relationship.modules].sort(
    (left, right) => left.order - right.order || left.id.localeCompare(right.id)
  )
  const modules = orderedModules.map((module, index) => {
    if (!UUID.test(module.id) || !Number.isSafeInteger(module.order) || module.order < 0)
      unsupported('D&D relationship modules require ordered UUID identities.')
    if (index > 0 && orderedModules[index - 1]!.order === module.order)
      unsupported('D&D relationship module order must be deterministic.')
    return module
  })
  if (modules.length === 0) unsupported('D&D relationship outcomes require one module.')
  const conditionIds = (relationship.conditions ?? []).map((condition) => {
    uuid(condition.conditionId, 'D&D relationship condition identity')
    if (!(action.conditionDefinitionIds ?? []).includes(condition.conditionId))
      unsupported('D&D relationship condition is not in the pinned System vocabulary.')
    return condition.conditionId
  })
  const capabilitySuppressions = modules.flatMap((module) =>
    module.kind === 'TARGET_CAPABILITY_SUPPRESSION'
      ? [
          {
            contributionId: module.id,
            capabilityDefinitionIds: module.capabilityDefinitionIds
          }
        ]
      : []
  )
  if (new Set(conditionIds).size !== conditionIds.length)
    unsupported('D&D relationship conditions must be unique.')
  const recurrence = relationshipRecurrencePlan(relationship)
  const plan: Omit<CharacterRuleActionActiveEffectPlan, 'frozenGraph'> = {
    authoredEffectId: action.effectId,
    compiledEntryId: relationship.id,
    frozenGraphNodeId: recurrence?.frozenGraphNodeId ?? 'relationship-state',
    capabilityContractVersion: DND5E_EFFECT_ACTION_CAPABILITY_CONTRACT_VERSION,
    recurrenceStage: recurrence ? 'START_OF_TURN' : 'NONE',
    initialRemaining: null,
    tickAnchor: planTickAnchor(relationship.recurrence?.turnAnchor),
    actorRelationshipContribution: {
      relationshipOutcomeId: relationship.id,
      heldAtOnce: relationship.heldAtOnce,
      ...(relationship.appliesWhen ? { appliesWhen: relationship.appliesWhen } : {}),
      modules,
      conditionIds,
      capabilitySuppressions
    },
    ...(entry.pathCode !== 'ON_USE' && { resultGate: dnd5eResultGate(entry.pathCode) }),
    adapterFacts: {
      ...recurrence?.save?.adapterFacts,
      'dnd5e.relationship-authored-path': entry.pathCode
    },
    perceptionContributions: [],
    maintenance: null,
    marginRiders: []
  }
  const frozenGraph = recurrence
    ? relationshipRecurrenceGraph({ action, relationship, recurrence, plan })
    : relationshipStateGraph({ action, relationshipId: relationship.id })
  return { ...plan, frozenGraph }
}

/**
 * The repeat is a separate, target-turn graph rather than a second evidence
 * stage in the originating action. Keep the admitted source shape narrow
 * until another authored lifecycle demonstrates a different one.
 */
function repeatingImmediateFollowUpSavePlan(
  action: Dnd5eCompiledEffectActionSource
): Omit<CharacterRuleActionActiveEffectPlan, 'frozenGraph'> | null {
  const resolved = immediateFollowUpSaveEntries(action.compiledEffect.entries)
  const saveEntry = resolved?.saveEntry
  if (!saveEntry || saveEntry.outcome.effectKind !== 'FOLLOW_UP_SAVE') return null
  const save = saveEntry.outcome
  // An escalating save repeats through its nested follow-up (one turn, whatever the condition's
  // duration); a plain one repeats itself until it succeeds.
  const escalating = escalatingImmediateSave(save)
  if (
    escalating &&
    !(action.conditionDefinitionIds ?? []).includes(escalating.escalation.conditionId)
  )
    return null
  const repeat = escalating?.repeat ?? save
  if (
    save.timing !== 'IMMEDIATE' ||
    save.onSuccess.kind !== 'END' ||
    save.onFailure.kind !== 'OUTCOMES' ||
    (!escalating &&
      (save.repeatTiming !== 'TARGET_TURN_END' ||
        save.attempts.kind !== 'ONCE' ||
        save.attempts.repeatOnFailure !== true ||
        (save.onDurationComplete !== undefined && save.onDurationComplete.kind !== 'END') ||
        // A gate left uncompiled would let the target repeat a save the author forbade.
        save.repeatAttemptGate))
  ) {
    return null
  }
  const conditions = save.onFailure.outcomes.filter(
    (outcome): outcome is Extract<typeof outcome, { effectKind: 'CONDITION' }> =>
      outcome.effectKind === 'CONDITION'
  )
  const condition = conditions[0]
  if (
    conditions.length !== 1 ||
    !condition ||
    !UUID.test(condition.conditionId) ||
    !(action.conditionDefinitionIds ?? []).includes(condition.conditionId) ||
    !UUID.test(saveEntry.resultBlockId)
  ) {
    return null
  }
  const repeatSave = dnd5eRepeatSave({
    abilityDefinitionId: repeat.savingThrow.abilityDefinitionId,
    savingThrow: repeat.savingThrow,
    requestNodeId: 'repeat-save-d20',
    heldConditionIds: [condition.conditionId],
    escalationConditionId: escalating?.escalation.conditionId
  })
  if (!repeatSave) return null
  const duration = immediateFollowUpSaveDuration(action)
  if (escalating && duration) return null
  const initialRemaining = escalating ? 1 : duration ? conditionDurationTurns(duration) : null
  if (duration && initialRemaining === null) return null
  return {
    authoredEffectId: action.effectId,
    compiledEntryId: saveEntry.resultBlockId,
    frozenGraphNodeId: 'repeat-save-test',
    capabilityContractVersion: DND5E_EFFECT_ACTION_CAPABILITY_CONTRACT_VERSION,
    recurrenceStage: 'END_OF_TURN',
    initialRemaining,
    conditionContributions: [
      {
        conditionId: condition.conditionId,
        recordsSource: condition.recordsSource,
        fleesSource: condition.fleesSource
      }
    ],
    ...repeatSave,
    perceptionContributions: [],
    maintenance: maintenancePlan(action, saveEntry),
    marginRiders: []
  }
}

/** The authored duration of a hit's result block, which its follow-up save's condition lasts. */
function immediateFollowUpSaveDuration(
  action: Dnd5eCompiledEffectActionSource
): CompiledDuration | undefined {
  const saveEntry = immediateFollowUpSaveEntries(action.compiledEffect.entries)?.saveEntry
  return saveEntry && 'duration' in saveEntry ? saveEntry.duration : undefined
}

/**
 * A one-time save's condition with a duration (D62.2, "poisoned for 1 minute"): the condition the
 * failed save applies is owned by an Encounter active effect that counts the target's turns and
 * removes it after the last one. No save repeats.
 */
function timedImmediateConditionPlan(
  action: Dnd5eCompiledEffectActionSource
): Omit<CharacterRuleActionActiveEffectPlan, 'frozenGraph'> | null {
  const duration = immediateFollowUpSaveDuration(action)
  const resolved = immediateFollowUpSaveEntries(action.compiledEffect.entries)
  const save = resolved?.saveEntry.outcome
  if (
    !resolved ||
    !save ||
    !isImmediateFollowUpSave(save) ||
    save.onSuccess.kind !== 'END' ||
    save.attempts.repeatOnFailure === true ||
    save.onDurationComplete
  )
    return null
  // A band that times its own conditions (D172) has no one duration to share.
  const band = timedBandConditions(save)
  if (band && duration) unsupported('D&D a timed band takes no duration from its result block.')
  const failure = save.onFailure
  const condition = band
    ? band.primary.condition
    : failure.kind === 'OUTCOMES'
      ? failure.outcomes[0]
      : undefined
  const initialRemaining = band ? band.primary.turns : duration && conditionDurationTurns(duration)
  const rider = save.failureMarginRider
  if (band && rider) unsupported('D&D a timed band takes no failure-margin rider.')
  const knownConditionIds = action.conditionDefinitionIds ?? []
  // The duration times the failed save's one condition; any other failure has nothing to time.
  if (
    failure.kind !== 'OUTCOMES' ||
    (!band && failure.outcomes.length !== 1) ||
    condition?.effectKind !== 'CONDITION' ||
    !initialRemaining ||
    !knownConditionIds.includes(condition.conditionId) ||
    !UUID.test(resolved.saveEntry.entryId) ||
    band?.riders.some(
      ({ conditionContributions: [c] }) => !knownConditionIds.includes(c!.conditionId)
    ) ||
    rider?.outcomes.some(({ conditionId }) => !knownConditionIds.includes(conditionId))
  )
    return null
  // "Until the end of your next turn" counts the source's turns (Stunning Strike).
  const turnAnchor =
    'lifecycle' in resolved.saveEntry ? resolved.saveEntry.lifecycle?.turnAnchor : undefined
  return {
    authoredEffectId: action.effectId,
    compiledEntryId: resolved.saveEntry.entryId,
    frozenGraphNodeId: 'condition-duration',
    capabilityContractVersion: DND5E_EFFECT_ACTION_CAPABILITY_CONTRACT_VERSION,
    recurrenceStage: turnAnchor?.boundary ?? 'END_OF_TURN',
    tickAnchor: planTickAnchor(turnAnchor),
    initialRemaining,
    conditionContributions: [
      {
        conditionId: condition.conditionId,
        recordsSource: condition.recordsSource,
        fleesSource: condition.fleesSource
      }
    ],
    adapterFacts: { [DND5E_ACTIVE_EFFECT_TIMED_CONDITION_FACT_KEY]: true },
    perceptionContributions: [],
    maintenance: maintenancePlan(action, resolved.saveEntry),
    marginRiders: band ? band.riders : rider ? [marginRiderPlan(rider, condition.id)] : []
  }
}

/**
 * Conditions applied with a duration, with no save (Invisibility, "1 hour") or as a save's failure
 * outcomes (Sleep Breath, Hypnotic Pattern; see `ownsTimedSaveCondition`): the target holds them
 * together through one Encounter active effect that counts the target's turns, carries the authored
 * events that use it up or end it, and removes every condition when it ends. A speed grant authored
 * beside the conditions (Hypnotic Pattern's speed of 0) is held by the same effect and ends with it.
 * Damage in the same result block (Contact Other Plane's 6d6 psychic) is dealt by the test outcome
 * as usual; the effect holds only the conditions. With no duration the conditions last as long as
 * the Concentration that maintains them or until an authored event ends them. Any other lifecycle
 * stays manual.
 */
function timedConditionPlan(
  action: Dnd5eCompiledEffectActionSource
): Omit<CharacterRuleActionActiveEffectPlan, 'frozenGraph'> | null {
  // A manual ruling beside the held entries (Maze's escape) is the GM's, so the effect holds nothing for it.
  const entries = entriesBesideSourceImmunity(action).filter(
    (entry) => !('outcome' in entry && entry.outcome.effectKind === 'MANUAL_ADJUDICATION')
  )
  const outcomeEntries = entries.filter((entry) => 'outcome' in entry)
  const conditionEntries = outcomeEntries.flatMap((entry) =>
    entry.outcome.effectKind === 'CONDITION' ? [{ entry, outcome: entry.outcome }] : []
  )
  const grantEntries = outcomeEntries.filter((entry) => entry.outcome.effectKind === 'APPLY_GRANT')
  const removalEntries = outcomeEntries.flatMap((entry) =>
    entry.outcome.effectKind === 'REMOVE_FROM_PLAY' ? [{ entry, outcome: entry.outcome }] : []
  )
  const lead = conditionEntries[0] ?? removalEntries[0]
  if (
    !lead ||
    grantEntries.length > 1 ||
    removalEntries.length > 1 ||
    outcomeEntries.length !== entries.length ||
    // The held entries and any damage beside them are one authored result: same path, block,
    // duration and lifecycle.
    outcomeEntries.some(
      (entry) =>
        (entry.outcome.effectKind !== 'CONDITION' &&
          entry.outcome.effectKind !== 'APPLY_GRANT' &&
          entry.outcome.effectKind !== 'REMOVE_FROM_PLAY' &&
          entry.outcome.effectKind !== 'DAMAGE') ||
        entry.pathCode !== lead.entry.pathCode ||
        entry.resultBlockId !== lead.entry.resultBlockId ||
        JSON.stringify(entry.duration) !== JSON.stringify(lead.entry.duration) ||
        JSON.stringify(entry.lifecycle) !== JSON.stringify(lead.entry.lifecycle) ||
        JSON.stringify(entry.failureMarginRider) !== JSON.stringify(lead.entry.failureMarginRider)
    ) ||
    new Set(conditionEntries.map(({ outcome }) => outcome.conditionId)).size !==
      conditionEntries.length
  )
    return null
  const {
    turnAnchor,
    endTriggers = [],
    turnEndGate,
    ...otherLifecycle
  } = lead.entry.lifecycle ?? {}
  const maintenance = maintenancePlan(action, lead.entry)
  // With no duration the conditions last until their Concentration ends (Imp Invisibility) or an
  // authored event ends them (Contact Other Plane's long rest): one of them must bound them. Until
  // dispelled, they last until the GM ends them or an authored trigger does (Sequester).
  const { duration } = lead.entry
  const untilDispelled = duration?.durationKind === 'UNTIL_DISPELLED'
  const initialRemaining = duration && !untilDispelled ? conditionDurationTurns(duration) : null
  const indefinite = !duration || untilDispelled
  const grantEntry = grantEntries[0]
  const { failureMarginRider: rider } = lead.entry
  // The rider's conditions share the failure's path, so together they fit its immunity facts.
  const riderUnsupported =
    rider !== undefined &&
    (!exactFailureMarginRider(rider) ||
      indefinite ||
      lead.entry.pathCode !== 'ON_SAVE_FAIL' ||
      conditionEntries.length + rider.outcomes.length > MAX_CONDITIONS_PER_PATH ||
      rider.outcomes.some(
        ({ conditionId }) => !(action.conditionDefinitionIds ?? []).includes(conditionId)
      ))
  // The grant joins the conditions' lifecycle, so it is planned without one of its own and counted
  // by the turn-effect kernel with them.
  const grantContribution = grantEntry
    ? modifierGrantEntryPlan({
        action,
        entry: { ...grantEntry, lifecycle: undefined },
        resultGated: false,
        untilEndEvent: false
      })?.modifierGrantContribution
    : null
  if (
    (indefinite
      ? !untilDispelled &&
        !maintenance &&
        !endTriggers.some((trigger) => trigger.event === 'LIFECYCLE' && trigger.timing === 'END')
      : initialRemaining === null) ||
    (grantEntry && (indefinite || !grantContribution)) ||
    // A turn anchor counts a duration: on whose turns, at which boundary. A grant held beside the
    // conditions is counted with them by the turn-effect kernel, on the holder's turns.
    (turnAnchor && (indefinite || grantEntry)) ||
    riderUnsupported ||
    Object.values(otherLifecycle).some((value) => value !== undefined) ||
    conditionEntries.some(
      ({ entry, outcome }) =>
        !(action.conditionDefinitionIds ?? []).includes(outcome.conditionId) ||
        !UUID.test(entry.entryId)
    )
  )
    return null
  const lifecycle = { endTriggers: canonicalEndTriggers(endTriggers) }
  if (turnEndGate)
    return turnEndGatePlan({
      effectId: action.effectId,
      entryId: lead.entry.entryId,
      minimumRoll: turnEndGate.minimumRoll,
      keepsTurn: removalEntries[0]?.outcome.keepsTurn,
      heldAlone: outcomeEntries.length === 1 && !turnAnchor && !rider && !maintenance,
      initialRemaining,
      lifecycle
    })
  return {
    authoredEffectId: action.effectId,
    compiledEntryId: lead.entry.entryId,
    frozenGraphNodeId: 'condition-duration',
    capabilityContractVersion: DND5E_EFFECT_ACTION_CAPABILITY_CONTRACT_VERSION,
    recurrenceStage: indefinite ? 'NONE' : (turnAnchor?.boundary ?? 'END_OF_TURN'),
    initialRemaining,
    tickAnchor: planTickAnchor(turnAnchor),
    conditionContributions: conditionEntries.map(({ outcome }) => ({
      conditionId: outcome.conditionId,
      recordsSource: outcome.recordsSource,
      fleesSource: outcome.fleesSource
    })),
    ...(grantContribution && {
      modifierGrantContribution: { ...grantContribution, countedByTurnEffects: true }
    }),
    ...(removalEntries[0] && {
      playAbsenceContribution: { keepsTurn: removalEntries[0].outcome.keepsTurn }
    }),
    lifecycle,
    // A removal held with no condition (Etherealness) has no condition to remove at its end.
    adapterFacts:
      conditionEntries.length > 0 ? { [DND5E_ACTIVE_EFFECT_TIMED_CONDITION_FACT_KEY]: true } : {},
    perceptionContributions: [],
    maintenance,
    marginRiders: rider ? [marginRiderPlan(rider)] : []
  }
}

/**
 * Whether a save's failure conditions are the timed conditions its active effect owns (Sleep
 * Breath, "unconscious for 1 minute, ending if the creature takes damage"): the effect, not the
 * save's outcome, carries the duration and the triggers that end it early. A timed condition that
 * authors no early end stays refused, for the spells that print a repeat save or an end event this
 * form does not yet carry (Hold Monster, Dominate, Charm Person), unless it lasts at most one round
 * (Intimidating Presence), too short for a repeat save or end event to apply. The plan owns every
 * entry of the action, so any entry on the failure path is owned when the plan exists.
 */
function ownsTimedSaveCondition(
  action: Dnd5eCompiledEffectActionSource,
  entry: CompiledEffectGroup['entries'][number]
): boolean {
  if (!('outcome' in entry)) return false
  const turns = entry.duration ? conditionDurationTurns(entry.duration) : null
  const tier = 'hitPointTier' in entry ? entry.hitPointTier : undefined
  // A tier's conditions are planned from the action narrowed to that tier.
  const planned = tier
    ? hitPointTierActions(action)?.find(({ atMost }) => atMost === tier.atMost)?.tierAction
    : action
  const plan = planned ? timedConditionPlan(planned) : null
  return (
    testPhaseKindOrNull(action) === 'SAVE' &&
    entry.pathCode === 'ON_SAVE_FAIL' &&
    (tier !== undefined ||
      (entry.lifecycle?.endTriggers ?? []).some(
        (trigger) => trigger.event !== 'LIFECYCLE' || trigger.timing === 'END'
      ) ||
      (turns !== null && turns <= 1) ||
      // A removal from play (Banishment) is the early end: the held effect returns the creature
      // when it ends, by duration, Concentration or dismissal (D178).
      plan?.playAbsenceContribution != null) &&
    plan !== null
  )
}

/** The action's entries without a successful save's immunity, which is planned beside the effect it rides, not held by it. */
function entriesBesideSourceImmunity(action: Dnd5eCompiledEffectActionSource) {
  return action.compiledEffect.entries.filter(
    (entry) => !('outcome' in entry && entry.outcome.effectKind === 'SOURCE_IMMUNITY')
  )
}

/**
 * The immunity the action leaves on its target against this source (D156). A successful save's
 * ("immune to this effect for 24 hours") is one SOURCE_IMMUNITY outcome on the success path, lasting
 * its result block's duration in the target's turns, keyed by the action. An at-will grant's lockout
 * (Chains of Carceri's "can't target it again until you finish a long rest") lands on every creature
 * the cast meets, keyed by the grant, and lasts until the source Character's long rest.
 */
function sourceImmunityPlan(
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
    testPhaseKindOrNull(action) !== 'SAVE' ||
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

/**
 * The immunity a creature that passes a holder's ward leaves on that holder (Nature's Sanctuary, "immune
 * to this effect for 24 hours"), keyed by the ward's grant. Null when the duration cannot be counted.
 */
export function incomingGateImmunityPlan(input: { wardId: string; duration: CompiledDuration }) {
  const initialRemaining = conditionDurationTurns(input.duration)
  if (initialRemaining === null || !UUID.test(input.wardId)) return null
  const plan = { compiledEntryId: input.wardId, frozenGraphNodeId: 'source-immunity' }
  return {
    authoredEffectId: input.wardId,
    capabilityContractVersion: DND5E_EFFECT_ACTION_CAPABILITY_CONTRACT_VERSION,
    immunity: {
      ...plan,
      appliesTo: 'SAVE_SUCCESS' as const,
      immuneToId: input.wardId,
      initialRemaining,
      frozenGraph: durationPublishedGraph({
        effectId: input.wardId,
        plan: { ...plan, marginRiders: [] }
      })
    }
  }
}

/**
 * A timed APPLY_GRANT of modifiers (an Antitoxin's advantage for 1 hour): the target holds an
 * Encounter active effect that carries the modifiers into its rules while it lasts and counts the
 * turns of its authored anchor down (the holder's end of turn unless the lifecycle says otherwise).
 * The lifecycle may also have the first attack roll use the grant up. Granted senses (Darkvision)
 * ride along; proficiencies, chosen or scaling senses, slot-scaled amounts and any other lifecycle
 * are not carried, so such a grant stays manual. An attack applies its grant only
 * on the authored hit path, alongside the hit's other outcomes.
 */
function modifierGrantPlan(
  action: Dnd5eCompiledEffectActionSource
): Omit<CharacterRuleActionActiveEffectPlan, 'frozenGraph'> | null {
  const { entries } = action.compiledEffect
  const attack = testPhaseKindOrNull(action) === 'ATTACK'
  const hitGrants = attack
    ? entries.flatMap((entry) =>
        'outcome' in entry &&
        isActiveEffectPlanOutcome(entry, action) &&
        entry.outcome.effectKind === 'APPLY_GRANT'
          ? [entry]
          : []
      )
    : []
  // A grant authored alike on the hit and the miss applies whatever the attack (as on a save).
  const [hitGrant, otherGrant, ...restGrants] = hitGrants
  const alikeOnBothResults =
    hitGrant !== undefined &&
    otherGrant !== undefined &&
    restGrants.length === 0 &&
    (hitGrant.pathCode === 'ON_MISS') !== (otherGrant.pathCode === 'ON_MISS') &&
    authoredAlike(hitGrant) === authoredAlike(otherGrant)
  if (hitGrants.length > 1 && !alikeOnBothResults)
    unsupported('D&D attacks apply at most one grant on a hit.')
  if (
    hitGrants.length === 1 &&
    entries.some((entry) => 'outcome' in entry && entry.outcome.effectKind === 'ACTOR_RELATIONSHIP')
  )
    unsupported('D&D attacks apply one active effect on a hit.')
  const entry = attack ? hitGrants[0] : entries[0]
  const plan =
    testPhaseKindOrNull(action) === 'SAVE'
      ? saveGrantPlan(action)
      : entry
        ? // A grant with no duration lasts until one of its authored end events (Hide in Plain Sight).
          modifierGrantEntryPlan({
            action,
            entry,
            resultGated: attack && !alikeOnBothResults,
            untilEndEvent: !('duration' in entry) || entry.duration === undefined
          })
        : null
  return plan && { ...plan, chosenItem: chosenItemPlan(action) }
}

/**
 * A save action's timed grant the plan holds alone, applied only on its authored save result
 * (Vicious Mockery's disadvantage on a failed save). A grant authored alike on both results applies
 * whatever the save (Heat Metal's disadvantage, owed unless the item is dropped). A grant beside
 * timed conditions or a repeated save is planned with them instead.
 */
function saveGrantPlan(
  action: Dnd5eCompiledEffectActionSource
): Omit<CharacterRuleActionActiveEffectPlan, 'frozenGraph'> | null {
  if (
    testPhaseKindOrNull(action) !== 'SAVE' ||
    timedConditionPlan(action) !== null ||
    repeatingDirectFollowUpSavePlan(action) !== null
  )
    return null
  const [entry, other, ...rest] = action.compiledEffect.entries.flatMap((candidate) =>
    'outcome' in candidate &&
    candidate.outcome.effectKind === 'APPLY_GRANT' &&
    !isRepeatCarrierEntry(candidate)
      ? [candidate]
      : []
  )
  if (
    !entry ||
    rest.length > 0 ||
    (other && (other.pathCode === entry.pathCode || authoredAlike(entry) !== authoredAlike(other)))
  )
    return null
  // A grant on one save result applies only on it; one authored alike on both applies either way.
  return modifierGrantEntryPlan({ action, entry, resultGated: !other, untilEndEvent: false })
}

/**
 * The item a grant plan's action is used on, from its authored paths (see the plan's
 * `chosenItem`); null when it names none. The paths name one item, a bound grant's modifiers are
 * all scoped to their source (the item), and a release is one save result's, the result a grant
 * withheld on release is authored on.
 */
function chosenItemPlan(
  action: Dnd5eCompiledEffectActionSource
): NonNullable<CharacterRuleActionActiveEffectPlan['chosenItem']> | null {
  const entries = action.compiledEffect.entries.flatMap((entry) =>
    'outcome' in entry ? [entry] : []
  )
  const items = new Set(
    entries.flatMap(({ chosenItem }) => (chosenItem ? [JSON.stringify(chosenItem)] : []))
  )
  // A repeat carrier is bound to the item by its own plan, not the modifier grant's.
  const grants = entries.flatMap((entry) =>
    entry.outcome.effectKind === 'APPLY_GRANT' && !isRepeatCarrierEntry(entry)
      ? [{ pathCode: entry.pathCode, outcome: entry.outcome }]
      : []
  )
  const [releasedOn, ...otherReleasePaths] = new Set(
    entries.flatMap((entry) =>
      entry.outcome.effectKind === 'RELEASE_CHOSEN_ITEM' ? [entry.pathCode] : []
    )
  )
  const bound = grants.filter(({ outcome }) => outcome.bindsChosenItem)
  const withheld = grants.filter(({ outcome }) => outcome.unlessChosenItemReleased)
  const item = entries.find(({ chosenItem }) => chosenItem)?.chosenItem
  if (!item) {
    if (bound.length + withheld.length > 0 || releasedOn !== undefined)
      unsupported('D&D action uses a chosen item it does not name.')
    return null
  }
  if (items.size !== 1) unsupported('D&D action paths must name one chosen item.')
  if (
    otherReleasePaths.length > 0 ||
    (releasedOn !== undefined && releasedOn !== 'ON_SAVE_FAIL' && releasedOn !== 'ON_SAVE_SUCCESS')
  )
    unsupported('D&D chosen item is released on one save result.')
  if (withheld.some(({ pathCode }) => pathCode !== releasedOn))
    unsupported('D&D grant withheld on release must be authored on the release result.')
  if (
    bound.some(
      ({ outcome }) =>
        outcome.grants.senses?.length ||
        (outcome.grants.modifiers ?? []).some(({ scope }) => scope !== 'SOURCE')
    )
  )
    unsupported('D&D grant bound to a chosen item grants only modifiers scoped to it.')
  return {
    category: item.category ?? null,
    requiredProperties: [...new Set(item.requiredProperties ?? [])].sort(),
    excludedProperties: [...new Set(item.excludedProperties ?? [])].sort(),
    equipmentIds: [...new Set(item.equipmentIds ?? [])].sort(),
    bindsGrant: bound.length > 0,
    releasedOn: releasedOn ?? null,
    grantUnlessReleased: withheld.length > 0
  }
}

/**
 * A timed TELEPATHIC_LINK (Telepathic Bond): each creature the cast reached holds an Encounter
 * active effect naming the whole bond. It counts the holder's turns and ends with the duration;
 * the bond carries provenance and a badge, no further rule. Any lifecycle stays manual.
 */
function actorLinkPlan(
  action: Dnd5eCompiledEffectActionSource
): Omit<CharacterRuleActionActiveEffectPlan, 'frozenGraph'> | null {
  const { entries } = action.compiledEffect
  const entry = entries[0]
  if (entries.length !== 1 || !entry || !('outcome' in entry)) return null
  if (entry.outcome.effectKind !== 'TELEPATHIC_LINK' || !entry.duration) return null
  const initialRemaining = conditionDurationTurns(entry.duration)
  const resultGate = entryResultGate(action, entry.pathCode)
  if (
    initialRemaining === null ||
    resultGate === undefined ||
    Object.values(entry.lifecycle ?? {}).some((value) => value !== undefined) ||
    !UUID.test(entry.entryId)
  )
    return null
  return {
    authoredEffectId: action.effectId,
    compiledEntryId: entry.entryId,
    frozenGraphNodeId: 'actor-link',
    capabilityContractVersion: DND5E_EFFECT_ACTION_CAPABILITY_CONTRACT_VERSION,
    recurrenceStage: 'END_OF_TURN',
    initialRemaining,
    actorLinkContribution: {
      linkOutcomeId: entry.outcome.id,
      linkKind: 'TELEPATHIC',
      excludesAbilityAtOrBelow: entry.outcome.excludesAbilityAtOrBelow
    },
    ...(resultGate && { resultGate }),
    adapterFacts: {},
    perceptionContributions: [],
    maintenance: maintenancePlan(action, entry),
    marginRiders: []
  }
}

/**
 * A timed MANIFEST creature (Giant Insect): each creature the cast reached swaps into one of the
 * authored forms for the duration (D130). Which form is the caster's choice at cast time; the plan
 * carries every form and the Encounter effect records the chosen Creature. Polymorph authors it on
 * the failed-save path with a filter instead of fixed forms: the effect exists only for a creature
 * that failed, and the caster names any Creature that meets the filter.
 */
function creatureFormPlan(
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
    forms.some(({ id, creatureId }) => !UUID.test(id) || !UUID.test(creatureId)) ||
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
        .map(({ id, label, creatureId, maxTargets }) => ({ id, label, creatureId, maxTargets })),
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

/**
 * Hide: a successful check conceals the actor from the observers its total beats. It lasts until
 * dispelled and the events its lifecycle authors consume it (Hide: the first attack roll); any
 * other lifecycle stays unsupported.
 */
function concealmentPlan(
  action: Dnd5eCompiledEffectActionSource
): Omit<CharacterRuleActionActiveEffectPlan, 'frozenGraph'> | null {
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
    maintenance: maintenancePlan(action, entry),
    marginRiders: []
  }
}

/**
 * The direct-save form applies its condition, or its timed modifier grants, only in the originating
 * SAVE outcome. Its delayed FOLLOW_UP_SAVE becomes a separate active-effect graph. The turn-effect
 * kernel counts the grant form down with its repeat save, so the grant tick planner leaves it alone.
 * An ACTIVATED action (Power Word Stun) has no first save: its condition applies at cast on the
 * ON_USE path and only the condition form repeats, against the DC the cast settles.
 */
function repeatingDirectFollowUpSavePlan(
  action: Dnd5eCompiledEffectActionSource,
  triggerCode: 'SAVING_THROW' | 'ACTIVATED' = 'SAVING_THROW'
): Omit<CharacterRuleActionActiveEffectPlan, 'frozenGraph'> | null {
  const { invocation } = action.compiledEffect
  const entries = entriesBesideSourceImmunity(action)
  const leadEntries = entries.slice(0, -1)
  const leadEntry = leadEntries[0]
  const saveEntry = entries.at(-1)
  const pathCode = triggerCode === 'ACTIVATED' ? 'ON_USE' : 'ON_SAVE_FAIL'
  if (
    invocation.kind !== 'ACTION' ||
    invocation.triggerCode !== triggerCode ||
    !leadEntry ||
    !saveEntry ||
    !('outcome' in leadEntry) ||
    !('outcome' in saveEntry) ||
    saveEntry.resolutionKind !== 'DIRECT' ||
    saveEntry.groupKind !== 'SEQUENTIAL' ||
    saveEntry.pathCode !== pathCode ||
    saveEntry.outcome.effectKind !== 'FOLLOW_UP_SAVE' ||
    // One held grant, or the conditions of one result: the same path, block and duration.
    leadEntries.some(
      (entry) =>
        !('outcome' in entry) ||
        entry.resolutionKind !== 'DIRECT' ||
        entry.groupKind !== 'SEQUENTIAL' ||
        entry.pathCode !== pathCode ||
        entry.resultBlockId !== saveEntry.resultBlockId ||
        JSON.stringify(entry.duration) !== JSON.stringify(leadEntry.duration) ||
        (leadEntries.length > 1 && entry.outcome.effectKind !== 'CONDITION') ||
        (triggerCode === 'ACTIVATED' && entry.outcome.effectKind !== 'CONDITION')
    ) ||
    leadEntries.length > MAX_CONDITIONS_PER_PATH ||
    (triggerCode === 'ACTIVATED' && leadEntries.length !== 1)
  ) {
    return null
  }
  const lead = leadEntry.outcome
  const save = saveEntry.outcome
  const leadConditions = leadEntries.flatMap((entry) =>
    'outcome' in entry && entry.outcome.effectKind === 'CONDITION' ? [entry.outcome] : []
  )
  if (new Set(leadConditions.map(({ conditionId }) => conditionId)).size !== leadConditions.length)
    return null
  // A failed repeat that ends the effect by leaving a second condition in place of the held one
  // ("restrained, then petrified") counts one turn, whatever the held condition's duration.
  const escalation =
    lead.effectKind === 'CONDITION' && leadEntries.length === 1 && !leadEntry.duration
      ? escalationCondition(save)
      : null
  if (escalation && !(action.conditionDefinitionIds ?? []).includes(escalation.conditionId))
    return null
  const initialRemaining = escalation
    ? 1
    : leadEntry.duration
      ? conditionDurationTurns(leadEntry.duration)
      : null
  const repeatSave = dnd5eRepeatSave({
    abilityDefinitionId: save.savingThrow.abilityDefinitionId,
    savingThrow: save.savingThrow,
    requestNodeId: 'repeat-save-d20',
    heldConditionIds: leadConditions.map(({ conditionId }) => conditionId),
    escalationConditionId: escalation?.conditionId,
    repeatRollInfluence: save.repeatRollInfluence,
    repeatAttemptGate: save.repeatAttemptGate,
    triggersOnly: save.timing === 'ON_TRIGGERS_ONLY'
  })
  const grantPlan =
    lead.effectKind === 'APPLY_GRANT'
      ? modifierGrantEntryPlan({
          action,
          entry: leadEntry,
          resultGated: false,
          untilEndEvent: false
        })
      : null
  const grantContribution = grantPlan?.modifierGrantContribution
  const contribution =
    leadConditions.length > 0 &&
    leadConditions.every(
      ({ conditionId }) =>
        UUID.test(conditionId) && (action.conditionDefinitionIds ?? []).includes(conditionId)
    )
      ? {
          conditionContributions: leadConditions.map(
            ({ conditionId, recordsSource, fleesSource }) => ({
              conditionId,
              recordsSource,
              fleesSource
            })
          )
        }
      : grantPlan && grantContribution
        ? {
            tickAnchor: grantPlan.tickAnchor,
            modifierGrantContribution: { ...grantContribution, countedByTurnEffects: true }
          }
        : null
  if (
    !contribution ||
    !UUID.test(leadEntry.resultBlockId) ||
    initialRemaining === null ||
    (save.timing !== 'TARGET_TURN_END' && save.timing !== 'ON_TRIGGERS_ONLY') ||
    (save.attempts.kind === 'ONCE'
      ? (save.attempts.repeatOnFailure === true) === (escalation !== null)
      : escalation !== null ||
        !isTallyCount(save.attempts.successesToEnd) ||
        !isTallyCount(save.attempts.failuresToResolve)) ||
    !repeatSave ||
    save.onSuccess.kind !== 'END' ||
    (escalation === null && save.onFailure.kind !== 'CONTINUE') ||
    (save.onDurationComplete !== undefined && save.onDurationComplete.kind !== 'END') ||
    (save.repeatAttemptGate && save.repeatRollInfluence)
  ) {
    return null
  }
  return {
    authoredEffectId: action.effectId,
    compiledEntryId: leadEntry.resultBlockId,
    frozenGraphNodeId: 'repeat-save-test',
    capabilityContractVersion: DND5E_EFFECT_ACTION_CAPABILITY_CONTRACT_VERSION,
    recurrenceStage: 'END_OF_TURN',
    initialRemaining,
    ...contribution,
    // A held grant is made only on the save result it is authored on; held conditions are the graph's.
    ...(lead.effectKind !== 'CONDITION' &&
      leadEntry.pathCode !== 'ON_USE' && { resultGate: dnd5eResultGate(leadEntry.pathCode) }),
    ...(save.repeatTriggers?.length && {
      lifecycle: { endTriggers: [], repeatTriggers: canonicalRepeatTriggers(save.repeatTriggers) }
    }),
    adapterFacts: repeatSave.adapterFacts,
    ...(save.attempts.kind === 'THRESHOLDS' && {
      saveThresholds: {
        successesToEnd: save.attempts.successesToEnd,
        failuresToResolve: save.attempts.failuresToResolve,
        consecutive: save.attempts.consecutive
      }
    }),
    // A cast with no save of its own rolls no d20 to carry the DC, so the cast's own graph settles it.
    ...(triggerCode === 'ACTIVATED' ? { castFactKeys: [DND5E_SAVE_DC_FACT_KEY] } : {}),
    castSaveDcFactKey: triggerCode === 'ACTIVATED' ? null : repeatSave.castSaveDcFactKey,
    perceptionContributions: [],
    maintenance: maintenancePlan(action, leadEntry),
    marginRiders: []
  }
}

function isTallyCount(count: number) {
  return Number.isSafeInteger(count) && count >= 1 && count <= 255
}

/** The tally once a made or failed save is counted; a consecutive tally zeroes the other count. */
function countRepeatSave(
  thresholds: ActiveEffectSaveThresholds,
  before: ActiveEffectSaveTally | undefined,
  path: 'ON_SAVE_FAIL' | 'ON_SAVE_SUCCESS'
): ActiveEffectSaveTally {
  const { successes, failures } = before ?? { successes: 0, failures: 0 }
  return path === 'ON_SAVE_SUCCESS'
    ? { successes: successes + 1, failures: thresholds.consecutive ? 0 : failures }
    : { successes: thresholds.consecutive ? 0 : successes, failures: failures + 1 }
}

/** The entries the repeat-save effect holds (its condition or grant), without the follow-up save. */
function repeatingDirectFollowUpSaveLeadEntries(
  action: Dnd5eCompiledEffectActionSource
): CompiledEffectGroup['entries'] | null {
  return repeatingDirectFollowUpSavePlan(action)
    ? entriesBesideSourceImmunity(action).slice(0, -1)
    : null
}

function isExactImmediateFollowUpSaveAction(action: Dnd5eCompiledEffectActionSource): boolean {
  const save = immediateFollowUpSaveEntries(action.compiledEffect.entries)?.saveEntry.outcome
  if (!save || !isImmediateFollowUpSave(save) || testPhaseKindOrNull(action) !== 'ATTACK')
    return false
  // A repeating save runs only with its active-effect plan; without one the condition would
  // never be saved against again. A duration belongs to the repeating save's condition or to a
  // one-time save's condition (D62.2), which its own active effect times.
  const entries = action.compiledEffect.entries
  // A turn anchor only counts the duration of a timed condition; any other lifecycle is not held here.
  const lifecycle = entries.some(
    (entry) =>
      'lifecycle' in entry &&
      entry.lifecycle &&
      Object.values({ ...entry.lifecycle, turnAnchor: undefined }).some(
        (value) => value !== undefined
      )
  )
  const timed = entries.some((entry) => 'duration' in entry && entry.duration)
  const repeats = save.attempts.repeatOnFailure === true || escalatingImmediateSave(save) !== null
  const bandOutcomes = [
    ...(save.onFailure.kind === 'OUTCOMES' ? save.onFailure.outcomes : []),
    ...(save.onSuccess.kind === 'OUTCOMES' ? save.onSuccess.outcomes : [])
  ]
  // A band's gate is held by the hit's own graph; a held condition or repeat would bypass it.
  const gated =
    (save.onFailure.kind === 'OUTCOMES' && save.onFailure.gate !== undefined) ||
    (save.onSuccess.kind === 'OUTCOMES' && save.onSuccess.gate !== undefined)
  if (gated && (repeats || timed || lifecycle)) return false
  return (
    (repeats
      ? repeatingImmediateFollowUpSavePlan(action) !== null
      : !lifecycle &&
        !save.onDurationComplete &&
        (!timed || timedImmediateConditionPlan(action) !== null)) &&
    bandOutcomes.every(
      (outcome) =>
        outcome.effectKind !== 'CONDITION' ||
        (action.conditionDefinitionIds ?? []).includes(outcome.conditionId)
    )
  )
}

function authoredHealingDiceTerm(published: ServerPublishedRuleDefinitionDto): {
  count: number
  die: number
} {
  const nodes = published.definition.nodes
  const byId = new Map(nodes.map((node) => [node.id, node]))
  const healingTotal = nodes.find((node) => node.operation.key === DND5E_HEAL_TOTAL_OPERATION_KEY)
  const subtotal = healingTotal?.inputs.subtotal
  if (!subtotal || subtotal.kind !== 'NODE_OUTPUT')
    throw new Dnd5eEffectActionCompilerError(
      'D&D dice healing compiled graph has no exact authored subtotal.'
    )
  const dieNodes = new Set<string>()
  const visit = (binding: unknown): void => {
    if (!binding || typeof binding !== 'object' || Array.isArray(binding)) return
    const value = binding as { kind?: unknown; nodeId?: unknown }
    if (value.kind !== 'NODE_OUTPUT' || typeof value.nodeId !== 'string') return
    if (dieNodes.has(value.nodeId)) return
    const node = byId.get(value.nodeId)
    if (!node) return
    if (node.operation.key === 'evidence.integer-range') {
      dieNodes.add(node.id)
      return
    }
    Object.values(node.inputs).forEach(visit)
  }
  visit(subtotal)
  const dieValues = [...dieNodes].map((id) => byId.get(id)?.inputs.max)
  if (
    dieNodes.size === 0 ||
    dieValues.some(
      (binding) => !binding || binding.kind !== 'LITERAL' || typeof binding.value !== 'number'
    )
  )
    throw new Dnd5eEffectActionCompilerError(
      'D&D dice healing compiled graph has no exact authored dice term.'
    )
  const firstDie = dieValues[0]
  if (!firstDie || firstDie.kind !== 'LITERAL' || typeof firstDie.value !== 'number')
    throw new Dnd5eEffectActionCompilerError('D&D dice healing compiled graph has no exact die.')
  const die = firstDie.value
  if (
    dieValues.some(
      (binding) =>
        binding?.kind !== 'LITERAL' || typeof binding.value !== 'number' || binding.value !== die
    )
  )
    throw new Dnd5eEffectActionCompilerError(
      'D&D dice healing compiled graph has inconsistent authored dice sizes.'
    )
  return { count: dieNodes.size, die }
}

/**
 * Compiled PER_LEVEL source is flattened to one row per level. Validate the
 * whole reachable authored group before publishing TEST; only exact row
 * selection from locked facts remains deferred.
 */
function validateDiceOutcomeGroup(
  entries: readonly CompiledEffectGroup['entries'][number][]
): void {
  const first = entries[0]
  if (
    !first ||
    !('outcome' in first) ||
    first.outcome.effectKind !== 'DAMAGE' ||
    first.outcome.valueKind !== 'DICE'
  )
    return
  const firstOutcome = first.outcome
  if (firstOutcome.scalingKind === 'NONE') {
    if (entries.length !== 1) unsupported('D&D unscaled dice outcomes must have one authored row.')
    // A critical hit rolls hit damage dice twice, so they must stay bounded when doubled.
    if (
      first.pathCode === 'ON_HIT' &&
      [firstOutcome.dice, firstOutcome.halfHitPointsDice].some(
        (dice) =>
          dice !== undefined &&
          !/^[1-9]\d*$/.test(dice) &&
          // A critical hit doubles the dice and Brutal Critical adds up to 3 (31 dice at most).
          parseBoundedDiceConfiguration(dice).term.count > 14
      )
    )
      unsupported('D&D critical dice exceed the bounded exact-dice contract.')
    return
  }
  if (firstOutcome.scalingKind !== 'PER_LEVEL')
    unsupported('D&D dice outcomes require NONE or PER_LEVEL scaling.')
  const seenLevels = new Set<number>()
  for (const entry of entries) {
    if (!('outcome' in entry)) unsupported('D&D dice outcome path is malformed.')
    const outcome = entry.outcome
    if (
      outcome.effectKind !== 'DAMAGE' ||
      outcome.valueKind !== 'DICE' ||
      outcome.scalingKind !== 'PER_LEVEL' ||
      outcome.scalingSource !== firstOutcome.scalingSource ||
      ('classId' in outcome ? outcome.classId : undefined) !==
        ('classId' in firstOutcome ? firstOutcome.classId : undefined) ||
      !Number.isSafeInteger(outcome.level) ||
      outcome.level < 1 ||
      !Number.isSafeInteger(outcome.order) ||
      outcome.order < 0 ||
      seenLevels.has(outcome.level)
    ) {
      unsupported('D&D dice scaling levels must be unique bounded entries.')
    }
    seenLevels.add(outcome.level)
  }
}

function testPlan(action: Dnd5eCompiledEffectActionSource): TestPlan | null {
  const { invocation, entries } = action.compiledEffect
  const kind = testPhaseKindOrNull(action)
  if (!kind) return null
  const allowedPaths =
    kind === 'ATTACK' ? ['ON_HIT', 'ON_MISS', 'ON_CRIT'] : ['ON_SAVE_FAIL', 'ON_SAVE_SUCCESS']
  if (
    invocation.kind !== 'ACTION' ||
    !isSupportedTestActivation(invocation) ||
    !isSupportedTestTargetPolicy(action) ||
    entries.length < 1
  )
    unsupported(
      'D&D test actions must use one bounded single-target action or movement-reaction shape.'
    )
  const relationshipEntries = entries.filter(
    (entry) => 'outcome' in entry && entry.outcome.effectKind === 'ACTOR_RELATIONSHIP'
  )
  const executableEntries = entries.filter((entry) => !isActiveEffectPlanOutcome(entry, action))
  if (relationshipEntries.length > 1)
    unsupported('D&D action has more than one relationship outcome.')
  // A failed save's creature form is left to its active-effect plan; one the plan cannot carry
  // must not silently vanish.
  if (
    kind === 'SAVE' &&
    entries.some(
      (entry) =>
        'outcome' in entry &&
        entry.outcome.effectKind === 'MANIFEST' &&
        entry.outcome.manifestKind === 'CREATURE'
    ) &&
    creatureFormPlan(action) === null
  )
    unsupported('D&D creature form after a saving throw must be one bounded timed form.')
  const branches = new Map<string, Outcome>()
  const branchResultBlocks = new Map<string, string>()
  const recurringPlan = supportedRecurringPlan(action)
  for (const entry of executableEntries) {
    if (
      entry.resolutionKind !== 'DIRECT' ||
      (entry.groupKind !== 'SINGLE' &&
        // The other results of a sequence ride the action's active-effect plan: a relationship, or
        // a removal from play held beside the condition it follows (Banishment).
        !(
          entry.groupKind === 'SEQUENTIAL' &&
          (relationshipEntries.length === 1 ||
            timedConditionPlan(action)?.playAbsenceContribution != null)
        )) ||
      (hasLifecycleOverride(entry) &&
        !ownsTimedSaveCondition(action, entry) &&
        (recurringPlan?.compiledEntryId !== entry.resultBlockId || kind !== 'SAVE')) ||
      entry.rangeOverride ||
      entry.targetingOverride ||
      !allowedPaths.includes(entry.pathCode)
    )
      unsupported('D&D test action branches must be unique fixed direct authored paths.')
    const outcome = boundedTestOutcome(entry)
    if (
      outcome.kind === 'CONDITION_APPLY' &&
      !(action.conditionDefinitionIds ?? []).includes(outcome.conditionId)
    )
      unsupported('D&D test action condition is not in the pinned System vocabulary.')
    const resultBlockId = entry.resultBlockId
    if (typeof resultBlockId !== 'string' || resultBlockId.length === 0)
      unsupported('D&D test action outcomes must retain their authored result block.')
    const existingResultBlockId = branchResultBlocks.get(entry.pathCode)
    if (existingResultBlockId && existingResultBlockId !== resultBlockId)
      unsupported('D&D test action branches must not merge distinct authored result blocks.')
    branchResultBlocks.set(entry.pathCode, resultBlockId)
    // TEST chooses a result path once. OUTCOME specializes every ordered
    // outcome in that exact authored result block after TEST resolves.
    if (!branches.has(entry.pathCode)) branches.set(entry.pathCode, outcome)
  }
  return { kind, branches }
}

/** The action a plan reads: a ruling sequence's one executable outcome, or the action itself. */
function executableAction(action: Dnd5eCompiledEffectActionSource) {
  return rulingSequence(action)?.executable ?? action
}

/** An outcome no test decides, as one proposal node, a dice graph or the action's relationship graph proposes it. */
type Dnd5eDirectOutcome =
  | Exclude<
      SpecializedOutcome,
      {
        kind:
          | 'DICE_SCALAR_REDUCTION'
          | 'HIT_POINT_MAXIMUM_REDUCTION'
          | 'DAMAGE_DERIVED_HEAL'
          | 'FORCED_MOVEMENT'
      }
    >
  | { kind: 'DIRECT_RELATIONSHIP'; relationshipId: string }
/** What a direct outcome reads from its action once `supported` has resolved its targets and plans. */
type DirectOutcomeInput = Readonly<{
  action: Dnd5eCompiledEffectActionSource
  onList: boolean
  selfTeleport: { maxFeet: number; destinationKind: 'VISIBLE' | 'SPECIFIED_POINT' } | null
  plans: Readonly<{ grant: boolean; link: boolean; form: boolean; absence: boolean }>
}>
type AuthoredOutcomeOf<Kind extends Dnd5eAuthoredOutcome['effectKind']> = Extract<
  Dnd5eAuthoredOutcome,
  { effectKind: Kind }
>

const unsupportedDirectOutcome: () => never = () =>
  unsupported('D&D Effect action outcome is not a supported hit-point or condition outcome.')
// A list runs the action's one graph on each chosen creature, so it carries any outcome that lands
// on its target. An outcome that acts on the actor (a Dash, a self teleport, a concealment) or on the
// event a reaction answered has no creature to repeat on; an outcome no cast can run keeps the reason
// a single target gets, so the list is refused only once it is read.
function offList<Plan extends Dnd5eDirectOutcome>(plan: Plan, input: DirectOutcomeInput): Plan {
  if (input.onList)
    unsupported(
      'D&D chosen-creature action outcome must land on each chosen creature, not on the actor or a triggering event.'
    )
  return plan
}
function targetOnlyDirectOutcome(outcome: Dnd5eAuthoredOutcome, input: DirectOutcomeInput) {
  const targetOnly = dnd5eTargetOnlyOutcome(outcome) ?? unsupportedDirectOutcome()
  return targetOnly.kind === 'ADD_SPEED_TO_MOVEMENT' ? offList(targetOnly, input) : targetOnly
}
/**
 * The one dispatch from an authored outcome kind to the direct outcome it compiles to (ADR 0039
 * decision 1). A kind with no entry compiles to its registry target-only outcome, if it has one.
 */
const DND5E_DIRECT_OUTCOMES: {
  [Kind in Dnd5eAuthoredOutcome['effectKind']]?: (
    outcome: AuthoredOutcomeOf<Kind>,
    input: DirectOutcomeInput
  ) => Dnd5eDirectOutcome
} = {
  // The action holds its target by its relationship alone (Engulf): the relationship's own graph
  // is the action's, and its active-effect plan stores the hold.
  ACTOR_RELATIONSHIP: (outcome, { action, onList }) => {
    if (onList) unsupported('D&D chosen-creature action outcome cannot be a relationship.')
    relationshipPlan(action)
    return { kind: 'DIRECT_RELATIONSHIP', relationshipId: outcome.id }
  },
  CONDITION: (outcome, input) => {
    uuid(outcome.conditionId, 'D&D condition definition identity')
    if (!(input.action.conditionDefinitionIds ?? []).includes(outcome.conditionId))
      unsupported('D&D Effect action condition is not in the pinned System vocabulary.')
    return { kind: 'CONDITION_APPLY', conditionId: outcome.conditionId }
  },
  KILL: () => ({ kind: 'KILL' }),
  TELEPORT: (outcome, input) => {
    if (dnd5eTargetOnlyOutcome(outcome)) return targetOnlyDirectOutcome(outcome, input)
    // The caster moves its own token inside the Scene: the commit records a one-shot allowance the
    // following TELEPORT move spends, bounded by the spell's range.
    if (!input.selfTeleport) unsupportedDirectOutcome()
    return offList({ kind: 'TELEPORT_ALLOWANCE', ...input.selfTeleport }, input)
  },
  CONCEAL_FROM_OBSERVERS: (_outcome, input) => offList({ kind: 'CONCEAL' }, input),
  DETECT_CONCEALED: (_outcome, input) => offList({ kind: 'DETECT_CONCEALED' }, input),
  // The reaction cancels the event it answered: nothing is stored on its target, the cast.
  CANCEL_TRIGGERING_EVENT: (_outcome, input) => offList({ kind: 'CANCEL_TRIGGERING_EVENT' }, input),
  // The commit ends the held effects its plan selects; nothing is stored on the target here.
  END_EFFECTS: (_outcome, input) => offList({ kind: 'END_EFFECTS' }, input),
  APPLY_GRANT: (_outcome, { plans }) =>
    plans.grant ? { kind: 'MODIFIER_GRANT' } : unsupportedDirectOutcome(),
  TELEPATHIC_LINK: (_outcome, { plans }) =>
    plans.link ? { kind: 'ACTOR_LINK' } : unsupportedDirectOutcome(),
  MANIFEST: (_outcome, { plans }) =>
    plans.form ? { kind: 'CREATURE_FORM' } : unsupportedDirectOutcome(),
  REMOVE_FROM_PLAY: (_outcome, { plans }) =>
    plans.absence ? { kind: 'PLAY_ABSENCE' } : unsupportedDirectOutcome(),
  HEAL: (outcome, { action }) => {
    if (outcome.valueKind === 'DICE') {
      parseBoundedDiceConfiguration(healDiceConfiguration(outcome, action.spellCastLevel))
      validateHealBonuses(outcome.bonuses)
      return { kind: 'DICE_HEAL', temporary: outcome.temporary ?? false }
    }
    if (outcome.valueKind === 'RESOURCE_SPENT') {
      if (outcome.temporary || outcome.bonuses?.length || !(outcome.amount > 0))
        unsupported('D&D spent healing is a plain positive amount per unit spent.')
      return { kind: 'SPENT_HEAL' }
    }
    const amount = fixedHealAmount(outcome, action.spellCastLevel)
    return { kind: outcome.temporary ? 'TEMPORARY_HIT_POINTS' : 'HEAL', amount }
  },
  DAMAGE: (outcome) => {
    // Dice damage with no attack or save to decide it (Magic Missile's dart): one roll of the
    // authored dice, which a bonus or a scaling row would have to be bound to facts to read.
    if (outcome.valueKind === 'DICE') {
      if (outcome.scalingKind !== 'NONE' || outcome.bonuses?.length || outcome.halfHitPointsDice)
        unsupported('D&D direct dice damage must be one unscaled roll with no bonuses.')
      parseBoundedDiceConfiguration(outcome.dice)
      uuid(outcome.damageTypeId, 'D&D damage type identity')
      return { kind: 'DICE_DAMAGE', damageTypeId: outcome.damageTypeId }
    }
    const amount = positiveFixedAmount(outcome)
    uuid(outcome.damageTypeId, 'D&D damage type identity')
    return {
      kind: 'DAMAGE',
      amount: multipliedDamageAmount(amount, damageMultiplier(outcome)),
      damageTypeId: outcome.damageTypeId
    }
  }
}

function specializedDirectOutcome<Kind extends Dnd5eAuthoredOutcome['effectKind']>(
  kind: Kind,
  outcome: AuthoredOutcomeOf<Kind>,
  input: DirectOutcomeInput
): Dnd5eDirectOutcome {
  const specialize = DND5E_DIRECT_OUTCOMES[kind]
  return specialize ? specialize(outcome, input) : targetOnlyDirectOutcome(outcome, input)
}

// A contest whose win holds the target under the action's relationship (Grapple, D152) compiles
// to the contest graph alone; its relationship is the action's active-effect plan. A contest whose
// win applies a condition or moves its target (Shove, D105) tests by the contest graph and
// specializes its win as the ON_CHECK_SUCCESS outcome.
function supported(
  action: Dnd5eCompiledEffectActionSource
): Dnd5eDirectOutcome | { kind: 'CONTEST_RELATIONSHIP' } | { kind: 'CHECK_OUTCOME' } {
  const effect = action.compiledEffect
  const invocation = effect.invocation
  const grantPlan = modifierGrantPlan(action)
  const conditionPlan = timedConditionPlan(action)
  const linkPlan = actorLinkPlan(action)
  const formPlan = creatureFormPlan(action)
  // A CHECK action rolls its authored check against a fixed DC, each observer's passive score, the
  // concealments that hide creatures from the checker, or the target's own check in a contest.
  const checkAction = invocation.triggerCode === 'CHECK'
  const contestAction = checkAction && invocation.check.dc.kind === 'CONTEST'
  const supportsSelf = namesOnlyItsUser(invocation, conditionPlan?.playAbsenceContribution != null)
  // A teleport spell (Misty Step) names its reach as a distance range on a self-targeted action:
  // the range bounds the teleport, not a target.
  const teleportReachFeet =
    invocation.range.rangeKind === 'DISTANCE' &&
    invocation.targeting?.selectionKind === 'SELF' &&
    invocation.range.unit === 'FEET' &&
    Number.isSafeInteger(invocation.range.amount) &&
    invocation.range.amount > 0 &&
    invocation.range.longAmount === undefined
      ? invocation.range.amount
      : null
  const firstEntry = effect.entries[0]
  const firstOutcome = firstEntry && 'outcome' in firstEntry ? firstEntry.outcome : undefined
  const selfTeleport =
    teleportReachFeet !== null &&
    firstOutcome?.effectKind === 'TELEPORT' &&
    firstOutcome.targetKind === 'SELF' &&
    (firstOutcome.destinationKind === 'VISIBLE' ||
      firstOutcome.destinationKind === 'SPECIFIED_POINT')
      ? { maxFeet: teleportReachFeet, destinationKind: firstOutcome.destinationKind }
      : null
  // A DISTANCE or Touch range only warns when the target is out of range (D11).
  const supportsTargetRange =
    invocation.range.rangeKind === 'UNLIMITED' ||
    invocation.range.rangeKind === 'TOUCH' ||
    (invocation.range.rangeKind === 'DISTANCE' &&
      Number.isSafeInteger(invocation.range.amount) &&
      invocation.range.amount > 0 &&
      invocation.range.longAmount === undefined)
  // Excluded creature types stay on the invocation: the room warns for an excluded target and the
  // table can override it, so they never make an action unsupported.
  const supportsSingleTarget =
    supportsTargetRange &&
    invocation.targeting?.selectionKind === 'SINGLE_TARGET' &&
    // A grant (Help), a timed condition (Invisibility) or a check (First Aid) may ask for a willing
    // target: an unwilling one only warns, and the table can override it.
    (invocation.targeting.dispositionKind === 'ANY' ||
      (invocation.targeting.dispositionKind === 'WILLING' &&
        (grantPlan !== null || conditionPlan !== null || checkAction)))
  // A resolved list of chosen creatures, capped (Mass Healing Word) or naming each creature once
  // (Pass without Trace), inside a round area when it names one (Mass Cure Wounds), resolves the one
  // outcome on each (Magic Missile's darts, Pass without Trace's one active effect per creature);
  // an outcome that lands on the actor instead is refused once it is read.
  const supportsChosenCreatures =
    supportsTargetRange &&
    invocation.targeting?.selectionKind === 'CHOSEN_CREATURES' &&
    // A bond (Telepathic Bond) asks for willing creatures: an unwilling one only warns.
    (invocation.targeting.dispositionKind === 'ANY' ||
      (invocation.targeting.dispositionKind === 'WILLING' &&
        (grantPlan !== null || linkPlan !== null || formPlan !== null))) &&
    chosenCreaturesCap(resolveChosenCreaturesTargeting(invocation.targeting, action)) !== null &&
    (!invocation.shape ||
      chosenCreaturesAreaSupported(invocation.range.rangeKind, invocation.shape.shapeKind))
  // A hit-point pool area (Sleep) rolls one pool for the cast and puts the creatures it reaches under
  // the one outcome, a timed condition, with no test.
  const supportsHitPointPoolArea =
    invocation.targeting?.selectionKind === 'AREA_CONTENTS' &&
    hitPointPoolIsAuthored(invocation.targeting) &&
    isSupportedArea(invocation)
  // A free action on its user alone (Frenzy) needs no charge: its use path's holder restrictions
  // bound it.
  const supportedActivation =
    invocation.kind === 'ACTION' &&
    (invocation.activation.code === 'FREE'
      ? isChargedFreeActivation(invocation) || supportsSelf
      : (invocation.activation.code === 'ACTION' ||
          invocation.activation.code === 'BONUS_ACTION' ||
          // A reaction to being attacked, to taking damage, to being chosen as a target or to a spell
          // being cast; the triggering event's pending decision offers it (never a direct action).
          (invocation.activation.code === 'REACTION' &&
            'reactionTrigger' in invocation &&
            (invocation.reactionTrigger?.kind === 'ATTACKED_SELF' ||
              invocation.reactionTrigger?.kind === 'DAMAGE_TAKEN' ||
              invocation.reactionTrigger?.kind === 'TARGETED_SELF' ||
              invocation.reactionTrigger?.kind === 'SPELL_CAST'))) &&
        invocation.activation.amount === 1)
  if (
    invocation.kind !== 'ACTION' ||
    (invocation.triggerCode !== 'ACTIVATED' && invocation.triggerCode !== 'CHECK') ||
    !supportedActivation ||
    (!supportsSelf &&
      !selfTeleport &&
      !supportsSingleTarget &&
      !supportsChosenCreatures &&
      !supportsHitPointPoolArea) ||
    (invocation.shape && !supportsChosenCreatures && !supportsHitPointPoolArea)
  )
    unsupported('D&D Effect action is not the supported activated self action shape.')
  const entry = effect.entries[0]
  // The condition and the save it repeats (Power Word Stun) are one cast: the lead entry applies now.
  const repeatPlan = repeatingDirectFollowUpSavePlan(action, 'ACTIVATED')
  const lastingPlan =
    repeatPlan ||
    supportedRecurringPlan(action) ||
    grantPlan ||
    conditionPlan ||
    linkPlan ||
    formPlan
  if (
    effect.entries.length !== (repeatPlan ? 2 : 1) ||
    !entry ||
    entry.resolutionKind !== 'DIRECT' ||
    // A sequence of one outcome (Haste) resolves as a single result does.
    (entry.groupKind === 'CHOICE' && !repeatPlan) ||
    entry.pathCode !== (checkAction ? 'ON_CHECK_SUCCESS' : 'ON_USE') ||
    (entry.maintenanceDefinitionId && !lastingPlan) ||
    (hasLifecycleOverride(entry) && !lastingPlan && !concealmentPlan(action)) ||
    entry.rangeOverride ||
    entry.targetingOverride
  )
    unsupported('D&D Effect action must have one fixed direct result without lifecycle overrides.')
  if (
    invocation.resourceUse &&
    (invocation.resourceUse.chargeId !== invocation.resourceUse.chargeId.trim() ||
      invocation.resourceUse.chargeId.length === 0 ||
      !Number.isSafeInteger(invocation.resourceUse.cost) ||
      invocation.resourceUse.cost <= 0)
  )
    unsupported(
      'D&D Effect action resource use must use a normalized charge identity and positive safe cost.'
    )
  const outcome = entry.outcome
  if (supportsHitPointPoolArea && outcome.effectKind !== 'CONDITION')
    unsupported('D&D hit-point pool area outcome must be a timed condition.')
  if (
    !checkAction &&
    (outcome.effectKind === 'CONCEAL_FROM_OBSERVERS' || outcome.effectKind === 'DETECT_CONCEALED')
  )
    unsupported('D&D conceal and detect outcomes belong to a check action.')
  if (
    outcome.effectKind === 'CANCEL_TRIGGERING_EVENT' &&
    !('reactionTrigger' in invocation && invocation.reactionTrigger?.kind === 'SPELL_CAST')
  )
    unsupported(DND5E_CANCEL_NEEDS_SPELL_CAST_REACTION)
  // A concealment check is decided against scores the roller never sees: a passive DC only conceals
  // and a concealment DC only detects, and neither pairs with any other outcome.
  if (
    invocation.triggerCode === 'CHECK' &&
    (invocation.check.dc.kind === 'PASSIVE') !== (outcome.effectKind === 'CONCEAL_FROM_OBSERVERS')
  )
    unsupported('D&D check action passive DC and conceal outcome must be authored together.')
  if (
    invocation.triggerCode === 'CHECK' &&
    (invocation.check.dc.kind === 'CONCEALMENT') !== (outcome.effectKind === 'DETECT_CONCEALED')
  )
    unsupported('D&D check action concealment DC and detect outcome must be authored together.')
  // A resolution names no check choice, so the action must list exactly one.
  if (
    invocation.triggerCode === 'CHECK' &&
    invocation.check.checks.skillIds.length +
      invocation.check.checks.abilityDefinitionIds.length !==
      1
  )
    unsupported('D&D check action must list exactly one check.')
  if (contestAction) {
    if (
      invocation.check.dc.kind !== 'CONTEST' ||
      invocation.check.dc.checks.skillIds.length +
        invocation.check.dc.checks.abilityDefinitionIds.length ===
        0
    )
      unsupported('D&D contest check action must list the checks its target may roll.')
    if (outcome.effectKind === 'ACTOR_RELATIONSHIP') {
      relationshipPlan(action)
      return { kind: 'CONTEST_RELATIONSHIP' }
    }
  }
  // Conceal and detect settle on a fixed-DC or passive check itself; a contest's win, and any other
  // success outcome, runs after the check test (D173).
  const settlesOnCheck =
    outcome.effectKind === 'CONCEAL_FROM_OBSERVERS' || outcome.effectKind === 'DETECT_CONCEALED'
  if (contestAction || (checkAction && !settlesOnCheck)) {
    const won = specializedTestOutcome(entry)
    if (
      won.kind === 'CONDITION_APPLY' &&
      !(action.conditionDefinitionIds ?? []).includes(won.conditionId)
    )
      unsupported('D&D check action condition is not in the pinned System vocabulary.')
    return { kind: 'CHECK_OUTCOME' }
  }
  return specializedDirectOutcome(outcome.effectKind, outcome, {
    action,
    onList: supportsChosenCreatures,
    selfTeleport,
    plans: {
      grant: grantPlan !== null,
      link: linkPlan !== null,
      form: formPlan !== null,
      absence: conditionPlan?.playAbsenceContribution != null || conditionPlan?.turnEndGate != null
    }
  })
}

function supportedTestPhaseKind(action: Dnd5eCompiledEffectActionSource): TestKind {
  const invocation = action.compiledEffect.invocation
  const kind = testPhaseKindOrNull(action)
  if (!kind) unsupported('D&D action has no supported test phase.')
  const allowedPaths =
    kind === 'ATTACK' ? ['ON_HIT', 'ON_MISS', 'ON_CRIT'] : ['ON_SAVE_FAIL', 'ON_SAVE_SUCCESS']
  if (
    invocation.kind !== 'ACTION' ||
    !isSupportedTestActivation(invocation) ||
    !isSupportedTestTargetPolicy(action) ||
    action.compiledEffect.entries.length < 1
  ) {
    unsupported('D&D test action has an unsupported bounded shape.')
  }
  if (isExactImmediateFollowUpSaveAction(action)) {
    // A band the registry cannot compose is refused here, before the hit is ever rolled.
    immediateFollowUpSaveGraphDefinition(action)
    return 'ATTACK'
  }
  if (repeatingDirectFollowUpSavePlan(action)) return 'SAVE'
  const relationshipEntries = action.compiledEffect.entries.filter(
    (entry) => 'outcome' in entry && entry.outcome.effectKind === 'ACTOR_RELATIONSHIP'
  )
  if (relationshipEntries.length > 1)
    unsupported('D&D action has more than one relationship outcome.')
  if (
    action.compiledEffect.entries.some(
      (entry) => 'outcome' in entry && entry.outcome.effectKind === 'FOLLOW_UP_SAVE'
    )
  ) {
    unsupported('D&D test action has an unsupported bounded shape.')
  }
  const paths = new Set<string>()
  const tablePaths = admitRollTablePaths(
    action,
    kind === 'SAVE' ? allowedPaths : [],
    timedActiveEffectPlan
  )
  const conditionCounts = new Map<string, number>()
  for (const entry of action.compiledEffect.entries) {
    if (tablePaths.has(entry.pathCode)) continue
    if (isActiveEffectPlanOutcome(entry, action)) continue
    // A SEQUENCE result block applies each of its outcomes in order; OUTCOME
    // specializes every outcome as its own group, exactly like separate paths.
    if (
      entry.resolutionKind !== 'DIRECT' ||
      (entry.groupKind !== 'SINGLE' && entry.groupKind !== 'SEQUENTIAL') ||
      (!ownsTimedSaveCondition(action, entry) &&
        (entry.duration || entry.lifecycle || entry.maintenanceDefinitionId)) ||
      entry.rangeOverride ||
      entry.targetingOverride ||
      !allowedPaths.includes(entry.pathCode) ||
      !('outcome' in entry)
    ) {
      unsupported('D&D test action paths must be unique direct outcomes.')
    }
    paths.add(entry.pathCode)
    const outcome = specializedTestOutcome(entry)
    if (outcome.kind === 'CONDITION_APPLY') {
      if (!(action.conditionDefinitionIds ?? []).includes(outcome.conditionId))
        unsupported('D&D test action condition is not in the pinned System vocabulary.')
      // Each of a result path's conditions binds its own condition-immunity fact.
      // Only one hit-point tier applies to a target, so a tier counts its own conditions.
      const countKey = `${entry.pathCode}:${'hitPointTier' in entry ? entry.hitPointTier?.atMost : ''}`
      const count = (conditionCounts.get(countKey) ?? 0) + 1
      if (count > MAX_CONDITIONS_PER_PATH)
        unsupported(
          'D&D test action outcome is not supported: one path applies too many conditions.'
        )
      conditionCounts.set(countKey, count)
    }
    // An outcome sized by damage (a reduction, a derived heal) takes it from a damage outcome (one row per scaling level) of its own result path.
    const sourceDamageOutcomeId = damageSourceOutcomeId(outcome)
    if (
      sourceDamageOutcomeId !== undefined &&
      action.compiledEffect.entries.filter(
        (candidate) =>
          candidate.pathCode === entry.pathCode &&
          candidate.entryId === sourceDamageOutcomeId &&
          'outcome' in candidate &&
          candidate.outcome.effectKind === 'DAMAGE'
      ).length === 0
    )
      unsupported('D&D outcome sized by damage needs a damage outcome on its path.')
  }
  for (const pathCode of paths) {
    for (const entries of authoredOutcomeGroups(action, pathCode as SpecializedPath))
      validateDiceOutcomeGroup(entries)
  }
  return kind
}

/**
 * A v3 occurrence may split only when every authored result that can apply is
 * representable by the bounded OUTCOME compiler. A miss/success path with no
 * entry is valid and terminal after TEST; a fixed heal/condition is not.
 */

/**
 * Compile only the first, d20 test phase.  Outcome graphs are intentionally
 * absent: after this phase resolves, the occurrence specializes exactly the
 * selected authored path and therefore never asks for unselected damage dice.
 */
function compileDnd5eEffectActionTestTemplate({
  action
}: {
  action: Dnd5eCompiledEffectActionSource
}): Dnd5eEffectActionTemplate {
  if (action.gameSystemId !== DND5E_SYSTEM_ID) {
    throw new Dnd5eEffectActionCompilerError(
      'D&D compiler received an action from another Game System.'
    )
  }
  uuid(action.effectId, 'D&D Effect action identity')
  if (
    action.entryPointDefinitionId !== action.effectId ||
    action.compiledEffect.id !== action.effectId
  ) {
    throw new Dnd5eEffectActionCompilerError(
      'D&D Effect action entry point does not match its exact Effect.'
    )
  }
  if (isCheckOutcomeAction(action)) {
    const { invocation } = action.compiledEffect
    const contest = invocation.triggerCode === 'CHECK' && invocation.check.dc.kind === 'CONTEST'
    const graph = contest ? createDnd5eContestGraph : createDnd5eCheckDefinition
    const published = graph(action.effectId)
    return { phase: 'TEST', published, templateChecksum: published.checksum }
  }
  const kind = supportedTestPhaseKind(action)
  const modifierFact =
    kind === 'ATTACK' ? DND5E_ATTACK_MODIFIER_FACT_KEY : DND5E_SAVE_MODIFIER_FACT_KEY
  const thresholdFact = kind === 'ATTACK' ? DND5E_TARGET_DEFENSE_FACT_KEY : DND5E_SAVE_DC_FACT_KEY
  const testOperation =
    kind === 'ATTACK' ? DND5E_ATTACK_TEST_OPERATION_KEY : DND5E_SAVE_TEST_OPERATION_KEY
  const definition: RuleGraphDefinition = {
    schemaVersion: 1,
    id: action.effectId,
    gameSystemId: DND5E_SYSTEM_ID,
    definitionFamilyKey: DND5E_EFFECT_ACTION_FAMILY_KEY,
    nodes: [
      {
        id: 'd20',
        operation: { key: 'evidence.integer-range', contractVersion: 1 },
        inputs: {
          min: { kind: 'LITERAL', value: 1 },
          max: { kind: 'LITERAL', value: 20 }
        }
      },
      dnd5eAddedDiceNode('d20'),
      {
        id: 'test',
        operation: { key: testOperation, contractVersion: testContractVersion(kind) },
        inputs: {
          targetActorId: { kind: 'FACT', factKey: DND5E_TARGET_ACTOR_FACT_KEY },
          naturalD20: { kind: 'NODE_OUTPUT', nodeId: 'd20', port: 'value' },
          addedTotal: { kind: 'NODE_OUTPUT', nodeId: 'd20-added-dice', port: 'value' },
          modifier: { kind: 'FACT', factKey: modifierFact },
          threshold: { kind: 'FACT', factKey: thresholdFact },
          ...(kind === 'ATTACK'
            ? {
                criticalThreshold: {
                  kind: 'FACT' as const,
                  factKey: DND5E_ATTACK_CRITICAL_THRESHOLD_FACT_KEY
                }
              }
            : {}),
          contributorChecksum: {
            kind: 'FACT',
            factKey: DND5E_ROLL_CONTRIBUTOR_CHECKSUM_FACT_KEY
          },
          outcomeRule: { kind: 'FACT', factKey: DND5E_TEST_OUTCOME_RULE_FACT_KEY }
        }
      }
    ],
    outputs: {
      targetActorId: {
        kind: 'NODE_OUTPUT',
        nodeId: 'test',
        port: 'targetActorId'
      },
      naturalD20: { kind: 'NODE_OUTPUT', nodeId: 'test', port: 'naturalD20' },
      total: { kind: 'NODE_OUTPUT', nodeId: 'test', port: 'total' },
      resultPath: { kind: 'NODE_OUTPUT', nodeId: 'test', port: 'resultPath' },
      contributorChecksum: {
        kind: 'NODE_OUTPUT',
        nodeId: 'test',
        port: 'contributorChecksum'
      }
    }
  }
  const base = publishedGraph(definition)
  const published = bindMovementInterruptionTestOutput({ action, published: base, kind })
  return { phase: 'TEST', published, templateChecksum: published.checksum }
}

function compiledOutcomeIdentity(entry: CompiledEffectGroup['entries'][number]): string {
  if (typeof entry.entryId !== 'string' || entry.entryId.length === 0)
    unsupported('D&D outcome identity is unavailable.')
  return entry.entryId
}

function compiledDiceConfiguration(entry: CompiledEffectGroup['entries'][number]): string {
  if (
    !('outcome' in entry) ||
    !('diceConfig' in entry.outcome) ||
    typeof entry.outcome.diceConfig !== 'string'
  )
    unsupported('D&D dice configuration is unavailable.')
  return entry.outcome.diceConfig
}

function exactDiceConfiguration(
  outcomes: readonly Partial<
    Record<
      | 'effectKind'
      | 'valueKind'
      | 'scalingKind'
      | 'scalingSource'
      | 'classId'
      | 'dice'
      | 'halfHitPointsDice'
      | 'bonuses'
      | 'level'
      | 'order',
      unknown
    >
  >[],
  facts: Dnd5eEffectScalingFacts,
  selectedPath: SpecializedPath,
  outcomeId: string,
  optionalRider: boolean
): string {
  const outcome = outcomes[0]
  if (!outcome) unsupported('D&D selected outcome has no authored dice value.')
  if (outcome.valueKind !== 'DICE') unsupported('D&D outcome is not a supported dice value.')
  let authored: string
  if (outcome.scalingKind === 'NONE' && typeof outcome.dice === 'string') {
    authored = outcome.dice
  } else {
    const selected = selectScalingRow(
      outcomes.filter((candidate) => typeof candidate.dice === 'string'),
      scalingLevel(outcome, facts)
    )
    if (!selected || typeof selected.dice !== 'string')
      unsupported('D&D dice scaling does not select an authored value.')
    authored = selected.dice
  }
  // Half-hit-point dice are selected from the source's locked hit points when facts are bound.
  const halfHitPointsDice =
    outcome.scalingKind === 'NONE' && typeof outcome.halfHitPointsDice === 'string'
      ? outcome.halfHitPointsDice
      : null
  // The path's one resolved expression is the weapon's own; an optional rider is not part of the action's
  // listed outcomes, so it rolls its authored dice rather than the weapon's.
  const resolved =
    facts.resolvedDamageOutcomeExpressions[outcomeId] ??
    (optionalRider ? undefined : facts.resolvedDamageExpressions[selectedPath])
  if (!resolved) {
    if ((Array.isArray(outcome.bonuses) && outcome.bonuses.length > 0) || halfHitPointsDice)
      unsupported('D&D resolved damage expression is unavailable.')
    return authored
  }
  const resolvedTerm = parseBoundedDiceConfiguration(resolved).term
  const matchesAuthoredDice = (dice: string) => {
    const authoredTerm = parseBoundedDiceConfiguration(dice).term
    return authoredTerm.count === resolvedTerm.count && authoredTerm.die === resolvedTerm.die
  }
  // A weapon die a grant set (Shillelagh's d8) replaces the authored die of the weapon's own damage.
  const weaponDie = optionalRider ? undefined : facts.weaponDamageDieFaces
  if (
    !matchesAuthoredDice(authored) &&
    !(halfHitPointsDice && matchesAuthoredDice(halfHitPointsDice)) &&
    !(weaponDie && matchesAuthoredDice(authored.replace(/^(\d+)d\d+/, `$1d${weaponDie}`)))
  )
    unsupported('D&D resolved damage expression does not match the authored dice.')
  return resolved
}

/** A critical hit's dice change for an entry: doubled, plus the attack's extra dice (D158). */
function criticalHitDice(
  selectedPath: SpecializedPath,
  entry: CompiledEffectGroup['entries'][number],
  facts: Dnd5eEffectScalingFacts
): { extraDice: number } | undefined {
  return isCriticalHitDamage(selectedPath, entry)
    ? { extraDice: facts.criticalExtraDice ?? 0 }
    : undefined
}

function fixedOutcomeGraphDefinition(input: {
  action: Dnd5eCompiledEffectActionSource
  entry: CompiledEffectGroup['entries'][number]
  outcome: Outcome
  nodePrefix?: string
  /** The condition's place among its path's conditions, which selects its immunity fact. */
  conditionOrdinal?: number
  /** The hit-point band that gates the outcome: a hit-point tier's. */
  hitPointBand?: { above: number; atMost: number }
  /** The damage proposal node the outcome follows: it applies only if that damage reduced the target to 0. */
  reducedToZeroByNodeId?: string
}): RuleGraphDefinition {
  const proposalId = `${input.nodePrefix ?? ''}proposal-${input.entry.pathCode.toLowerCase()}`
  const gates = testPathGates(input.entry, input.outcome.kind, input)
  // The OUTCOME phase runs only on its selected path, so the push is authorized by construction.
  if (input.outcome.kind === 'FORCED_MOVEMENT') {
    uuid(input.entry.entryId, 'D&D forced movement identity')
    return {
      schemaVersion: 1,
      id: input.action.effectId,
      gameSystemId: DND5E_SYSTEM_ID,
      definitionFamilyKey: DND5E_EFFECT_ACTION_FAMILY_KEY,
      nodes: [
        forcedMovementProposalNode({
          id: proposalId,
          sourceEntryId: input.entry.entryId,
          resultPath: { kind: 'LITERAL', value: input.entry.pathCode },
          authoredPath: input.entry.pathCode,
          outcome: input.outcome
        })
      ],
      outputs: {
        targetActorId: { kind: 'NODE_OUTPUT', nodeId: proposalId, port: 'targetActorId' }
      },
      sourceEntryBindings: [{ sourceEntryId: input.entry.entryId, nodeId: proposalId }]
    }
  }
  const definition = dnd5eOutcomeDefinition(input.outcome.kind)
  return {
    schemaVersion: 1,
    id: input.action.effectId,
    gameSystemId: DND5E_SYSTEM_ID,
    definitionFamilyKey: DND5E_EFFECT_ACTION_FAMILY_KEY,
    nodes: [
      effectOutcomeProposalNode({
        id: proposalId,
        definition,
        outcome: input.outcome,
        context: {
          conditionImmuneFactKey: conditionImmuneFactKey(
            input.entry.pathCode,
            input.conditionOrdinal ?? 1
          )
        },
        target: DND5E_OUTCOME_TARGET,
        phase: { kind: 'DIRECT', contractVersion: isGated(gates) ? 2 : 1 },
        extraInputs: isGated(gates) ? gateNodeInputs(gates) : {}
      })
    ],
    outputs: effectOutcomeProposalOutputs(definition, proposalId),
    ...(UUID.test(input.entry.entryId)
      ? {
          sourceEntryBindings: [{ sourceEntryId: input.entry.entryId, nodeId: proposalId }]
        }
      : {})
  }
}

/**
 * The node of the damage proposal a `REDUCED_TO_ZERO_BY` outcome follows. That damage outcome is
 * owed earlier in the same path, so its proposal is committed (and applied) before this one.
 */
function reducedToZeroDamageNodeId(
  groups: readonly (readonly CompiledEffectGroup['entries'][number][])[],
  groupIndex: number,
  damageOutcomeId: string,
  outcome: SpecializedOutcome
): string {
  const damageIndex = groups.findIndex(([candidate]) => candidate?.entryId === damageOutcomeId)
  const damageEntry = groups[damageIndex]?.[0]
  if (!damageEntry || damageIndex > groupIndex || !('outcome' in damageEntry))
    unsupported('D&D reduced-to-0 gate needs its damage outcome owed earlier in the path.')
  const damageKind = specializedTestOutcome(damageEntry).kind
  if (damageKind !== 'DAMAGE' && damageKind !== 'DICE_DAMAGE' && damageKind !== 'RESOLVED_DAMAGE')
    unsupported('D&D reduced-to-0 gate must name a damage outcome.')
  if (outcome.kind !== 'KILL' && outcome.kind !== 'CONDITION_APPLY' && outcome.kind !== 'HEAL')
    unsupported('D&D reduced-to-0 gate belongs to a kill, condition or heal outcome.')
  return `outcome${damageIndex + 1}-proposal-${damageEntry.pathCode.toLowerCase()}`
}

function authoredOutcomeGroups(
  action: Dnd5eCompiledEffectActionSource,
  pathCode: SpecializedPath
): readonly (readonly CompiledEffectGroup['entries'][number][])[] {
  const entries = action.compiledEffect.entries.filter(
    (entry) => entry.pathCode === pathCode && !isActiveEffectPlanOutcome(entry, action)
  )
  if (entries.length === 0) return []
  if (entries.some((entry) => !('outcome' in entry)))
    unsupported('D&D selected outcome path must retain exact authored outcomes.')
  const groups = new Map<string, CompiledEffectGroup['entries'][number][]>()
  for (const entry of entries) {
    if (!('resultBlockId' in entry) || typeof entry.resultBlockId !== 'string')
      unsupported('D&D selected outcome path must retain an exact authored result block.')
    if (typeof entry.entryId !== 'string' || entry.entryId.length === 0)
      unsupported('D&D selected outcome path must retain an exact authored outcome identity.')
    const groupKey = `${entry.resultBlockId}\u0000${entry.entryId}`
    const group = groups.get(groupKey)
    if (group) group.push(entry)
    else groups.set(groupKey, [entry])
  }
  return [...groups.values()]
}

function selectedOutcomeGroups(
  action: Dnd5eCompiledEffectActionSource,
  selectedPath: SpecializedPath
): readonly (readonly CompiledEffectGroup['entries'][number][])[] {
  if (selectedPath !== 'ON_CRIT') return authoredOutcomeGroups(action, selectedPath)
  // A critical hit includes the ordinary hit result, then the authored
  // critical result, within one selected OUTCOME phase.
  return [...authoredOutcomeGroups(action, 'ON_HIT'), ...authoredOutcomeGroups(action, 'ON_CRIT')]
}

function assertKnownTestResultPath(
  action: Dnd5eCompiledEffectActionSource,
  selectedPath: SpecializedPath
): void {
  const kind = testPhaseKindOrNull(action)
  const allowedPaths =
    kind === 'ATTACK'
      ? ['ON_HIT', 'ON_MISS', 'ON_CRIT']
      : kind === 'SAVE'
        ? ['ON_SAVE_FAIL', 'ON_SAVE_SUCCESS']
        : isCheckOutcomeAction(action)
          ? ['ON_CHECK_SUCCESS']
          : []
  if (!allowedPaths.includes(selectedPath))
    throw new Dnd5eEffectActionCompilerError('D&D selected outcome path is not emitted by TEST.')
}

function mergedOutcomeGraphDefinition(input: {
  action: Dnd5eCompiledEffectActionSource
  definitions: readonly RuleGraphDefinition[]
}): RuleGraphDefinition {
  if (input.definitions.length === 0) {
    throw new Dnd5eEffectActionCompilerError(
      'D&D outcome specialization selected no authored result.'
    )
  }
  if (input.definitions.length === 1) return input.definitions[0]!
  const sourceEntryBindings = input.definitions.flatMap(
    (definition) => definition.sourceEntryBindings ?? []
  )
  return {
    schemaVersion: 1,
    id: input.action.effectId,
    gameSystemId: DND5E_SYSTEM_ID,
    definitionFamilyKey: DND5E_EFFECT_ACTION_FAMILY_KEY,
    nodes: input.definitions.flatMap((definition) => definition.nodes),
    outputs: Object.fromEntries(
      input.definitions.flatMap((definition, groupIndex) =>
        Object.entries(definition.outputs).map(([name, reference]) => [
          `outcome${groupIndex + 1}_${name}`,
          reference
        ])
      )
    ),
    ...(sourceEntryBindings.length > 0 ? { sourceEntryBindings } : {})
  }
}

/**
 * The conditions a failed direct save also applies because it failed by the rider's margin ("fails
 * by 5 or more, also paralyzed"): each one follows the failure's own outcomes as a result group of
 * its own, so the OUTCOME holds them only when the completed save earned them.
 */
function failureMarginRiderGroups(
  lead: CompiledEffectGroup['entries'][number] | undefined,
  input: { selectedPath: SpecializedPath; facts: Dnd5eEffectScalingFacts }
): readonly (readonly CompiledEffectGroup['entries'][number][])[] {
  const rider = lead && 'failureMarginRider' in lead ? lead.failureMarginRider : undefined
  if (!lead || !rider || input.selectedPath !== 'ON_SAVE_FAIL') return []
  if (input.facts.saveFailedBy === undefined)
    unsupported('D&D failure margin riders need the completed saving throw’s total.')
  if (input.facts.saveFailedBy < rider.failedBy) return []
  return rider.outcomes.flatMap((authored) =>
    compileConditionEffect(authored).map((outcome) => [
      {
        ...lead,
        entryId: outcome.id,
        outcome,
        duration: undefined,
        lifecycle: undefined,
        failureMarginRider: undefined
      }
    ])
  )
}

function specializeDnd5eEffectActionOutcomeBody(input: {
  action: Dnd5eCompiledEffectActionSource
  selectedPath: SpecializedPath
  facts: Dnd5eEffectScalingFacts
}): Dnd5eEffectActionTemplate | null {
  if (!isCheckOutcomeAction(input.action)) supportedTestPhaseKind(input.action)
  assertKnownTestResultPath(input.action, input.selectedPath)
  const table = rollTableOutcomeTemplate(input.action, input.selectedPath)
  if (table) return table
  if (
    (input.selectedPath === 'ON_HIT' || input.selectedPath === 'ON_CRIT') &&
    isExactImmediateFollowUpSaveAction(input.action)
  ) {
    const immediate = immediateFollowUpSaveEntries(input.action.compiledEffect.entries)
    if (!immediate) unsupported('D&D immediate follow-up save primary damage is unavailable.')
    const owed = (entry: CompiledEffectGroup['entries'][number]) =>
      entryOwed(entry, input.action.compiledEffect.id, input.facts)
    // A rider merged into the hit (D164 Charge) deals its damage and calls its save only when owed.
    const owedPrimaryEntries = immediate.primaryEntries.filter(owed)
    const saveOwed = owed(immediate.saveEntry)
    if (owedPrimaryEntries.length === 0 && !saveOwed) return null
    const primaryDefinitions = owedPrimaryEntries.map((primaryDamageEntry, index) => {
      const primaryDamage = specializedTestOutcome(primaryDamageEntry, input.facts)
      const nodePrefix =
        owedPrimaryEntries.length > 1 ? { nodePrefix: `primary-${index + 1}-` } : {}
      // A fixed amount ("1 piercing damage") has no dice to double on a critical hit, and a GM
      // ruling beside the damage (a lycanthrope's curse) proposes its instructions without any.
      if (primaryDamage.kind === 'DAMAGE' || primaryDamage.kind === 'MANUAL_ADJUDICATION')
        return fixedOutcomeGraphDefinition({
          action: input.action,
          entry: primaryDamageEntry,
          outcome: primaryDamage,
          ...nodePrefix
        })
      if (primaryDamage.kind !== 'DICE_DAMAGE')
        unsupported('D&D immediate follow-up save requires damage before the save.')
      const primaryDiceConfiguration = exactDiceConfiguration(
        [primaryDamageEntry.outcome],
        input.facts,
        input.selectedPath,
        compiledOutcomeIdentity(primaryDamageEntry),
        false
      )
      return diceGraphDefinition({
        action: input.action,
        entry: primaryDamageEntry,
        diceConfig: primaryDiceConfiguration,
        critical: criticalHitDice(input.selectedPath, primaryDamageEntry, input.facts),
        ...nodePrefix
      })
    })
    const definition = mergedOutcomeGraphDefinition({
      action: input.action,
      definitions: [
        ...primaryDefinitions,
        ...(saveOwed ? [immediateFollowUpSaveGraphDefinition(input.action)] : [])
      ]
    })
    const published = publishedGraph(definition)
    return {
      phase: 'OUTCOME',
      published,
      templateChecksum: checksumRuleDocument(input.action.compiledEffect.entries)
    }
  }
  if (
    input.selectedPath === 'ON_SAVE_FAIL' &&
    repeatingDirectFollowUpSavePlan(input.action) !== null
  ) {
    const entries = repeatingDirectFollowUpSaveLeadEntries(input.action)
    if (!entries?.length) unsupported('D&D direct repeated save outcome is unavailable.')
    const definitions = entries.map((entry, index) => {
      // The grant is held by the repeat-save effect; the occurrence only proposes it.
      const outcome: SpecializedOutcome =
        'outcome' in entry && entry.outcome.effectKind === 'APPLY_GRANT'
          ? { kind: 'MODIFIER_GRANT' }
          : specializedTestOutcome(entry, input.facts)
      if (outcome.kind !== 'CONDITION_APPLY' && outcome.kind !== 'MODIFIER_GRANT')
        unsupported('D&D direct repeated save outcome is unavailable.')
      return fixedOutcomeGraphDefinition({
        action: input.action,
        entry,
        outcome,
        // Each condition binds its own immunity fact, as the conditions of any other result path.
        ...(entries.length > 1
          ? { nodePrefix: `outcome${index + 1}-`, conditionOrdinal: index + 1 }
          : {})
      })
    })
    const definition = mergedOutcomeGraphDefinition({ action: input.action, definitions })
    const published = publishedGraph(definition)
    return {
      phase: 'OUTCOME',
      published,
      templateChecksum: checksumRuleDocument(entries)
    }
  }
  const authoredGroups = selectedOutcomeGroups(input.action, input.selectedPath)
  // A tiered result owes only the tier whose band holds the target's hit points, if any does.
  const tierCeilings = hitPointTierCeilings(authoredGroups.flat())
  if (tierCeilings.length > 0 && input.facts.targetCurrentHitPoints === undefined)
    unsupported('D&D hit-point tiers need the current hit points of the target.')
  const selectedTier =
    tierCeilings.length > 0
      ? selectHitPointTier(tierCeilings, input.facts.targetCurrentHitPoints ?? 0)
      : null
  const ownedGroups = authoredGroups.filter((entries) =>
    entries.every(
      (entry) =>
        entryOwed(entry, input.action.compiledEffect.id, input.facts) &&
        (!('hitPointTier' in entry) ||
          !entry.hitPointTier ||
          entry.hitPointTier.atMost === selectedTier)
    )
  )
  if (ownedGroups.length === 0) return null
  const groups = [...ownedGroups, ...failureMarginRiderGroups(ownedGroups[0]?.[0], input)]
  const definitions = groups.map((entries, groupIndex): RuleGraphDefinition => {
    const entry = entries[0]
    if (!entry) unsupported('D&D selected outcome path is unavailable.')
    const outcome = specializedTestOutcome(entry, input.facts)
    // An outcome that binds no gate (dice, a hit-point maximum reduction) refuses one rather than skip it.
    testPathGates(entry, outcome.kind)
    const groupNodePrefix = groups.length > 1 ? { nodePrefix: `outcome${groupIndex + 1}-` } : {}
    const gate = 'gate' in entry ? entry.gate : undefined
    // The gate's damage outcome is exempt from it; every other outcome of the block follows that damage.
    const reducedToZeroByNodeId =
      gate?.kind === 'REDUCED_TO_ZERO_BY' && gate.damageOutcomeId !== entry.entryId
        ? reducedToZeroDamageNodeId(groups, groupIndex, gate.damageOutcomeId, outcome)
        : undefined
    if (outcome.kind === 'HIT_POINT_MAXIMUM_REDUCTION' || outcome.kind === 'DAMAGE_DERIVED_HEAL')
      return damageSizedOutcomeGraph({
        effectId: input.action.effectId,
        outcome,
        entry,
        groups,
        nodePrefix: groupNodePrefix.nodePrefix ?? '',
        selectedPath: input.selectedPath
      })
    return outcome.kind === 'DICE_DAMAGE' ||
      outcome.kind === 'DICE_HEAL' ||
      outcome.kind === 'DICE_SCALAR_REDUCTION'
      ? diceGraphDefinition({
          action: input.action,
          entry,
          diceConfig:
            outcome.kind === 'DICE_DAMAGE'
              ? exactDiceConfiguration(
                  entries.map(
                    (candidate) =>
                      (candidate as Extract<typeof candidate, { outcome: unknown }>).outcome
                  ),
                  input.facts,
                  input.selectedPath,
                  compiledOutcomeIdentity(entry),
                  'optionalRider' in entry && entry.optionalRider !== undefined
                )
              : outcome.kind === 'DICE_SCALAR_REDUCTION'
                ? outcome.diceConfig
                : compiledDiceConfiguration(entry),
          critical: criticalHitDice(input.selectedPath, entry, input.facts),
          ...(outcome.kind === 'DICE_HEAL'
            ? { modifierFactKey: DND5E_RESOLVED_HEAL_MODIFIER_FACT_KEY }
            : {}),
          ...groupNodePrefix
        })
      : entries.length === 1
        ? fixedOutcomeGraphDefinition({
            action: input.action,
            entry,
            outcome,
            ...groupNodePrefix,
            ...('hitPointTier' in entry && entry.hitPointTier
              ? {
                  hitPointBand: {
                    above: hitPointTierFloor(tierCeilings, entry.hitPointTier.atMost),
                    atMost: entry.hitPointTier.atMost
                  }
                }
              : {}),
            ...(reducedToZeroByNodeId ? { reducedToZeroByNodeId } : {}),
            conditionOrdinal: groups
              .slice(0, groupIndex + 1)
              .filter(
                ([candidate]) =>
                  candidate?.pathCode === entry.pathCode &&
                  'outcome' in candidate &&
                  candidate.outcome.effectKind === 'CONDITION'
              ).length
          })
        : unsupported('D&D fixed outcome path must compile to one direct result.')
  })
  const definition = withSaveDamageMultiplier({
    action: input.action,
    selectedPath: input.selectedPath,
    definition: mergedOutcomeGraphDefinition({
      action: input.action,
      definitions: withDamageAddedDice({
        action: input.action,
        selectedPath: input.selectedPath,
        groups,
        definitions,
        dice: input.facts.damageAddedDice ?? [],
        incomingReductions: input.facts.incomingDamageReductions ?? []
      })
    })
  })
  const published = publishedGraph(definition)
  return {
    phase: 'OUTCOME',
    published,
    // The selected authored result groups, chosen optional riders included or not and restricted or
    // not, are the immutable OUTCOME template; the published checksum above identifies the groups
    // owed to this attack and their locked dice and rider specialization.
    templateChecksum: checksumRuleDocument(authoredGroups)
  }
}

/** Whether the active-effect plan the action ends up with is held under a maintained effect. */
function startsMaintainedEffect(action: Dnd5eCompiledEffectActionSource): boolean {
  const results = directResultSequence(action, holdsLastingEffect)
  if (results) return results.some(startsMaintainedEffect)
  const plan =
    sequentialCompositionPlan(action) ??
    repeatingFollowUpSavePlan(action) ??
    timedActiveEffectPlan(action) ??
    relationshipPlan(action) ??
    supportedRecurringPlan(action)
  return plan?.maintenance != null
}

/** The effect a follow-up save repeats in, wherever the save sits: a failed save, a cast or a hit. */
function repeatingFollowUpSavePlan(action: Dnd5eCompiledEffectActionSource) {
  return (
    repeatingDirectFollowUpSavePlan(action) ??
    repeatingDirectFollowUpSavePlan(action, 'ACTIVATED') ??
    repeatingImmediateFollowUpSavePlan(action)
  )
}

/** The effect whose own duration counts it down, with no save repeating. */
function timedActiveEffectPlan(action: Dnd5eCompiledEffectActionSource) {
  return (
    timedImmediateConditionPlan(action) ??
    timedConditionPlan(action) ??
    modifierGrantPlan(action) ??
    actorLinkPlan(action) ??
    creatureFormPlan(action)
  )
}

function dnd5eActiveEffectPlans(
  action: Dnd5eCompiledEffectActionSource,
  published: ServerPublishedRuleDefinitionDto
): CharacterRuleActionActiveEffectPlan[] {
  if (published.id !== action.effectId || published.checksum.length !== 64)
    throw new Dnd5eEffectActionCompilerError('The D&D active effect plan source is invalid.')
  const results = directResultSequence(action, holdsLastingEffect)
  if (results) return results.flatMap((result) => dnd5eActiveEffectPlans(result, published))
  const composed = sequentialCompositionPlan(action)
  if (composed) return [composed]
  const repeatPlan = repeatingFollowUpSavePlan(action)
  const timedPlan = repeatPlan ? null : timedActiveEffectPlan(action)
  // A turn-end gate is frozen as the d20 test it rolls, not as the duration its child holds.
  const savePlan = repeatPlan ?? (timedPlan?.turnEndGate ? timedPlan : null)
  const relationship = relationshipPlan(action)
  const plan =
    repeatPlan ??
    timedPlan ??
    relationship ??
    supportedRecurringPlan(action) ??
    concealmentPlan(action)
  // A chosen item rides a grant plan; with any other plan its binding or release would vanish.
  if (
    !plan?.chosenItem &&
    action.compiledEffect.entries.some(
      (entry) =>
        'outcome' in entry &&
        (entry.chosenItem !== undefined ||
          entry.outcome.effectKind === 'RELEASE_CHOSEN_ITEM' ||
          (entry.outcome.effectKind === 'APPLY_GRANT' &&
            (entry.outcome.bindsChosenItem || entry.outcome.unlessChosenItemReleased)))
    )
  )
    unsupported('D&D chosen item needs a timed grant it rides.')
  const sourceImmunity = sourceImmunityPlan(action)
  // The immunity rides the plan the action makes; with no such plan it would silently vanish. A
  // save's immunity under a Concentration would end with it, so it is refused; a lockout is
  // created apart from the Concentration it outlasts, and takes the slot a failure rider would.
  if (
    sourceImmunity &&
    (!plan ||
      (sourceImmunity.appliesTo === 'SAVE_SUCCESS'
        ? plan.maintenance
        : plan.marginRiders.length > 0))
  )
    unsupported('D&D source immunity needs a lasting effect it can ride.')
  const repeatCarrier = repeatCarrierPlan(action, testPhaseKindOrNull(action) === 'SAVE')
  // The carrier takes the failure rider's slot and depends on the Concentration the grant rides.
  if (
    repeatCarrier &&
    (!timedPlan?.modifierGrantContribution ||
      !timedPlan.maintenance ||
      !timedPlan.chosenItem ||
      timedPlan.marginRiders.length > 0 ||
      sourceImmunity)
  )
    unsupported('D&D repeat offer needs a maintained chosen-item grant it can ride.')
  if (!plan) return []
  const frozenGraph = savePlan
    ? repeatFollowUpSavePublishedGraph({ action, plan: savePlan })
    : timedPlan
      ? durationPublishedGraph({
          effectId: action.effectId,
          plan: { ...timedPlan, repeatCarrier }
        })
      : relationship
        ? relationship.frozenGraph
        : published
  const test = repeatPlan || timedPlan || relationship ? null : testPlan(action)
  const outcome = repeatPlan || timedPlan || relationship || test ? null : supported(action)
  const firstEntry = action.compiledEffect.entries[0]
  const recurringOutcome = firstEntry && 'outcome' in firstEntry ? firstEntry.outcome : null
  const testOutcomeKind = test && recurringOutcome ? boundedTestOutcome(firstEntry!).kind : null
  const expectedOperation = relationship
    ? relationshipOperationKey(action)
    : savePlan
      ? DND5E_SAVE_TEST_OPERATION_KEY
      : timedPlan
        ? DND5E_CONDITION_DURATION_OPERATION_KEY
        : testOutcomeKind
          ? testOutcomeKind === 'FORCED_MOVEMENT'
            ? null
            : dnd5eOutcomeDefinition(testOutcomeKind).pathGatedOperationKey
          : outcome?.kind === 'DICE_HEAL'
            ? dnd5eOutcomeDefinition(outcome.temporary ? 'TEMPORARY_HIT_POINTS' : 'HEAL')
                .operationKey
            : // A recurring plan rides one registered outcome; no other graph carries one.
              !outcome ||
                outcome.kind === 'DICE_DAMAGE' ||
                outcome.kind === 'CONTEST_RELATIONSHIP' ||
                outcome.kind === 'CHECK_OUTCOME' ||
                outcome.kind === 'DIRECT_RELATIONSHIP'
              ? null
              : dnd5eOutcomeDefinition(outcome.kind).operationKey
  if (
    frozenGraph.definition.nodes.filter(
      (node) => node.id === plan.frozenGraphNodeId && node.operation.key === expectedOperation
    ).length !== 1
  )
    throw new Dnd5eEffectActionCompilerError(
      'The D&D active effect plan does not bind one exact frozen graph node.'
    )
  if (
    frozenGraph.definition.sourceEntryBindings?.filter(
      (binding) =>
        binding.sourceEntryId === plan.compiledEntryId && binding.nodeId === plan.frozenGraphNodeId
    ).length !== 1
  )
    throw new Dnd5eEffectActionCompilerError(
      'The D&D active effect plan does not bind one exact authored result block.'
    )
  return [
    {
      ...plan,
      frozenGraph,
      ...(sourceImmunity && { sourceImmunity }),
      ...(repeatCarrier && { repeatCarrier })
    }
  ]
}

function compileDnd5eEffectAction({
  action
}: {
  action: Dnd5eCompiledEffectActionSource
}): ServerPublishedRuleDefinitionDto {
  const sequence = rulingSequence(action)
  if (!sequence) return compileEffectActionGraph(action)
  const { definition } = compileEffectActionGraph(sequence.executable)
  // Each ruling is a manual-adjudication proposal on the same target, bound to its authored entry
  // so the commit carries the GM's instructions beside the executable result.
  const rulingNodes = sequence.rulings.map((entry, index) => ({
    entryId: entry.entryId,
    node: {
      id: `manual_adjudication-${index + 1}`,
      operation: { key: DND5E_MANUAL_ADJUDICATION_PROPOSAL_OPERATION_KEY, contractVersion: 1 },
      inputs: {
        targetActorId: { kind: 'FACT', factKey: DND5E_TARGET_ACTOR_FACT_KEY },
        targetStateChecksum: { kind: 'FACT', factKey: DND5E_TARGET_STATE_CHECKSUM_FACT_KEY }
      }
    } satisfies RuleGraphDefinition['nodes'][number]
  }))
  const withRulings: RuleGraphDefinition = {
    ...definition,
    nodes: [...definition.nodes, ...rulingNodes.map(({ node }) => node)],
    sourceEntryBindings: [
      ...(definition.sourceEntryBindings ?? []),
      ...rulingNodes.map(({ entryId, node }) => ({ sourceEntryId: entryId, nodeId: node.id }))
    ]
  }
  return publishedGraph(withRulings)
}

/** The gates the action's one direct entry authors on its outcome, when it authors any. */
function directGates(action: Dnd5eCompiledEffectActionSource): Dnd5eAuthoredGates | undefined {
  const entry = action.compiledEffect.entries[0]
  return entry?.resolutionKind === 'DIRECT' && isGated(entry) ? entry : undefined
}

function compileEffectActionGraph(
  action: Dnd5eCompiledEffectActionSource
): ServerPublishedRuleDefinitionDto {
  if (action.gameSystemId !== DND5E_SYSTEM_ID)
    throw new Dnd5eEffectActionCompilerError(
      'D&D compiler received an action from another Game System.'
    )
  uuid(action.effectId, 'D&D Effect action identity')
  if (
    action.entryPointDefinitionId !== action.effectId ||
    action.compiledEffect.id !== action.effectId
  )
    throw new Dnd5eEffectActionCompilerError(
      'D&D Effect action entry point does not match its exact Effect.'
    )
  if (action.compiledEffect.requiresConcentration && !startsMaintainedEffect(action))
    unsupported('D&D Concentration spell has no supported maintained effect.')
  // A direct or test-path outcome honours a gate; every other plan refuses one rather than skip it.
  const gates = directGates(action)
  const refuseGate = () => {
    if (gates !== undefined) unsupported('D&D hit-point gate belongs to a direct outcome.')
  }
  if (gates?.gate?.kind === 'REDUCED_TO_ZERO_BY')
    unsupported('D&D reduced-to-0 gate follows a damage outcome of a test path.')
  const composition = sequentialComposition(action)
  if (composition) {
    refuseGate()
    return compileSequentialComposition(action, composition)
  }
  const results = directResultSequence(action, holdsLastingEffect)
  if (results) return compileDirectResultSequence(results)
  if (isExactImmediateFollowUpSaveAction(action) || repeatingDirectFollowUpSavePlan(action)) {
    refuseGate()
    return compileDnd5eEffectActionTestTemplate({ action }).published
  }
  const recurringPlan = supportedRecurringPlan(action) ?? concealmentPlan(action)
  const plan = testPlan(action)
  if (plan) {
    return bindMovementInterruptionOutput({
      action,
      published: compileTestDefinition(action, plan, recurringPlan)
    })
  }
  const table = directRollTableGraph(action, timedActiveEffectPlan)
  if (table) return bindMovementInterruptionOutput({ action, published: table })
  const outcome = supported(action)
  const repeatPlan = repeatingDirectFollowUpSavePlan(action, 'ACTIVATED')
  refuseUnboundGate(gates ?? {}, outcome.kind)
  if (outcome.kind === 'DICE_HEAL') {
    const entry = action.compiledEffect.entries[0]
    if (
      !entry ||
      !('outcome' in entry) ||
      entry.outcome.effectKind !== 'HEAL' ||
      entry.outcome.valueKind !== 'DICE'
    )
      unsupported('D&D dice healing must retain one exact authored outcome.')
    const definition = diceGraphDefinition({
      action,
      entry,
      diceConfig: healDiceConfiguration(entry.outcome, action.spellCastLevel),
      modifierFactKey: DND5E_RESOLVED_HEAL_MODIFIER_FACT_KEY,
      ...(recurringPlan ? { recurring: recurringPlan } : {})
    })
    return bindMovementInterruptionOutput({ action, published: publishedGraph(definition) })
  }
  if (outcome.kind === 'DICE_DAMAGE') {
    const entry = action.compiledEffect.entries[0]
    if (
      recurringPlan ||
      !entry ||
      !('outcome' in entry) ||
      entry.outcome.effectKind !== 'DAMAGE' ||
      entry.outcome.valueKind !== 'DICE' ||
      entry.outcome.scalingKind !== 'NONE'
    )
      unsupported('D&D direct dice damage must retain one exact unrecurring authored outcome.')
    const definition = diceGraphDefinition({ action, entry, diceConfig: entry.outcome.dice })
    return bindMovementInterruptionOutput({ action, published: publishedGraph(definition) })
  }
  if (outcome.kind === 'CONTEST_RELATIONSHIP')
    return bindMovementInterruptionOutput({
      action,
      published: createDnd5eContestGraph(action.effectId)
    })
  if (outcome.kind === 'DIRECT_RELATIONSHIP') {
    // Used, the action only holds; its stored effect rolls any recurrence on later turns.
    const published = relationshipStateGraph({ action, relationshipId: outcome.relationshipId })
    return bindMovementInterruptionOutput({ action, published })
  }
  if (outcome.kind === 'CHECK_OUTCOME')
    unsupported('D&D check outcome requires its check test phase.')
  const outcomeDefinition = dnd5eOutcomeDefinition(outcome.kind)
  const nodeId = recurringPlan ? recurringPlan.frozenGraphNodeId : outcome.kind.toLowerCase()
  // The save the target repeats (Power Word Stun) is pinned to the DC this cast settles.
  const repeatsSave = outcome.kind === 'CONDITION_APPLY' && repeatPlan !== null
  const definition: RuleGraphDefinition = {
    schemaVersion: 1,
    id: action.effectId,
    gameSystemId: DND5E_SYSTEM_ID,
    definitionFamilyKey: DND5E_EFFECT_ACTION_FAMILY_KEY,
    nodes: [
      effectOutcomeProposalNode({
        id: nodeId,
        definition: outcomeDefinition,
        outcome,
        context: { conditionImmuneFactKey: DND5E_TARGET_CONDITION_IMMUNE_FACT_KEY },
        target: DND5E_OUTCOME_TARGET,
        phase: { kind: 'DIRECT', contractVersion: gates === undefined ? 1 : 2 },
        extraInputs: gates === undefined ? {} : gateNodeInputs(gates)
      })
    ],
    outputs: {
      ...effectOutcomeProposalOutputs(outcomeDefinition, nodeId),
      ...(repeatsSave ? { castSaveDc: { kind: 'FACT', factKey: DND5E_SAVE_DC_FACT_KEY } } : {})
    },
    ...(recurringPlan
      ? {
          sourceEntryBindings: [
            {
              sourceEntryId: recurringPlan.compiledEntryId,
              nodeId: recurringPlan.frozenGraphNodeId
            }
          ]
        }
      : {})
  }
  return bindMovementInterruptionOutput({
    action,
    published: publishedGraph(definition)
  })
}

/**
 * The target's save for one ability. A save against a condition the action imposes also takes the
 * grants scoped to that condition (Steel Will against frightened), merged across such conditions.
 */
export function selectDnd5eTargetSavingThrow(input: {
  savingThrowDefinitions: unknown
  abilityDefinitionId: string
  conditionIds: readonly string[]
}): {
  modifier: number
  rollMode: 'NORMAL' | 'ADVANTAGE' | 'DISADVANTAGE'
  contributors: ReceiptD20ContributorDto[]
} {
  type SaveDefinition = {
    conditionTypeId: unknown
    modifier: number
    rollMode: 'NORMAL' | 'ADVANTAGE' | 'DISADVANTAGE'
    contributors: ReceiptD20ContributorDto[]
  }
  if (!Array.isArray(input.savingThrowDefinitions))
    throw new Dnd5eEffectActionCompilerError('D&D target saving throws are unavailable.')
  const definitions = input.savingThrowDefinitions.flatMap(
    (candidate: unknown): SaveDefinition[] => {
      const row =
        typeof candidate === 'object' && candidate !== null
          ? (candidate as Record<string, unknown>)
          : null
      if (
        row === null ||
        row.abilityDefinitionId !== input.abilityDefinitionId ||
        row.ruleDefinitionId !== undefined
      )
        return []
      if (typeof row.modifier !== 'number' || !Number.isSafeInteger(row.modifier))
        throw new Dnd5eEffectActionCompilerError('D&D target save modifier is unavailable.')
      const rollMode = row.rollMode
      if (rollMode !== 'NORMAL' && rollMode !== 'ADVANTAGE' && rollMode !== 'DISADVANTAGE')
        throw new Dnd5eEffectActionCompilerError('D&D target save roll mode is invalid.')
      const contributors = (Array.isArray(row.contributors) ? row.contributors : []).map(
        ({ sourceId, grantId, domainKey, influence, source }: ReceiptD20ContributorDto) => ({
          sourceId,
          grantId,
          domainKey,
          influence,
          source
        })
      )
      return [
        {
          conditionTypeId: row.conditionTypeId,
          modifier: row.modifier,
          rollMode,
          contributors
        }
      ]
    }
  )
  const base = definitions.find((definition) => definition.conditionTypeId === undefined)
  if (base === undefined)
    throw new Dnd5eEffectActionCompilerError('D&D target save modifier is unavailable.')
  const conditional = definitions.filter(
    (definition) =>
      typeof definition.conditionTypeId === 'string' &&
      input.conditionIds.includes(definition.conditionTypeId)
  )
  if (conditional.length === 0) return base
  const contributors = [
    ...new Map(
      conditional
        .flatMap((definition) => definition.contributors)
        .map((contributor) => [JSON.stringify(contributor), contributor])
    ).values()
  ].sort(compareCanonicalD20Contributors)
  return {
    modifier: conditional.reduce(
      (sum, definition) => sum + definition.modifier - base.modifier,
      base.modifier
    ),
    rollMode: resolveDnd5eRollMode(contributors).rollMode,
    contributors
  }
}

/**
 * A persisted active effect retains the compiled graph rather than the source
 * document. Reconstruct the exact published-definition view from that sealed
 * graph before applying the D&D test interpreter; the schema keeps this
 * adapter boundary honest and rejects a malformed frozen graph.
 */
function publishedDefinitionForFrozenGraph(
  graph: CompiledRuleGraph
): ServerPublishedRuleDefinitionDto {
  return serverPublishedRuleDefinitionDtoSchema.parse({
    id: graph.source.definitionId,
    gameSystemId: graph.source.gameSystemId,
    definitionFamilyKey: graph.source.definitionFamilyKey,
    checksum: graph.source.checksum,
    definition: {
      schemaVersion: graph.schemaVersion,
      id: graph.source.definitionId,
      gameSystemId: graph.source.gameSystemId,
      definitionFamilyKey: graph.source.definitionFamilyKey,
      nodes: graph.nodes,
      outputs: graph.outputs,
      ...(graph.sourceEntryBindings ? { sourceEntryBindings: graph.sourceEntryBindings } : {}),
      ...(graph.vocabularyBindings ? { vocabularyBindings: graph.vocabularyBindings } : {})
    }
  })
}

/** The D&D action source a compiler source retains; the one place its untyped Effect document is narrowed. */
export function dndSourceFromCompilerSource(
  source: CompiledActionCompilerSource
): Dnd5eCompiledEffectActionSource {
  return {
    gameSystemId: DND5E_SYSTEM_ID,
    entryPointDefinitionId: source.entryPointDefinitionId,
    effectId: source.effectId,
    conditionDefinitionIds: source.conditionDefinitionIds,
    savingThrowAbilityDefinitionId: source.savingThrowAbilityDefinitionId,
    compiledEffect: source.compiledEffect as Dnd5eCompiledEffectActionSource['compiledEffect'],
    ...(source.zoneAppearSave ? { zoneAppearSave: true as const } : {})
  }
}

function testOutcomeTemplateIdentities(action: Dnd5eCompiledEffectActionSource) {
  const directRepeatLeadEntries = repeatingDirectFollowUpSaveLeadEntries(action)
  if (directRepeatLeadEntries) {
    return [
      {
        pathCode: 'ON_SAVE_FAIL',
        template: {
          definitionId: action.effectId,
          gameSystemId: DND5E_SYSTEM_ID,
          definitionFamilyKey: DND5E_EFFECT_ACTION_FAMILY_KEY,
          checksum: checksumRuleDocument(directRepeatLeadEntries)
        }
      }
    ]
  }
  const paths = new Set<SpecializedPath>()
  for (const entry of action.compiledEffect.entries) paths.add(entry.pathCode as SpecializedPath)
  // An attack critical includes the ordinary hit branch when one exists. It
  // therefore needs a reachable template even when the source has no extra
  // ON_CRIT entry of its own.
  if (testPhaseKindOrNull(action) === 'ATTACK' && paths.has('ON_HIT')) paths.add('ON_CRIT')
  const outcomes = [] as {
    pathCode: string
    template: {
      definitionId: string
      gameSystemId: string
      definitionFamilyKey: string
      checksum: string
    }
  }[]
  for (const pathCode of [...paths].sort((left, right) => left.localeCompare(right))) {
    const table = rollTablePath(action, pathCode)
    const groups = table ? [] : selectedOutcomeGroups(action, pathCode)
    if (!table && groups.length === 0) continue
    const followUpSave =
      !table &&
      (pathCode === 'ON_HIT' || pathCode === 'ON_CRIT') &&
      isExactImmediateFollowUpSaveAction(action)
    // Validate every reachable outcome at source compilation time. The
    // specialized graph itself is intentionally deferred until locked
    // runtime scaling facts are available.
    if (!followUpSave) for (const entry of groups.flat()) specializedTestOutcome(entry)
    outcomes.push({
      pathCode,
      template: {
        definitionId: action.effectId,
        gameSystemId: DND5E_SYSTEM_ID,
        definitionFamilyKey: DND5E_EFFECT_ACTION_FAMILY_KEY,
        checksum: checksumRuleDocument(
          table ? table.rows : followUpSave ? action.compiledEffect.entries : groups
        )
      }
    })
  }
  // A TEST whose every outcome its active-effect plan carries (a creature form, a bond, or a timed
  // grant after a save or on an attack's result) selects no OUTCOME graph: the plan runs from the
  // TEST's result path. An equipment degradation is likewise the resolver's, off the result path.
  if (
    outcomes.length === 0 &&
    creatureFormPlan(action) === null &&
    actorLinkPlan(action) === null &&
    modifierGrantPlan(action) === null &&
    !action.compiledEffect.entries.some(
      (entry) => 'outcome' in entry && entry.outcome.effectKind === 'DEGRADE_EQUIPMENT'
    )
  )
    unsupported('D&D test action has no specialized outcome path.')
  return outcomes
}

export const dnd5eCharacterRuleActionSystemAdapter: CharacterRuleActionSystemAdapter = {
  gameSystemId: DND5E_SYSTEM_ID,
  compile: compileDnd5eEffectAction,
  incomingGateImmunityPlan,
  compileZonePlacement: ({ action, label }) =>
    compileDnd5eZonePlacement(executableAction(action), label),
  compileSummonPlacement: ({ action }) => compileDnd5eSummonPlacement(executableAction(action)),
  interpretSpatial,
  compileExecutionPlan: ({ action, compilerSource }) => {
    const source = executableAction(dndSourceFromCompilerSource(compilerSource))
    if (
      (!testPhaseKindOrNull(source) && !isCheckOutcomeAction(source)) ||
      supportedRecurringPlan(source) ||
      (source.compiledEffect.entries.every(
        (entry) => 'outcome' in entry && entry.outcome.effectKind === 'ACTOR_RELATIONSHIP'
      ) &&
        relationshipPlan(source))
    ) {
      return {
        kind: 'SINGLE_GRAPH',
        published: compileDnd5eEffectAction({ action })
      }
    }
    const testTemplate = compileDnd5eEffectActionTestTemplate({ action: source })
    return {
      kind: 'TEST_OUTCOME',
      compilerSource,
      test: {
        published: testTemplate.published,
        template: templateIdentity(testTemplate)
      },
      outcomes: testOutcomeTemplateIdentities(source)
    }
  },
  optionalOnHitRiders: ({ compilerSource }) => [
    ...new Map(
      dndSourceFromCompilerSource(compilerSource).compiledEffect.entries.flatMap((entry) =>
        'optionalRider' in entry && entry.optionalRider
          ? [[entry.optionalRider.riderId, entry.optionalRider] as const]
          : []
      )
    ).values()
  ],
  outcomeTargetPreconditions: ({ effectKinds }) => dnd5eOutcomeTargetPreconditions(effectKinds),
  compileTestTemplate: ({ compilerSource }) => {
    const test = compileDnd5eEffectActionTestTemplate({
      action: dndSourceFromCompilerSource(compilerSource)
    })
    return { published: test.published, template: templateIdentity(test) }
  },
  specializeOutcomeTemplate: ({
    compilerSource,
    testTemplate,
    selectedPath,
    facts,
    testOutputs,
    testRollMode
  }) => {
    if (!isSpecializedPath(selectedPath))
      throw new Dnd5eEffectActionCompilerError('D&D selected outcome path is unavailable.')
    const action = dndSourceFromCompilerSource(compilerSource)
    const expectedTest = compileDnd5eEffectActionTestTemplate({ action })
    const expectedIdentity = templateIdentity(expectedTest)
    if (
      testTemplate.published.id !== expectedTest.published.id ||
      testTemplate.published.gameSystemId !== expectedTest.published.gameSystemId ||
      testTemplate.published.definitionFamilyKey !== expectedTest.published.definitionFamilyKey ||
      testTemplate.published.checksum !== expectedTest.published.checksum ||
      testTemplate.template.definitionId !== expectedIdentity.definitionId ||
      testTemplate.template.gameSystemId !== expectedIdentity.gameSystemId ||
      testTemplate.template.definitionFamilyKey !== expectedIdentity.definitionFamilyKey ||
      testTemplate.template.checksum !== expectedIdentity.checksum
    ) {
      throw new Dnd5eEffectActionCompilerError(
        'D&D outcome specialization must bind its exact TEST template identity.'
      )
    }
    const outcome = specializeDnd5eEffectActionOutcomeBody({
      action,
      selectedPath,
      facts: dnd5eEffectScalingFacts({ facts, testOutputs, testRollMode })
    })
    return outcome
      ? {
          published: outcome.published,
          templateChecksum: outcome.templateChecksum
        }
      : null
  },
  combatPerceptionBaselineCapabilities: ({ observerActorId }) => [
    {
      instanceId: uuidv5(observerActorId, DND5E_ORDINARY_SIGHT_NAMESPACE),
      definitionId: DND5E_ORDINARY_SIGHT_DEFINITION_ID,
      checksum: DND5E_ORDINARY_SIGHT_CHECKSUM,
      capabilityOrdinal: 0,
      range: { rangeKind: 'UNLIMITED' },
      capability: DND5E_ORDINARY_SIGHT_CAPABILITY
    }
  ],
  activeEffectPerceptionRequirement: ({ definition }) => {
    const influence =
      definition.adapterFacts[DND5E_ACTIVE_EFFECT_REPEAT_SAVE_ROLL_INFLUENCE_FACT_KEY]
    const allow = definition.adapterFacts[DND5E_ACTIVE_EFFECT_REPEAT_SAVE_ATTEMPT_GATE_FACT_KEY]
    const requirement =
      definition.adapterFacts[DND5E_ACTIVE_EFFECT_REPEAT_SAVE_PERCEPTION_REQUIREMENT_FACT_KEY]
    if (influence === undefined && allow === undefined && requirement === undefined) return null
    if (!['DETECT', 'LOCATE', 'PRECISE', 'SEE'].includes(String(requirement))) {
      throw new Dnd5eEffectActionCompilerError('D&D recurring perception is not fully pinned.')
    }
    const pinned = requirement as 'DETECT' | 'LOCATE' | 'PRECISE' | 'SEE'
    if (allow === undefined && (influence === 'ADVANTAGE' || influence === 'DISADVANTAGE'))
      return { kind: 'ROLL_INFLUENCE', influence, requirement: pinned }
    if (influence === undefined && (allow === 'WHEN_MET' || allow === 'WHEN_UNMET'))
      return { kind: 'ATTEMPT_GATE', allow, requirement: pinned }
    throw new Dnd5eEffectActionCompilerError('D&D recurring perception is not fully pinned.')
  },
  passiveDamageGrantPlan,
  standingEffectPlan,
  activeEffectPlans: ({ action: authored, published }) => {
    const action = executableAction(authored)
    const rows = rollTableRowActions(action)
    if (rows && hitPointTierActions(action))
      unsupported('D&D roll table cannot share an action with hit-point tiers.')
    if (rows)
      return rows.flatMap(({ rowId, row, rowAction }) =>
        dnd5eActiveEffectPlans(rowAction, published).map((plan) =>
          plan.compiledEntryId === rowId
            ? { ...plan, rollTableRow: row }
            : unsupported('D&D roll table row plan must hold its own row.')
        )
      )
    const tiers = hitPointTierActions(action)
    if (tiers)
      return tiers.flatMap(({ atMost, tierAction }) =>
        dnd5eActiveEffectPlans(tierAction, published).map((plan) => ({
          ...plan,
          hitPointTier: { atMost }
        }))
      )
    return dnd5eActiveEffectPlans(action, published)
  },
  bindFacts: ({
    actionMechanic,
    published,
    sourceDerivedFacts,
    targetActorId,
    sourceHitPoints,
    targetDerivedFacts,
    currentHitPoints,
    temporaryHitPoints,
    maximumHitPoints,
    targetScalarValues,
    targetConditionIds,
    foldedBonuses,
    conditionOutcomeRules,
    conditionImmunityIds,
    targetDamageTypesTaken
  }) => {
    const resolvedDamageExpressionFacts: Record<string, string> = {}
    const resolvedDamageOutcomeExpressions: Record<string, string> = {}
    const weaponDamageDieFacts: Record<string, number> = {}
    const resolvedDamagePathCounts = new Map<SpecializedPath, number>()
    const sourceFacts = sourceDerivedFacts as Record<string, unknown>
    const actionOutcomes = (actionMechanic as { outcomes?: unknown }).outcomes
    if (Array.isArray(actionOutcomes)) {
      for (const outcome of actionOutcomes) {
        if (!outcome || typeof outcome !== 'object' || Array.isArray(outcome)) continue
        const row = outcome as Record<string, unknown>
        if (
          row.kind !== 'DAMAGE' ||
          typeof row.pathCode !== 'string' ||
          !isSpecializedPath(row.pathCode)
        )
          continue
        const expression =
          typeof row.diceExpression === 'string'
            ? row.diceExpression
            : resolveCreatureDamageExpression({
                outcome: row,
                sourceDerivedFacts: sourceFacts,
                sourceHitPoints: sourceHitPoints ?? null
              })
        if (expression === null) continue
        if (typeof row.weaponDieFaces === 'number')
          weaponDamageDieFacts[DND5E_WEAPON_DAMAGE_DIE_FACT_KEY] = row.weaponDieFaces
        if (typeof row.outcomeId === 'string' && row.outcomeId.length > 0) {
          if (resolvedDamageOutcomeExpressions[row.outcomeId] !== undefined)
            throw new Dnd5eEffectActionCompilerError(
              'D&D action has duplicate resolved damage outcome identities.'
            )
          resolvedDamageOutcomeExpressions[row.outcomeId] = expression
        }
        resolvedDamagePathCounts.set(
          row.pathCode,
          (resolvedDamagePathCounts.get(row.pathCode) ?? 0) + 1
        )
      }
      for (const outcome of actionOutcomes) {
        if (!outcome || typeof outcome !== 'object' || Array.isArray(outcome)) continue
        const row = outcome as Record<string, unknown>
        if (
          row.kind !== 'DAMAGE' ||
          typeof row.pathCode !== 'string' ||
          !isSpecializedPath(row.pathCode) ||
          resolvedDamagePathCounts.get(row.pathCode) !== 1
        )
          continue
        const expression =
          typeof row.diceExpression === 'string'
            ? row.diceExpression
            : resolveCreatureDamageExpression({
                outcome: row,
                sourceDerivedFacts: sourceFacts,
                sourceHitPoints: sourceHitPoints ?? null
              })
        if (expression === null) continue
        const key = DND5E_RESOLVED_DAMAGE_EXPRESSION_FACT_KEYS[row.pathCode]
        resolvedDamageExpressionFacts[key] = expression
      }
    }
    const requiresHealModifier = published.definition.nodes.some((node) =>
      Object.values(node.inputs).some(
        (binding) =>
          binding.kind === 'FACT' && binding.factKey === DND5E_RESOLVED_HEAL_MODIFIER_FACT_KEY
      )
    )
    const resolvedHealOutcomes = Array.isArray(actionOutcomes)
      ? actionOutcomes.filter(
          (outcome): outcome is Record<string, unknown> & { expression: string } =>
            !!outcome &&
            typeof outcome === 'object' &&
            !Array.isArray(outcome) &&
            (outcome as Record<string, unknown>).kind === 'HEAL' &&
            typeof (outcome as Record<string, unknown>).expression === 'string'
        )
      : []
    // A composed recurring heal's amount is settled at cast from its resolved row (D156).
    const recurringHealOutcome = published.definition.outputs.recurringHealOutcomeId
    const recurringHealOutcomeId =
      recurringHealOutcome?.kind === 'LITERAL' ? recurringHealOutcome.value : null
    const recurringHealFacts = recurringHealAmountFacts(
      published,
      resolvedHealOutcomes,
      recurringHealOutcomeId
    )
    let resolvedHealModifierFacts: Record<string, number | boolean> = {}
    if (requiresHealModifier) {
      const heals = resolvedHealOutcomes.filter((o) => o.outcomeId !== recurringHealOutcomeId)
      if (heals.length !== 1)
        throw new Dnd5eEffectActionCompilerError(
          'D&D dice healing requires one exact resolved healing expression.'
        )
      const { term: resolvedTerm, modifier } = parseBoundedDiceConfiguration(heals[0]!.expression)
      const authoredTerm = authoredHealingDiceTerm(published)
      if (resolvedTerm.count !== authoredTerm.count || resolvedTerm.die !== authoredTerm.die)
        throw new Dnd5eEffectActionCompilerError(
          'D&D resolved healing expression does not match the authored dice.'
        )
      resolvedHealModifierFacts = {
        [DND5E_RESOLVED_HEAL_MODIFIER_FACT_KEY]: modifier,
        [DND5E_HEALING_MAXIMIZED_FACT_KEY]: targetDerivedFacts.healingMaximized === true
      }
    }
    const action = actionMechanic as {
      attackBonus?: unknown
      attackRollMode?: unknown
      attackKind?: unknown
      save?: { abilityDefinitionId?: unknown; dc?: unknown } | null
    }
    const { spellCastLevel, classLevels, selectedOptionalRiderIds } = actionMechanic
    const damageAddedDice =
      sourceDerivedFacts.damageAddedDice === undefined
        ? []
        : damageAddedDiceDtoSchema.parse(sourceDerivedFacts.damageAddedDice)
    // A target with no folded incoming-damage profile (outside an Encounter) has no reductions.
    const incomingReductions =
      targetDerivedFacts.incomingDamage === undefined
        ? []
        : incomingDamageProfileDtoSchema.parse(targetDerivedFacts.incomingDamage).reductions
    const baseFacts = {
      ...dnd5eAddedDiceFacts([]),
      [DND5E_TARGET_ACTOR_FACT_KEY]: targetActorId,
      [DND5E_TARGET_STATE_CHECKSUM_FACT_KEY]: checksumRuleDocument({
        targetActorId,
        currentHitPoints,
        temporaryHitPoints,
        maximumHitPoints,
        scalarValues: targetScalarValues,
        conditionIds: [...targetConditionIds].sort()
      }),
      ...conditionImmunityFacts(published.definition, conditionImmunityIds),
      [DND5E_TARGET_CURRENT_HIT_POINTS_FACT_KEY]: currentHitPoints,
      ...gateFacts(published.definition, { targetDamageTypesTaken }),
      ...saveDamageMultiplierFacts(published.definition, {
        abilityDefinitionId: action.save?.abilityDefinitionId,
        incomingDamage: targetDerivedFacts.incomingDamage
      }),
      ...resolvedDamageExpressionFacts,
      ...weaponDamageDieFacts,
      ...(Object.keys(resolvedDamageOutcomeExpressions).length > 0
        ? {
            [DND5E_RESOLVED_DAMAGE_OUTCOME_EXPRESSIONS_FACT_KEY]: JSON.stringify(
              Object.fromEntries(
                Object.entries(resolvedDamageOutcomeExpressions).sort(([left], [right]) =>
                  left.localeCompare(right)
                )
              )
            )
          }
        : {}),
      ...resolvedHealModifierFacts,
      ...recurringHealFacts,
      ...spentHealAmountFacts(published, resolvedHealOutcomes, actionMechanic.spentUnits),
      ...(spellCastLevel === undefined
        ? {}
        : { [DND5E_SPELL_CAST_LEVEL_FACT_KEY]: spellCastLevel }),
      ...(selectedOptionalRiderIds === undefined || selectedOptionalRiderIds.length === 0
        ? {}
        : {
            [DND5E_SELECTED_OPTIONAL_RIDERS_FACT_KEY]: JSON.stringify(
              [...selectedOptionalRiderIds].sort()
            )
          }),
      ...(classLevels === undefined || Object.keys(classLevels).length === 0
        ? {}
        : {
            [DND5E_CLASS_LEVELS_FACT_KEY]: JSON.stringify(
              Object.fromEntries(
                Object.entries(classLevels).sort(([left], [right]) => left.localeCompare(right))
              )
            )
          }),
      ...(damageAddedDice.length === 0
        ? {}
        : { [DND5E_DAMAGE_ADDED_DICE_FACT_KEY]: JSON.stringify(damageAddedDice) }),
      ...(incomingReductions.length === 0
        ? {}
        : { [DND5E_INCOMING_DAMAGE_REDUCTIONS_FACT_KEY]: JSON.stringify(incomingReductions) })
    }
    const derivedStats = targetDerivedFacts.derivedStats as
      | { armorClass?: { effective?: unknown }; savingThrows?: unknown }
      | undefined
    const statBlock = targetDerivedFacts.statBlock as { armorClass?: unknown } | undefined
    const armorClass = derivedStats?.armorClass?.effective ?? statBlock?.armorClass
    const sourceContributorEvidence = sourceDerivedFacts.rollContributorEvidence as
      | { attacks?: Record<string, readonly ReceiptD20ContributorDto[]> }
      | undefined
    const nestedSaveAbilityBindings = Object.entries(published.definition.outputs).filter(
      ([name]) =>
        name === 'nestedSaveAbilityDefinitionId' || name.endsWith('_nestedSaveAbilityDefinitionId')
    )
    if (nestedSaveAbilityBindings.length > 1) {
      throw new Dnd5eEffectActionCompilerError('D&D nested save policy is ambiguous.')
    }
    const nestedSaveAbilityBinding = nestedSaveAbilityBindings[0]?.[1]
    const nestedSaveAbilityDefinitionId = (() => {
      if (nestedSaveAbilityBinding?.kind !== 'LITERAL') return null
      const value = nestedSaveAbilityBinding.value
      return typeof value === 'string' && UUID.test(value) ? value : null
    })()
    if (nestedSaveAbilityDefinitionId) {
      const nestedSaveNode = published.definition.nodes.find(
        (node) => node.id === 'nested-save-d20'
      )
      const nestedSaveTest = published.definition.nodes.find(
        (node) => node.id === 'nested-save-test'
      )
      const dcBinding = nestedSaveTest?.inputs.threshold
      // A derived DC (ability modifier + proficiency) is settled on the action; a fixed one is in the graph.
      const dcValue =
        dcBinding?.kind === 'FACT'
          ? action.save?.dc
          : dcBinding?.kind === 'LITERAL'
            ? dcBinding.value
            : undefined
      const dc = typeof dcValue === 'number' && Number.isSafeInteger(dcValue) ? dcValue : null
      if (!nestedSaveNode || !nestedSaveTest || dc === null)
        throw new Dnd5eEffectActionCompilerError('D&D nested save graph is invalid.')
      const savingThrowDefinitions = targetDerivedFacts.savingThrowDefinitions
      if (!Array.isArray(savingThrowDefinitions))
        throw new Dnd5eEffectActionCompilerError('D&D target saving throws are unavailable.')
      const matches = savingThrowDefinitions.filter(
        (
          candidate
        ): candidate is {
          abilityDefinitionId: string
          modifier: number
          rollMode: 'NORMAL' | 'ADVANTAGE' | 'DISADVANTAGE'
          contributors: readonly ReceiptD20ContributorDto[]
        } =>
          typeof candidate === 'object' &&
          candidate !== null &&
          (candidate as { abilityDefinitionId?: unknown }).abilityDefinitionId ===
            nestedSaveAbilityDefinitionId &&
          (candidate as { ruleDefinitionId?: unknown }).ruleDefinitionId === undefined &&
          (candidate as { conditionTypeId?: unknown }).conditionTypeId === undefined
      )
      if (
        matches.length !== 1 ||
        !Number.isSafeInteger(matches[0]!.modifier) ||
        !['NORMAL', 'ADVANTAGE', 'DISADVANTAGE'].includes(matches[0]!.rollMode)
      ) {
        throw new Dnd5eEffectActionCompilerError('D&D nested save policy is unavailable.')
      }
      const contributors = matches[0]!.contributors
        .map(({ sourceId, grantId, domainKey, influence, source }) => ({
          sourceId,
          grantId,
          domainKey,
          influence,
          source
        }))
        .sort(compareCanonicalD20Contributors)
      const contributorChecksum = checksumRuleDocument(contributors)
      const dice = derivedSaveDice(targetDerivedFacts, nestedSaveAbilityDefinitionId)
      return {
        facts: {
          ...baseFacts,
          ...dnd5eAddedDiceFacts(dice.addedDice, true, dice.heldDice),
          [DND5E_SAVE_MODIFIER_FACT_KEY]: matches[0]!.modifier,
          [DND5E_SAVE_DC_FACT_KEY]: dc,
          [DND5E_ROLL_CONTRIBUTOR_CHECKSUM_FACT_KEY]: contributorChecksum,
          ...saveOutcomeFact(conditionOutcomeRules, nestedSaveAbilityDefinitionId)
        },
        d20RollMode: matches[0]!.rollMode,
        d20Keep: DND5E_KEEP_BY_ROLL_MODE[matches[0]!.rollMode],
        d20Roller: 'TARGET',
        d20Audit: {
          contributors,
          contributorChecksum,
          modifier: matches[0]!.modifier,
          defenseOrDc: dc,
          addedDice: dice.addedDice,
          ...saveAudit(conditionOutcomeRules, nestedSaveAbilityDefinitionId)
        }
      }
    }
    if (typeof action.attackBonus === 'number' && Number.isSafeInteger(action.attackBonus)) {
      if (typeof armorClass !== 'number' || !Number.isSafeInteger(armorClass))
        throw new CharacterRuleActionTargetDefenseUnavailableError(
          'D&D attack target defense is unavailable.'
        )
      if (
        action.attackRollMode !== 'NORMAL' &&
        action.attackRollMode !== 'ADVANTAGE' &&
        action.attackRollMode !== 'DISADVANTAGE'
      )
        throw new Dnd5eEffectActionCompilerError('D&D attack roll mode is unavailable.')
      // Roll-mode evidence is keyed by the modifier domain the attack reads.
      const attackKind = attackKindSchema.safeParse(action.attackKind)
      const attackDomain = attackKind.success ? dnd5eAttackModifierDomain(attackKind.data) : 'MELEE'
      const addedDice = derivedAddedDice(sourceDerivedFacts.attackAddedDice, attackDomain)
      const folded = foldD20Operands(foldedBonuses, action.attackBonus, armorClass, addedDice)
      const contributors = (sourceContributorEvidence?.attacks?.[attackDomain] ?? []).map(
        ({ sourceId, grantId, domainKey, influence, source, positional }) => ({
          sourceId,
          grantId,
          domainKey,
          influence,
          source,
          ...(positional ? { positional } : {})
        })
      )
      // A target's grant that suppresses an influence (Elusive's advantage) leaves the attack none.
      const suppressed = sourceDerivedFacts.attackSuppressedInfluences
      const allContributors = contributors.filter(
        ({ influence }) => !Array.isArray(suppressed) || !suppressed.includes(influence)
      )
      allContributors.sort(compareCanonicalD20Contributors)
      const { rollMode } = resolveDnd5eRollMode(allContributors)
      const contributorChecksum = checksumRuleDocument(allContributors)
      const attackCircumstanceFacts = Object.fromEntries(
        (
          [
            [DND5E_ATTACK_ENEMY_PROXIMITY_FACT_KEY, sourceDerivedFacts.attackEnemyProximity],
            [DND5E_ATTACK_MOVE_TOWARD_FACT_KEY, sourceDerivedFacts.attackMoveToward],
            [DND5E_ATTACK_TURN_USES_FACT_KEY, sourceDerivedFacts.attackTurnUses],
            [DND5E_ATTACK_ITEM_BINDINGS_FACT_KEY, sourceDerivedFacts.attackItemBindingEffectIds]
          ] as const
        ).flatMap(([key, value]) => (value ? [[key, JSON.stringify(value)]] : []))
      )
      const criticalRules = attackCriticalRulesDtoSchema.parse(
        sourceDerivedFacts.attackCriticalRules ?? {
          threshold: DEFAULT_CRITICAL_HIT_THRESHOLD,
          extraDice: 0
        }
      )
      return {
        facts: {
          ...baseFacts,
          ...dnd5eAddedDiceFacts(addedDice),
          [DND5E_ATTACK_CRITICAL_THRESHOLD_FACT_KEY]: criticalRules.threshold,
          ...(criticalRules.extraDice > 0
            ? { [DND5E_CRITICAL_EXTRA_DICE_FACT_KEY]: criticalRules.extraDice }
            : {}),
          [DND5E_ATTACK_MODIFIER_FACT_KEY]: folded.modifier,
          [DND5E_TARGET_DEFENSE_FACT_KEY]: folded.defenseOrDc,
          ...(typeof targetDerivedFacts.creatureTypeId === 'string'
            ? { [DND5E_TARGET_CREATURE_TYPE_FACT_KEY]: targetDerivedFacts.creatureTypeId }
            : {}),
          ...attackCircumstanceFacts,
          [DND5E_ROLL_CONTRIBUTOR_CHECKSUM_FACT_KEY]: contributorChecksum,
          [DND5E_TEST_OUTCOME_RULE_FACT_KEY]: conditionOutcomeRules?.hitIsCritical
            ? 'HIT_IS_CRITICAL'
            : 'NONE'
        },
        d20RollMode: rollMode,
        d20Keep: DND5E_KEEP_BY_ROLL_MODE[rollMode],
        d20Roller: 'SOURCE',
        d20Audit: {
          contributors: allContributors,
          contributorChecksum,
          ...folded
        }
      }
    }
    const save = action.save
    // The cast of a condition that repeats a save (Power Word Stun) settles only that save's DC; the
    // target rolls nothing now.
    if (save && published.definition.outputs.castSaveDc) {
      if (typeof save.dc !== 'number' || !Number.isSafeInteger(save.dc))
        throw new Dnd5eEffectActionCompilerError('D&D save DC is unavailable.')
      return { facts: { ...baseFacts, [DND5E_SAVE_DC_FACT_KEY]: save.dc } }
    }
    if (save && typeof save.abilityDefinitionId === 'string' && typeof save.dc === 'number') {
      if (!Number.isSafeInteger(save.dc))
        throw new Dnd5eEffectActionCompilerError('D&D save DC is unavailable.')
      const targetSave = selectDnd5eTargetSavingThrow({
        savingThrowDefinitions: targetDerivedFacts.savingThrowDefinitions,
        abilityDefinitionId: save.abilityDefinitionId,
        conditionIds: Array.isArray(actionOutcomes)
          ? actionOutcomes.flatMap((outcome) => {
              const row = outcome as {
                kind?: unknown
                conditionId?: unknown
                damageTypeId?: unknown
                pathCode?: unknown
              } | null
              if (row?.kind === 'CONDITION' && typeof row.conditionId === 'string')
                return [row.conditionId]
              // A save whose failure deals poison damage is a save against poison.
              return row?.kind === 'DAMAGE' &&
                row.pathCode === 'ON_SAVE_FAIL' &&
                row.damageTypeId === DND5E_POISON_DAMAGE_TYPE_DEFINITION_ID
                ? [DND5E_POISONED_CONDITION_DEFINITION_ID]
                : []
            })
          : []
      })
      const { modifier, rollMode, contributors } = targetSave
      const contributorChecksum = checksumRuleDocument(contributors)
      const { addedDice, heldDice } = derivedSaveDice(targetDerivedFacts, save.abilityDefinitionId)
      const folded = foldD20Operands(foldedBonuses, modifier, save.dc, addedDice)
      return {
        facts: {
          ...baseFacts,
          ...dnd5eAddedDiceFacts(addedDice, true, heldDice),
          [DND5E_SAVE_MODIFIER_FACT_KEY]: folded.modifier,
          [DND5E_SAVE_DC_FACT_KEY]: folded.defenseOrDc,
          [DND5E_ROLL_CONTRIBUTOR_CHECKSUM_FACT_KEY]: contributorChecksum,
          ...saveOutcomeFact(conditionOutcomeRules, save.abilityDefinitionId)
        },
        d20RollMode: rollMode,
        d20Keep: DND5E_KEEP_BY_ROLL_MODE[rollMode],
        d20Roller: 'TARGET',
        d20Audit: {
          contributors,
          contributorChecksum,
          ...folded,
          ...saveAudit(conditionOutcomeRules, save.abilityDefinitionId)
        }
      }
    }
    return { facts: baseFacts }
  },
  bindActiveEffectFacts: ({
    activeEffectId,
    definition,
    lifecycle,
    targetActorId,
    targetDerivedFacts,
    targetConditionIds,
    conditionOutcomeRules,
    currentHitPoints,
    temporaryHitPoints,
    maximumHitPoints,
    targetScalarValues,
    defenses,
    conditionImmunityIds,
    perception,
    rollInfluence,
    onTrigger
  }) => {
    if (definition.frozenGraph.source.gameSystemId !== DND5E_SYSTEM_ID)
      throw new Dnd5eEffectActionCompilerError(
        'D&D active-effect graph belongs to another Game System.'
      )
    const baseFacts = {
      ...definition.adapterFacts,
      ...dnd5eAddedDiceFacts([]),
      [DND5E_TARGET_ACTOR_FACT_KEY]: targetActorId,
      [DND5E_TARGET_STATE_CHECKSUM_FACT_KEY]: checksumRuleDocument({
        targetActorId,
        currentHitPoints,
        temporaryHitPoints,
        maximumHitPoints,
        scalarValues: targetScalarValues,
        conditionIds: targetConditionIds
      }),
      ...conditionImmunityFacts(definition.frozenGraph, conditionImmunityIds),
      ...saveDamageMultiplierFacts(definition.frozenGraph, {
        abilityDefinitionId:
          definition.adapterFacts[DND5E_ACTIVE_EFFECT_SAVE_ABILITY_DEFINITION_FACT_KEY],
        incomingDamage: targetDerivedFacts.incomingDamage
      })
    }
    const abilityDefinitionId =
      definition.adapterFacts[DND5E_ACTIVE_EFFECT_SAVE_ABILITY_DEFINITION_FACT_KEY]
    const requestNodeId = definition.adapterFacts[DND5E_ACTIVE_EFFECT_SAVE_REQUEST_NODE_FACT_KEY]
    const dc = definition.adapterFacts[DND5E_SAVE_DC_FACT_KEY]
    const saveDc = typeof dc === 'number' && Number.isSafeInteger(dc) ? dc : null
    if (definition.recurrence.turnEndGate) return turnEndGateEvidenceBinding(definition, baseFacts)
    if (abilityDefinitionId === undefined && requestNodeId === undefined && dc === undefined) {
      return { facts: baseFacts, evidencePolicy: null }
    }
    if (
      typeof abilityDefinitionId !== 'string' ||
      !UUID.test(abilityDefinitionId) ||
      typeof requestNodeId !== 'string' ||
      requestNodeId.length === 0 ||
      saveDc === null
    ) {
      throw new Dnd5eEffectActionCompilerError(
        'D&D recurring save evidence policy is not fully pinned in the active-effect definition.'
      )
    }
    const savingThrowDefinitions = targetDerivedFacts.savingThrowDefinitions
    if (!Array.isArray(savingThrowDefinitions))
      throw new Dnd5eEffectActionCompilerError('D&D recurring save facts are unavailable.')
    const matches = savingThrowDefinitions.filter(
      (
        candidate
      ): candidate is {
        abilityDefinitionId: string
        modifier: number
        rollMode: 'NORMAL' | 'ADVANTAGE' | 'DISADVANTAGE'
        contributors: readonly ReceiptD20ContributorDto[]
      } =>
        typeof candidate === 'object' &&
        candidate !== null &&
        (candidate as { abilityDefinitionId?: unknown }).abilityDefinitionId ===
          abilityDefinitionId &&
        (candidate as { ruleDefinitionId?: unknown }).ruleDefinitionId === undefined &&
        (candidate as { conditionTypeId?: unknown }).conditionTypeId === undefined
    )
    if (
      matches.length !== 1 ||
      !Number.isSafeInteger(matches[0]!.modifier) ||
      !['NORMAL', 'ADVANTAGE', 'DISADVANTAGE'].includes(matches[0]!.rollMode)
    ) {
      throw new Dnd5eEffectActionCompilerError('D&D recurring save policy is unavailable.')
    }
    const contributors = matches[0]!.contributors
      .map(({ sourceId, grantId, domainKey, influence, source }) => ({
        sourceId,
        grantId,
        domainKey,
        influence,
        source
      }))
      .sort(compareCanonicalD20Contributors)
    if (
      contributors.some(
        (contributor) =>
          typeof contributor.sourceId !== 'string' ||
          contributor.sourceId.trim().length === 0 ||
          (contributor.grantId !== null &&
            (typeof contributor.grantId !== 'string' || contributor.grantId.trim().length === 0)) ||
          (contributor.domainKey !== null &&
            (typeof contributor.domainKey !== 'string' ||
              contributor.domainKey.trim().length === 0))
      )
    ) {
      throw new Dnd5eEffectActionCompilerError('D&D recurring save contributors are invalid.')
    }
    if (
      contributors.some((contributor, index) => {
        if (index === 0) return false
        const prior = contributors[index - 1]!
        return (
          prior.sourceId === contributor.sourceId &&
          prior.grantId === contributor.grantId &&
          prior.domainKey === contributor.domainKey &&
          prior.influence === contributor.influence
        )
      })
    ) {
      throw new Dnd5eEffectActionCompilerError('D&D recurring save contributors are not canonical.')
    }
    const perceptionRequirement =
      dnd5eCharacterRuleActionSystemAdapter.activeEffectPerceptionRequirement?.({
        definition,
        lifecycle
      })
    if (perceptionRequirement) {
      if (
        !perception ||
        perception.requirement !== perceptionRequirement.requirement ||
        !/^[a-f0-9]{64}$/.test(perception.checksum)
      ) {
        throw new Dnd5eEffectActionCompilerError(
          'D&D recurring perception facts are unavailable or stale.'
        )
      }
      if (perceptionRequirement.kind === 'ROLL_INFLUENCE' && perception.satisfied) {
        contributors.push({
          sourceId: createCharacterMechanicSourceKey({ kind: 'ACTIVE_EFFECT', activeEffectId }),
          grantId: null,
          domainKey: `perception:${perception.checksum}`,
          influence: perceptionRequirement.influence,
          source: { kind: 'ACTIVE_EFFECT', id: activeEffectId, holderActorId: null }
        })
        contributors.sort(compareCanonicalD20Contributors)
      }
    } else if (perception !== null && perception !== undefined) {
      throw new Dnd5eEffectActionCompilerError(
        'D&D active effect received an unbound perception result.'
      )
    }
    if (rollInfluence) {
      contributors.push({
        sourceId: createCharacterMechanicSourceKey({ kind: 'ACTIVE_EFFECT', activeEffectId }),
        grantId: null,
        domainKey: 'damage-repeat-save',
        influence: rollInfluence,
        source: { kind: 'ACTIVE_EFFECT', id: activeEffectId, holderActorId: null }
      })
      contributors.sort(compareCanonicalD20Contributors)
    }
    const contributorChecksum = checksumRuleDocument(contributors)
    const gate = perceptionRequirement?.kind === 'ATTEMPT_GATE' ? perceptionRequirement : null
    const gated = repeatSaveGated(definition.adapterFacts, definition.recurrence.saveThresholds)
    if (
      definition.frozenGraph.nodes.filter(
        (node) =>
          node.id === requestNodeId &&
          node.operation.key ===
            (gated ? 'evidence.optional-integer-range' : 'evidence.integer-range') &&
          node.operation.contractVersion === 1
      ).length !== 1
    ) {
      throw new Dnd5eEffectActionCompilerError('D&D recurring save request binding is invalid.')
    }
    const attemptAllowed = repeatSaveAttemptAllowed({
      adapterFacts: definition.adapterFacts,
      thresholds: definition.recurrence.saveThresholds,
      lifecycle,
      gateMet: !gate || perception?.satisfied === (gate.allow === 'WHEN_MET'),
      onTrigger
    })
    const successImmunity =
      definition.adapterFacts[DND5E_ACTIVE_EFFECT_SAVE_SUCCESS_IMMUNITY_FACT_KEY]
    // A zone that needs sight of its source is saved against unrolled by an occupant without it.
    const succeedsUnrolled =
      defenses.some(
        (defense) => defense.kind === 'IMMUNITY' && defense.damageTypeId === successImmunity
      ) || targetDerivedFacts[ZONE_SIGHT_REQUIREMENT_MET_FACT_KEY] === false
    const { addedDice, heldDice } = derivedSaveDice(targetDerivedFacts, abilityDefinitionId)
    const facts = {
      ...baseFacts,
      ...dnd5eAddedDiceFacts(addedDice, attemptAllowed, heldDice),
      [DND5E_SAVE_MODIFIER_FACT_KEY]: matches[0]!.modifier,
      [DND5E_ROLL_CONTRIBUTOR_CHECKSUM_FACT_KEY]: contributorChecksum,
      [DND5E_TEST_OUTCOME_RULE_FACT_KEY]: succeedsUnrolled
        ? 'SAVE_AUTO_SUCCESS'
        : dnd5eSaveOutcomeRule(conditionOutcomeRules, abilityDefinitionId),
      ...(gated ? { [DND5E_REPEAT_SAVE_ATTEMPT_ALLOWED_FACT_KEY]: attemptAllowed } : {})
    }
    // A refused attempt settles its d20 without a request, so no roll is asked for.
    if (!attemptAllowed) return { facts, evidencePolicy: null }
    return {
      facts,
      evidencePolicy: {
        requestNodeId,
        ...resolveDnd5eRollMode(contributors),
        contributors: [...contributors],
        contributorChecksum,
        modifier: matches[0]!.modifier,
        dc: saveDc,
        ...saveAudit(succeedsUnrolled ? null : conditionOutcomeRules, abilityDefinitionId),
        ...(addedDice.length > 0 ? { addedDice } : {})
      }
    }
  },
  preflightActiveEffectTargetProtection: ({ definition, targetDerivedFacts }) => {
    const protection = targetDerivedFacts.targetProtection as { status?: unknown } | undefined
    if (protection?.status !== 'NOT_NORMALIZED') return
    const protectionDependent = definition.frozenGraph.nodes.some(
      (node) =>
        node.operation.key === DND5E_DAMAGE_PROPOSAL_OPERATION_KEY ||
        node.operation.key === DND5E_TEST_DAMAGE_PROPOSAL_OPERATION_KEY ||
        node.operation.key === DND5E_CONDITION_APPLY_PROPOSAL_OPERATION_KEY ||
        node.operation.key === DND5E_TEST_CONDITION_PROPOSAL_OPERATION_KEY
    )
    if (protectionDependent) {
      throw new Dnd5eEffectActionCompilerError(
        'D&D active-effect target protections are not normalized.'
      )
    }
  },
  requiresConditionDefinitionValidation: ({ published }) =>
    published.definition.nodes.some(
      (node) =>
        node.operation.key === DND5E_CONDITION_APPLY_PROPOSAL_OPERATION_KEY ||
        node.operation.key === DND5E_TEST_CONDITION_PROPOSAL_OPERATION_KEY
    ),
  validateConditionDefinitions: ({ conditionDefinitionIds, published }) => {
    for (const node of published.definition.nodes) {
      if (
        node.operation.key !== DND5E_CONDITION_APPLY_PROPOSAL_OPERATION_KEY &&
        node.operation.key !== DND5E_TEST_CONDITION_PROPOSAL_OPERATION_KEY
      )
        continue
      const conditionId = node.inputs.conditionId
      if (
        !conditionId ||
        conditionId.kind !== 'LITERAL' ||
        typeof conditionId.value !== 'string' ||
        !UUID.test(conditionId.value) ||
        !conditionDefinitionIds.includes(conditionId.value)
      )
        throw new Dnd5eEffectActionCompilerError(
          'The committed D&D condition action is not in the pinned System vocabulary.'
        )
    }
  },
  interpret,
  interpretSaveSuccessReplacement: (input) => {
    const lifecycle = input.replacement.lifecycle
    if (
      lifecycle.interruptedStage !== 'AFTER_FAILED_SAVE_BEFORE_OUTCOME' ||
      lifecycle.replacement !== 'SAVE_SUCCESS' ||
      !UUID.test(lifecycle.definitionId) ||
      !UUID.test(lifecycle.choiceGraphDefinitionId) ||
      !Number.isSafeInteger(lifecycle.definitionVersion) ||
      lifecycle.definitionVersion < 1 ||
      !Number.isSafeInteger(lifecycle.choiceGraphDefinitionVersion) ||
      lifecycle.choiceGraphDefinitionVersion < 1 ||
      !/^[a-f0-9]{64}$/.test(lifecycle.definitionChecksum) ||
      !/^[a-f0-9]{64}$/.test(lifecycle.choiceGraphDefinitionChecksum) ||
      lifecycle.useOutput.length === 0
    ) {
      throw new Dnd5eEffectActionCompilerError(
        'The D&D Legendary Resistance lifecycle replacement is invalid.'
      )
    }
    const applications = testApplications(input, 'ON_SAVE_SUCCESS')
    if (!applications) {
      throw new Dnd5eEffectActionCompilerError(
        'A D&D Legendary Resistance replacement requires a completed saving throw.'
      )
    }
    return applications
  },
  interpretActiveEffect: ({
    execution,
    activeEffectId,
    definition,
    lifecycle,
    graph,
    ...target
  }) => {
    if (
      definition.authoredEffectId !== graph.source.definitionId ||
      definition.frozenGraph.source.checksum !== graph.source.checksum ||
      graph.source.gameSystemId !== DND5E_SYSTEM_ID
    )
      throw new Dnd5eEffectActionCompilerError('D&D active-effect execution source is invalid.')
    // A timed condition (D62.2) ends after the target's last counted turn.
    if (definition.adapterFacts[DND5E_ACTIVE_EFFECT_TIMED_CONDITION_FACT_KEY] === true) {
      const timedConditionIds = definition.stateContributions.flatMap((contribution) =>
        contribution.kind === 'CONDITION_OWNERSHIP' ? [contribution.conditionId] : []
      )
      if (timedConditionIds.length === 0 || !timedConditionIds.every((id) => UUID.test(id)))
        throw new Dnd5eEffectActionCompilerError('D&D timed condition identity is unavailable.')
      return lifecycle.remainingTicks === 1
        ? {
            applications: timedConditionIds.map((conditionId) => ({
              kind: 'CONDITION_REMOVE' as const,
              conditionId,
              sourceActiveEffectId: activeEffectId,
              targetActorId: target.targetActorId,
              sourceNodeId: definition.frozenGraphNodeId,
              sourceOperationKey: DND5E_CONDITION_DURATION_OPERATION_KEY,
              authoredPath: null,
              resolvedPath: null
            })),
            terminal: true
          }
        : { applications: [], terminal: false, emptyApplicationAllowed: true }
    }
    // A link, a creature form or a source immunity holds state for its duration: each counted turn
    // applies nothing, and the turn pass expires the effect after the last one.
    if (
      definition.stateContributions.some(
        ({ kind }) =>
          kind === 'ACTOR_LINK' ||
          kind === 'CREATURE_FORM' ||
          kind === 'PLAY_ABSENCE' ||
          kind === 'SOURCE_IMMUNITY'
      )
    )
      return { applications: [], terminal: false, emptyApplicationAllowed: true }
    const published = publishedDefinitionForFrozenGraph(graph)
    const repeatedSavePath = repeatedFollowUpSaveResultPath({
      execution,
      occurrenceId: target.occurrenceId,
      definition,
      graph,
      targetActorId: target.targetActorId
    })
    if (repeatedSavePath !== null) {
      // The gate's d20 only decides whether its child is made; the effect lasts out its duration.
      if (definition.recurrence.turnEndGate)
        return {
          applications: [],
          terminal: lifecycle.remainingTicks === 1,
          emptyApplicationAllowed: true
        }
      const conditionIds = repeatSaveConditionIds(definition.adapterFacts)
      const thresholds = definition.recurrence.saveThresholds
      const saveTally =
        thresholds && repeatedSavePath !== 'ATTEMPT_REFUSED'
          ? countRepeatSave(thresholds, lifecycle.saveTally, repeatedSavePath)
          : undefined
      // A failed or refused attempt on the last counted turn ends the effect with its duration. A
      // thresholds effect ends on its last success instead, and settles on its last failure.
      const terminal =
        (thresholds
          ? saveTally !== undefined && saveTally.successes >= thresholds.successesToEnd
          : repeatedSavePath === 'ON_SAVE_SUCCESS') || lifecycle.remainingTicks === 1
      // Grants held by the effect leave with it; only held conditions need removing.
      if (conditionIds === null)
        return {
          applications: [],
          terminal,
          emptyApplicationAllowed: true,
          ...(saveTally ? { saveTally } : {})
        }
      const escalationConditionId =
        definition.adapterFacts[DND5E_ACTIVE_EFFECT_REPEAT_SAVE_ESCALATION_CONDITION_FACT_KEY]
      if (
        escalationConditionId !== undefined &&
        (typeof escalationConditionId !== 'string' || !UUID.test(escalationConditionId))
      ) {
        throw new Dnd5eEffectActionCompilerError(
          'D&D repeat-save escalation condition identity is invalid.'
        )
      }
      const path = repeatedSavePath === 'ATTEMPT_REFUSED' ? null : repeatedSavePath
      const application = {
        sourceActiveEffectId: activeEffectId,
        targetActorId: target.targetActorId,
        sourceNodeId: definition.frozenGraphNodeId,
        sourceOperationKey: DND5E_SAVE_TEST_OPERATION_KEY,
        authoredPath: path,
        resolvedPath: path
      }
      return terminal
        ? {
            applications: [
              ...conditionIds.map((conditionId) => ({
                ...application,
                kind: 'CONDITION_REMOVE' as const,
                conditionId
              })),
              // A failed save leaves the escalated condition, unless the target cannot hold it.
              ...(escalationConditionId !== undefined &&
              repeatedSavePath === 'ON_SAVE_FAIL' &&
              !(target.conditionImmunityIds ?? []).includes(escalationConditionId)
                ? [
                    {
                      kind: 'CONDITION_APPLY' as const,
                      conditionId: escalationConditionId,
                      sourceNodeId: application.sourceNodeId,
                      sourceOperationKey: application.sourceOperationKey,
                      authoredPath: application.authoredPath,
                      resolvedPath: application.resolvedPath,
                      targetActorId: application.targetActorId
                    }
                  ]
                : [])
            ],
            terminal: true
          }
        : {
            applications: [],
            terminal: false,
            emptyApplicationAllowed: true,
            ...(saveTally ? { saveTally } : {})
          }
    }
    const resolvedTest = testApplications({
      execution,
      published,
      ...target
    })
    const applications =
      resolvedTest ??
      interpretDirect({ execution, ...target }, graph, {
        fullTrace: true
      })
    // A result path the graph authors no proposal for applies nothing (a zone failure that only
    // costs the Action, or a made save that deals no damage).
    const resultPath = execution.outputs.resultPath
    const unproposedPath =
      resolvedTest !== null &&
      typeof resultPath === 'string' &&
      !published.definition.nodes.some(({ id }) => id === `proposal-${resultPath.toLowerCase()}`)
    return {
      applications,
      terminal: false,
      ...(unproposedPath ? { emptyApplicationAllowed: true } : {})
    }
  }
}
