import { MAX_RULE_EXECUTION_AUTOMATIC_EVIDENCE_REQUESTS } from '@artificer-toolkit/schema/shared/ruleExecutionEvidence'
import {
  serverPublishedRuleDefinitionDtoSchema,
  type ServerPublishedRuleDefinitionDto
} from '@artificer-toolkit/schema/shared/ruleExecutionCore'
import type { ServerRuleExecutionResultDto } from '@artificer-toolkit/schema/shared/ruleExecutionProtocol'
import { resolveDispositionDamage } from '@artificer-toolkit/schema/shared/ruleExecutionMechanics'
import {
  attackKindSchema,
  pathLifecycleGrantConsumeEventSchema,
  pathLifecycleGrantEndEventSchema
} from '@artificer-toolkit/schema/shared/enums'
import {
  hitPointMaximumReductionRecoveryTagsSchema,
  type HitPointMaximumReductionRecoveryTag
} from '@artificer-toolkit/schema/effects/hitPointMaximumReduction'
import {
  compileModifierGrant,
  type CompiledDamageEffect,
  type CompiledDuration,
  type CompiledEffectGroup
} from '@artificer-toolkit/shared/compilers'
import { buildCharacterGrantFoldModifierFacts } from '../../character/characterGrantFoldSourceFacts.js'
import { abilityModifier } from './abilityModifier.js'
import type {
  ActorRelationshipAuthored,
  HitPointMaximumReductionAuthored
} from '@artificer-toolkit/shared/authored'
import {
  RULE_VALUE_KIND,
  addNumbersRuleOperation,
  type GameSystemRuleCapabilityContract,
  type ProposalRuleOperationContract,
  type PureRuleOperationContract,
  type CompiledRuleGraph,
  type RuleGraphDefinition,
  type RuleValue
} from '@artificer-toolkit/shared/rules'
import { parseRollExpression, type ParsedRollExpression } from '@artificer-toolkit/shared/rolls'
import { resolveD20Contributors } from '@artificer-toolkit/shared/rolls'
import { v5 as uuidv5 } from 'uuid'
import {
  checksumRuleDocument,
  compareCanonicalD20Contributors
} from '@artificer-toolkit/shared/rules'
import type { EffectActionCapabilityDescriptor } from '../../characterActionCapabilityDiscovery.js'
import type { CompiledActionCompilerSource } from '@artificer-toolkit/schema/projections/characterMechanics'
import type {
  CharacterRuleActionApplication,
  CharacterRuleActionSystemAdapter,
  CharacterRuleActionActiveEffectPlan,
  CharacterRuleActionConditionOutcomeRules,
  CharacterRuleActionPositionalFacts,
  CharacterRuleActionZonePlacementPlan,
  CharacterRuleActionSpatialDirective
} from '../../characterRuleActionSystemAdapter.js'
import type {
  GrantConsumeEvent,
  GrantEndEvent
} from '@artificer-toolkit/schema/shared/activeRuleEffects'
import { CharacterRuleActionUnsupportedCompilationError } from '../../characterRuleActionSystemAdapter.js'
import {
  chosenCreaturesAreaSupported,
  chosenCreaturesMaxTargets,
  encounterAreaTargetKind
} from '../../encounterAreaAction.js'
import { placedSpaceZone, zoneTriggerModes } from '../../encounterZonePlacement.js'
import { selectScalingRow } from '../../scalingRowSelection.js'
import {
  BASIC_ACTION_DEFINITION_FAMILY_KEY,
  CONDITION_RULE_STATE_DEFINITION_FAMILY_KEY,
  RULE_MAINTENANCE_DEFINITION_FAMILY_KEY,
  RULE_CAPABILITY_DEFINITION_FAMILY_KEY,
  SENSE_DEFINITION_FAMILY_KEY
} from '@artificer-toolkit/schema/shared/reusableDefinitionIdentity'
import {
  REACTION_CHOICE_MAX_FACT_KEY,
  REACTION_CHOICE_MIN_FACT_KEY,
  REACTION_CHOICE_OPERATION_KEY
} from '../../reactionChoiceDefinition.js'
import { dnd5eAttackKind, dnd5eAttackModifierDomain, isDnd5eMeleeAttackKind } from './attackKind.js'
import { DND5E_SYSTEM_ID } from './characterActionCapabilityDiscovery.js'
import {
  DND5E_POISON_DAMAGE_TYPE_DEFINITION_ID,
  DND5E_POISONED_CONDITION_DEFINITION_ID
} from './identity.js'
import { DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID } from './concentrationIdentity.js'
import { dnd5eConcentrationCapabilityContribution } from './concentrationPolicy.js'
import { dnd5eEncounterLifecycleCapabilityContribution } from './encounterLifecyclePolicy.js'
import { dnd5eInitiativeCapabilityContribution } from './initiativeFactAdapter.js'
import { dnd5eOptionalCombatContestCapabilityContribution } from './optionalCombatContestGraph.js'
import { dnd5eReactionEligibilityCapabilityContribution } from './reactionEligibilityPolicy.js'
import {
  resolveDnd5eFlankingContributor,
  resolveDnd5eFlankingParticipantCapabilityDefinitionIds
} from './flankingPolicy.js'
import {
  DND5E_ATTACK_TEST_OPERATION_KEY,
  DND5E_SAVE_TEST_OPERATION_KEY
} from './dnd5eTestOperationKeys.js'
import { DND5E_ADD_SPEED_TO_MOVEMENT_PROPOSAL_OPERATION_KEY } from './addSpeedToMovement.js'

export const DND5E_EFFECT_ACTION_FAMILY_KEY = 'effect-action'
const DND5E_HEAL_PROPOSAL_OPERATION_KEY = 'dnd5e.heal-proposal'
const DND5E_TEMPORARY_HIT_POINTS_PROPOSAL_OPERATION_KEY = 'dnd5e.temporary-hit-points-proposal'
export const DND5E_STABILIZE_PROPOSAL_OPERATION_KEY = 'dnd5e.stabilize-proposal'
const DND5E_MODIFIER_GRANT_PROPOSAL_OPERATION_KEY = 'dnd5e.modifier-grant-proposal'
const DND5E_MANUAL_ADJUDICATION_PROPOSAL_OPERATION_KEY = 'dnd5e.manual-adjudication-proposal'
export const DND5E_CONCEAL_PROPOSAL_OPERATION_KEY = 'dnd5e.conceal-proposal'
export const DND5E_DETECT_CONCEALED_PROPOSAL_OPERATION_KEY = 'dnd5e.detect-concealed-proposal'
export const DND5E_DAMAGE_PROPOSAL_OPERATION_KEY = 'dnd5e.damage-proposal'
const DND5E_HIT_POINT_MAXIMUM_REDUCTION_PROPOSAL_OPERATION_KEY =
  'dnd5e.hit-point-maximum-reduction-proposal'
const DND5E_SCALAR_REDUCTION_PROPOSAL_OPERATION_KEY = 'dnd5e.scalar-reduction-proposal'
const DND5E_FORCED_MOVEMENT_PROPOSAL_OPERATION_KEY = 'dnd5e.forced-movement-proposal'
const DND5E_DAMAGE_TOTAL_OPERATION_KEY = 'dnd5e.damage-total'
const DND5E_SAVE_DAMAGE_TOTAL_OPERATION_KEY = 'dnd5e.save-damage-total'
const DND5E_DAMAGE_MULTIPLIER_OPERATION_KEY = 'dnd5e.damage-multiplier'
const DND5E_HEAL_TOTAL_OPERATION_KEY = 'dnd5e.heal-total'
export const DND5E_CONDITION_APPLY_PROPOSAL_OPERATION_KEY = 'dnd5e.condition-apply-proposal'
const DND5E_MOVEMENT_INTERRUPTION_AUTHORIZATION_OPERATION_KEY =
  'dnd5e.movement-interruption-authorization'
const DND5E_ACTOR_RELATIONSHIP_STATE_OPERATION_KEY = 'dnd5e.actor-relationship-state'
const DND5E_CONDITION_DURATION_OPERATION_KEY = 'dnd5e.condition-duration'
const DND5E_EFFECT_ACTION_CAPABILITY_CONTRACT_VERSION = 1
/** The most target turns an Encounter active effect counts (its persisted tick bound). */
const MAX_ACTIVE_EFFECT_TURNS = 10_000
export const DND5E_TARGET_ACTOR_FACT_KEY = 'encounter.target-actor-id'
const DND5E_ATTACK_MODIFIER_FACT_KEY = 'dnd5e.attack-modifier'
const DND5E_TARGET_DEFENSE_FACT_KEY = 'dnd5e.target-defense'
export const DND5E_SAVE_MODIFIER_FACT_KEY = 'dnd5e.save-modifier'
export const DND5E_SAVE_DC_FACT_KEY = 'dnd5e.save-dc'
export const DND5E_ROLL_CONTRIBUTOR_CHECKSUM_FACT_KEY = 'dnd5e.roll-contributor-checksum'
/** The target's condition test-outcome rule (D94): `NONE`, `SAVE_AUTO_FAIL` or `HIT_IS_CRITICAL`. */
export const DND5E_TEST_OUTCOME_RULE_FACT_KEY = 'dnd5e.test-outcome-rule'
export const DND5E_TARGET_STATE_CHECKSUM_FACT_KEY = 'dnd5e.target-state-checksum'
export const DND5E_TARGET_CONDITION_IMMUNE_FACT_KEY = 'dnd5e.target-condition-immune'
const DND5E_CONDITION_IMMUNE_FACT_KEYS = {
  ON_USE: 'dnd5e.target-condition-immune.on-use',
  ON_HIT: 'dnd5e.target-condition-immune.on-hit',
  ON_MISS: 'dnd5e.target-condition-immune.on-miss',
  ON_CRIT: 'dnd5e.target-condition-immune.on-crit',
  ON_SAVE_FAIL: 'dnd5e.target-condition-immune.on-save-fail',
  ON_SAVE_SUCCESS: 'dnd5e.target-condition-immune.on-save-success'
} as const
/**
 * A result path may apply several conditions ("grappled, and restrained until the grapple ends"),
 * each with its own immunity fact: the path's key for the first, `<key>.<n>` for the n-th.
 */
const MAX_CONDITIONS_PER_PATH = 4
function conditionImmuneFactKey(pathCode: string, ordinal: number): string | undefined {
  const key =
    DND5E_CONDITION_IMMUNE_FACT_KEYS[pathCode as keyof typeof DND5E_CONDITION_IMMUNE_FACT_KEYS]
  if (!key || !Number.isSafeInteger(ordinal) || ordinal < 1 || ordinal > MAX_CONDITIONS_PER_PATH)
    return undefined
  return ordinal === 1 ? key : `${key}.${ordinal}`
}
/** Whether a condition node's immunity fact is one of its result path's keys. */
function isPathConditionImmuneFactKey(factKey: string, pathCode: string): boolean {
  return Array.from({ length: MAX_CONDITIONS_PER_PATH }, (_, index) =>
    conditionImmuneFactKey(pathCode, index + 1)
  ).includes(factKey)
}
export const DND5E_RESOLVED_DAMAGE_EXPRESSION_FACT_KEYS = {
  ON_USE: 'dnd5e.resolved-damage-expression.on-use',
  ON_HIT: 'dnd5e.resolved-damage-expression.on-hit',
  ON_MISS: 'dnd5e.resolved-damage-expression.on-miss',
  ON_CRIT: 'dnd5e.resolved-damage-expression.on-crit',
  ON_SAVE_FAIL: 'dnd5e.resolved-damage-expression.on-save-fail',
  ON_SAVE_SUCCESS: 'dnd5e.resolved-damage-expression.on-save-success'
} as const satisfies Record<SpecializedPath, string>
const DND5E_RESOLVED_DAMAGE_OUTCOME_EXPRESSIONS_FACT_KEY =
  'dnd5e.resolved-damage-outcome-expressions'
const DND5E_RESOLVED_HEAL_MODIFIER_FACT_KEY = 'dnd5e.resolved-heal-modifier'
/** The level a spell is cast at, which selects its authored per-level scaling. */
export const DND5E_SPELL_CAST_LEVEL_FACT_KEY = 'dnd5e.spell-cast-level'
/**
 * The optional on-hit riders the player chose for this attack (a JSON array of sorted rider effect
 * ids): an optional rider's merged entries resolve only when their rider is listed (D123).
 */
export const DND5E_SELECTED_OPTIONAL_RIDERS_FACT_KEY = 'dnd5e.selected-optional-riders'
/** The actor's level in each class (a JSON object by class id), which selects CLASS_LEVEL rows. */
const DND5E_CLASS_LEVELS_FACT_KEY = 'dnd5e.class-levels'
export const DND5E_ACTIVE_EFFECT_SAVE_ABILITY_DEFINITION_FACT_KEY =
  'dnd5e.active-effect-save-ability-definition-id'
export const DND5E_ACTIVE_EFFECT_SAVE_REQUEST_NODE_FACT_KEY =
  'dnd5e.active-effect-save-request-node-id'
const DND5E_ACTIVE_EFFECT_REPEAT_SAVE_CONDITION_FACT_KEY =
  'dnd5e.active-effect-repeat-save-condition-id'
const DND5E_ACTIVE_EFFECT_TIMED_CONDITION_FACT_KEY = 'dnd5e.active-effect-timed-condition-id'
const DND5E_ACTIVE_EFFECT_REPEAT_SAVE_ROLL_INFLUENCE_FACT_KEY =
  'dnd5e.active-effect-repeat-save-roll-influence'
const DND5E_ACTIVE_EFFECT_REPEAT_SAVE_PERCEPTION_REQUIREMENT_FACT_KEY =
  'dnd5e.active-effect-repeat-save-perception-requirement'
export { DND5E_SAVE_TEST_OPERATION_KEY }
const DND5E_TEST_HEAL_PROPOSAL_OPERATION_KEY = 'dnd5e.test-heal-proposal'
const DND5E_TEST_TEMPORARY_HIT_POINTS_PROPOSAL_OPERATION_KEY =
  'dnd5e.test-temporary-hit-points-proposal'
export const DND5E_TEST_DAMAGE_PROPOSAL_OPERATION_KEY = 'dnd5e.test-damage-proposal'
const DND5E_TEST_CONDITION_PROPOSAL_OPERATION_KEY = 'dnd5e.test-condition-proposal'
const DND5E_TEST_SCALAR_REDUCTION_PROPOSAL_OPERATION_KEY = 'dnd5e.test-scalar-reduction-proposal'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
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
function activeEffectGraphNodeId(compiledEntryId: string): string {
  return `active_effect_${compiledEntryId}`
}
class Dnd5eEffectActionCompilerError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'Dnd5eEffectActionCompilerError'
  }
}
type Outcome =
  | { kind: 'HEAL' | 'TEMPORARY_HIT_POINTS'; amount: number }
  | { kind: 'DAMAGE'; amount: number; damageTypeId: string }
  | { kind: 'CONDITION_APPLY'; conditionId: string }
  | { kind: 'STABILIZE' }
  | { kind: 'MODIFIER_GRANT' }
  | { kind: 'MANUAL_ADJUDICATION' }
  | { kind: 'CONCEAL' }
  | { kind: 'DETECT_CONCEALED' }
  | { kind: 'ADD_SPEED_TO_MOVEMENT' }
  | {
      kind: 'SCALAR_REDUCTION'
      amount: number
      valueDefinitionId: string
      recoveryTriggers: readonly ('SHORT_REST' | 'LONG_REST')[]
      terminalConsequence: 'TARGET_DIED'
    }
type SpecializedOutcome =
  | Outcome
  | { kind: 'DICE_DAMAGE'; damageTypeId: string }
  | { kind: 'DICE_HEAL'; temporary: boolean }
  | {
      kind: 'DICE_SCALAR_REDUCTION'
      diceConfig: string
      valueDefinitionId: string
      recoveryTriggers: readonly ('SHORT_REST' | 'LONG_REST')[]
      terminalConsequence: 'TARGET_DIED'
    }
type TestKind = 'ATTACK' | 'SAVE'
type SpecializedPath =
  | 'ON_USE'
  | 'ON_HIT'
  | 'ON_MISS'
  | 'ON_CRIT'
  | 'ON_SAVE_FAIL'
  | 'ON_SAVE_SUCCESS'

function isSpecializedPath(value: string): value is SpecializedPath {
  return ['ON_USE', 'ON_HIT', 'ON_MISS', 'ON_CRIT', 'ON_SAVE_FAIL', 'ON_SAVE_SUCCESS'].includes(
    value
  )
}

/** Server-derived facts only. They select an authored scaling row; they never alter graph topology. */
type Dnd5eEffectScalingFacts = Readonly<{
  characterLevel?: number
  parentClassLevel?: number
  spellCastLevel?: number
  classLevels?: Readonly<Record<string, number>>
  selectedOptionalRiderIds?: readonly string[]
  resolvedDamageExpressions?: Readonly<Partial<Record<SpecializedPath, string>>>
  resolvedDamageOutcomeExpressions?: Readonly<Record<string, string>>
}>

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

function dndScalingFactsFromRuleValues(
  facts: Readonly<Record<string, RuleValue>>
): Dnd5eEffectScalingFacts {
  const positiveInteger = (value: RuleValue | undefined): number | undefined =>
    typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : undefined
  return {
    characterLevel: positiveInteger(facts.characterLevel),
    parentClassLevel: positiveInteger(facts.parentClassLevel),
    spellCastLevel: positiveInteger(facts[DND5E_SPELL_CAST_LEVEL_FACT_KEY]),
    classLevels: parseClassLevels(facts[DND5E_CLASS_LEVELS_FACT_KEY]),
    selectedOptionalRiderIds: parseSelectedOptionalRiderIds(
      facts[DND5E_SELECTED_OPTIONAL_RIDERS_FACT_KEY]
    ),
    resolvedDamageExpressions: Object.fromEntries(
      Object.entries(DND5E_RESOLVED_DAMAGE_EXPRESSION_FACT_KEYS).flatMap(([path, key]) => {
        const expression = facts[key]
        return typeof expression === 'string' ? [[path, expression]] : []
      })
    ),
    resolvedDamageOutcomeExpressions: parseResolvedOutcomeExpressions(
      facts[DND5E_RESOLVED_DAMAGE_OUTCOME_EXPRESSIONS_FACT_KEY]
    )
  }
}

function parseSelectedOptionalRiderIds(value: RuleValue | undefined): readonly string[] {
  if (value === undefined) return []
  let parsed: unknown
  try {
    parsed = typeof value === 'string' ? JSON.parse(value) : undefined
  } catch {
    parsed = undefined
  }
  if (!Array.isArray(parsed) || !parsed.every((id) => typeof id === 'string'))
    unsupported('D&D selected optional riders are malformed.')
  return parsed
}

function parseClassLevels(value: RuleValue | undefined): Record<string, number> {
  if (value === undefined) return {}
  if (typeof value !== 'string') unsupported('D&D class levels are malformed.')
  let parsed: unknown
  try {
    parsed = JSON.parse(value)
  } catch {
    unsupported('D&D class levels are malformed.')
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    unsupported('D&D class levels are malformed.')
  }
  const entries = Object.entries(parsed)
  if (
    entries.length > 40 ||
    entries.some(
      ([classId, level]) =>
        classId.length === 0 ||
        classId.length > 240 ||
        typeof level !== 'number' ||
        !Number.isSafeInteger(level) ||
        level < 1
    )
  ) {
    unsupported('D&D class levels are malformed.')
  }
  return Object.fromEntries(entries)
}

function parseResolvedOutcomeExpressions(value: RuleValue | undefined): Record<string, string> {
  if (value === undefined) return {}
  if (typeof value !== 'string') unsupported('D&D resolved outcome expressions are malformed.')
  let parsed: unknown
  try {
    parsed = JSON.parse(value)
  } catch {
    unsupported('D&D resolved outcome expressions are malformed.')
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    unsupported('D&D resolved outcome expressions are malformed.')
  }
  const entries = Object.entries(parsed)
  if (
    entries.length > 1_000 ||
    entries.some(
      ([outcomeId, expression]) =>
        outcomeId.length === 0 || outcomeId.length > 240 || typeof expression !== 'string'
    )
  ) {
    unsupported('D&D resolved outcome expressions are malformed.')
  }
  return Object.fromEntries(entries.sort(([left], [right]) => left.localeCompare(right)))
}

/**
 * Resolves the bounded Creature-only `XdY + ability modifier` source form
 * from immutable stat-block facts.  This happens while facts are bound under
 * the Encounter lock; the authored outcome still owns every die, bonus, and
 * bound.  Character callers continue to supply their already-resolved
 * expressions through their policy output.
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
  const bonuses = input.outcome.bonuses
  if (!Array.isArray(bonuses) || bonuses.length === 0) return dice
  const statBlock = input.sourceDerivedFacts.statBlock
  const abilityScores =
    statBlock && typeof statBlock === 'object' && !Array.isArray(statBlock)
      ? (statBlock as { abilityScores?: unknown }).abilityScores
      : null
  if (!abilityScores || typeof abilityScores !== 'object' || Array.isArray(abilityScores))
    return null
  let modifier = 0
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
/** Exact compiled-effect input shared by runtime publication and source manifest admission. */
type Dnd5eCompiledEffectActionSource = Pick<
  EffectActionCapabilityDescriptor,
  | 'gameSystemId'
  | 'entryPointDefinitionId'
  | 'effectId'
  | 'conditionDefinitionIds'
  | 'savingThrowAbilityDefinitionId'
  | 'compiledEffect'
  | 'spellCastLevel'
>
interface TestPlan {
  kind: TestKind
  branches: ReadonlyMap<string, Outcome>
}

function testPhaseKindOrNull(action: Dnd5eCompiledEffectActionSource): TestKind | null {
  const trigger = action.compiledEffect.invocation.triggerCode
  if (dnd5eAttackKind(trigger) !== null) return 'ATTACK'
  return trigger === 'SAVING_THROW' ? 'SAVE' : null
}

/**
 * Outcomes a test action leaves to its active-effect plan rather than its TEST/OUTCOME graphs: an
 * actor relationship, and a grant an attack's hit applies (Shocking Grasp's "can't take reactions").
 */
function isActiveEffectPlanOutcome(entry: CompiledEffectGroup['entries'][number]): boolean {
  if (!('outcome' in entry)) return false
  return (
    entry.outcome.effectKind === 'ACTOR_RELATIONSHIP' ||
    (entry.outcome.effectKind === 'APPLY_GRANT' &&
      (entry.pathCode === 'ON_HIT' || entry.pathCode === 'ON_CRIT'))
  )
}

function isSupportedTestActivation(
  invocation: Dnd5eCompiledEffectActionSource['compiledEffect']['invocation']
): boolean {
  if (invocation.kind !== 'ACTION') return false
  if (invocation.activation.code === 'FREE') return false
  if (invocation.activation.amount !== 1) return false
  if (invocation.activation.code === 'ACTION') return true
  return (
    invocation.activation.code === 'REACTION' &&
    'reactionTrigger' in invocation &&
    invocation.reactionTrigger?.kind === 'MOVEMENT'
  )
}

/**
 * An AREA_CONTENTS save action over a fixed-size area. Either a sphere, cylinder, circle or cube
 * centered on a point within a distance (or unlimited), or a cone, line or cube that extends from
 * the caster (a Self range). Walls, domes, a Self sphere, Touch origins and breakpoint-scaled sizes
 * stay refused. The area only decides who is caught: each caught creature runs the same
 * per-creature test plan a single target does.
 */
function isSupportedTestArea(
  invocation: Dnd5eCompiledEffectActionSource['compiledEffect']['invocation']
): boolean {
  if (invocation.kind !== 'ACTION') return false
  const { shape, targeting, range } = invocation
  if (
    !shape ||
    targeting?.selectionKind !== 'AREA_CONTENTS' ||
    targeting.dispositionKind !== 'ANY' ||
    targeting.excludedCreatureTypeIds?.length ||
    invocation.triggerCode !== 'SAVING_THROW' ||
    invocation.activation.code !== 'ACTION' ||
    invocation.activation.amount !== 1
  )
    return false
  if (encounterAreaTargetKind(range.rangeKind, shape.shapeKind) === null) return false
  if (range.rangeKind !== 'SELF' && range.rangeKind !== 'UNLIMITED') {
    if (
      range.rangeKind !== 'DISTANCE' ||
      !Number.isSafeInteger(range.amount) ||
      range.amount < 1 ||
      range.longAmount !== undefined
    )
      return false
  }
  const size =
    shape.shapeKind === 'CUBE'
      ? shape.edgeLength
      : shape.shapeKind === 'CONE' || shape.shapeKind === 'LINE'
        ? shape.length
        : shape.shapeKind === 'SPHERE' ||
            shape.shapeKind === 'CYLINDER' ||
            shape.shapeKind === 'CIRCLE'
          ? shape.radius
          : null
  return (
    size !== null &&
    size.scaling === undefined &&
    size.amount > 0 &&
    !(
      shape.shapeKind === 'LINE' &&
      shape.width !== undefined &&
      (shape.width.scaling !== undefined || !(shape.width.amount > 0))
    ) &&
    !(shape.shapeKind === 'CYLINDER' && shape.height.scaling !== undefined)
  )
}

function isSupportedTestTargetPolicy(
  invocation: Dnd5eCompiledEffectActionSource['compiledEffect']['invocation']
): boolean {
  if (invocation.kind !== 'ACTION') return false
  if (invocation.targeting?.selectionKind === 'AREA_CONTENTS')
    return isSupportedTestArea(invocation)
  if (invocation.shape) return false
  if (
    invocation.targeting?.selectionKind !== 'SINGLE_TARGET' ||
    invocation.targeting.dispositionKind !== 'ANY'
  ) {
    return false
  }
  const attackKind = dnd5eAttackKind(invocation.triggerCode)
  // Only a ranged weapon attack has a long range ("range 80/320 ft.").
  if (
    invocation.range.rangeKind === 'DISTANCE' &&
    invocation.range.longAmount !== undefined &&
    (attackKind !== 'RANGED' || !Number.isSafeInteger(invocation.range.longAmount))
  )
    return false
  if (invocation.activation.code === 'ACTION') {
    // A melee attack may reach 0 ft.: a swarm's "one target in the swarm's space".
    const minimumDistance = isDnd5eMeleeAttackKind(attackKind) ? 0 : 1
    return (
      invocation.range.rangeKind === 'UNLIMITED' ||
      invocation.range.rangeKind === 'TOUCH' ||
      (invocation.range.rangeKind === 'DISTANCE' &&
        Number.isSafeInteger(invocation.range.amount) &&
        invocation.range.amount >= minimumDistance)
    )
  }
  return (
    invocation.activation.code === 'REACTION' &&
    invocation.range.rangeKind === 'DISTANCE' &&
    Number.isSafeInteger(invocation.range.amount) &&
    invocation.range.amount > 0
  )
}
/** A damage type left unresolved (the triggering weapon's, never merged) is not a UUID. */
function isUuid(value: string | undefined): value is string {
  return value !== undefined && UUID.test(value)
}

function uuid(value: string | undefined, label: string): asserts value is string {
  if (!isUuid(value)) throw new Dnd5eEffectActionCompilerError(`${label} must be a canonical UUID.`)
}

function damageTypeIdentity(damageTypeId: string | undefined): string {
  uuid(damageTypeId, 'D&D damage type identity')
  return damageTypeId
}

function unsupported(message: string): never {
  throw new CharacterRuleActionUnsupportedCompilationError(message)
}

/**
 * The source actor's maintained effect (Concentration) an action starts: the one its result block
 * names, else Concentration when the spell it belongs to requires it.
 */
function maintenancePlan(
  action: Dnd5eCompiledEffectActionSource,
  entry: CompiledEffectGroup['entries'][number]
): CharacterRuleActionActiveEffectPlan['maintenance'] {
  const definitionId =
    ('maintenanceDefinitionId' in entry ? entry.maintenanceDefinitionId : undefined) ??
    (action.compiledEffect.requiresConcentration
      ? DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID
      : undefined)
  if (!definitionId) return null
  uuid(definitionId, 'D&D maintenance definition identity')
  return {
    definitionId,
    definitionChecksum: null,
    owner: 'SOURCE_ACTOR',
    replacementPolicy: 'REPLACE_SAME_DEFINITION',
    emptyDependentPolicy: 'TERMINATE_WHEN_EMPTY'
  }
}

/**
 * How an active effect's repeated save pins its DC: an exact fixed DC is stored in the plan, while
 * the caster's save DC is only known once the action is cast and is stored then, under the same fact.
 * Null for any other way of setting a DC.
 */
function pinnedSaveDc(
  savingThrow: { dcMethod: string; baseDc?: number } | undefined
): Pick<CharacterRuleActionActiveEffectPlan, 'adapterFacts' | 'castSaveDcFactKey'> | null {
  if (savingThrow?.dcMethod === 'SOURCE_SAVE_DC')
    return { adapterFacts: {}, castSaveDcFactKey: DND5E_SAVE_DC_FACT_KEY }
  if (savingThrow?.dcMethod === 'FIXED_DC' && Number.isSafeInteger(savingThrow.baseDc))
    return {
      adapterFacts: { [DND5E_SAVE_DC_FACT_KEY]: savingThrow.baseDc! },
      castSaveDcFactKey: null
    }
  return null
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
    (lifecycle.consumeOnFirstEvents?.length ?? 0) === 0 &&
    (lifecycle.endOnEvents?.length ?? 0) === 0 &&
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
    const pinnedDc = pinnedSaveDc(invocation.savingThrow)
    if (
      !action.savingThrowAbilityDefinitionId ||
      !UUID.test(action.savingThrowAbilityDefinitionId) ||
      pinnedDc === null
    ) {
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
      adapterFacts: {
        [DND5E_ACTIVE_EFFECT_SAVE_ABILITY_DEFINITION_FACT_KEY]:
          action.savingThrowAbilityDefinitionId,
        ...pinnedDc.adapterFacts,
        [DND5E_ACTIVE_EFFECT_SAVE_REQUEST_NODE_FACT_KEY]: 'd20'
      },
      castSaveDcFactKey: pinnedDc.castSaveDcFactKey,
      perceptionContributions: [],
      maintenance
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
    maintenance
  }
}

function relationshipPlan(action: Dnd5eCompiledEffectActionSource):
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
  if (
    action.compiledEffect.invocation.kind !== 'ACTION' ||
    testPhaseKindOrNull(action) !== 'ATTACK' ||
    entry.resolutionKind !== 'DIRECT' ||
    (entry.groupKind !== 'SINGLE' && entry.groupKind !== 'SEQUENTIAL') ||
    (entry.pathCode !== 'ON_HIT' && entry.pathCode !== 'ON_CRIT') ||
    !UUID.test(relationship.id)
  ) {
    unsupported('D&D relationship outcomes require one bounded attack-hit result.')
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
  const recurrence = relationship.recurrence
  if (
    recurrence &&
    (recurrence.stage !== 'START_OF_TURN' ||
      recurrence.damage.effectKind !== 'DAMAGE' ||
      recurrence.damage.valueKind !== 'DICE' ||
      recurrence.damage.scalingKind !== 'NONE' ||
      recurrence.damage.bonuses?.length ||
      !UUID.test(recurrence.damage.id) ||
      !isUuid(recurrence.damage.damageTypeId) ||
      typeof recurrence.damage.diceConfig !== 'string')
  ) {
    unsupported('D&D relationship recurrence must be one exact start-of-turn damage outcome.')
  }
  const frozenGraph = recurrence
    ? relationshipRecurrenceGraph({
        action,
        relationship,
        modules,
        recurrenceDamage: recurrence.damage
      })
    : relationshipStateGraph({ action, relationship })
  return {
    authoredEffectId: action.effectId,
    compiledEntryId: relationship.id,
    frozenGraphNodeId: recurrence ? 'relationship-recurrence' : 'relationship-state',
    frozenGraph,
    capabilityContractVersion: DND5E_EFFECT_ACTION_CAPABILITY_CONTRACT_VERSION,
    recurrenceStage: recurrence ? 'START_OF_TURN' : 'NONE',
    initialRemaining: null,
    actorRelationshipContribution: {
      relationshipOutcomeId: relationship.id,
      heldAtOnce: relationship.heldAtOnce,
      modules,
      conditionIds,
      capabilitySuppressions
    },
    adapterFacts: { 'dnd5e.relationship-authored-path': entry.pathCode },
    perceptionContributions: [],
    maintenance: null
  }
}

function relationshipStateGraph(input: {
  action: Dnd5eCompiledEffectActionSource
  relationship: ActorRelationshipAuthored
}): ServerPublishedRuleDefinitionDto {
  const definition: RuleGraphDefinition = {
    schemaVersion: 1,
    id: input.action.effectId,
    gameSystemId: DND5E_SYSTEM_ID,
    definitionFamilyKey: DND5E_EFFECT_ACTION_FAMILY_KEY,
    nodes: [
      {
        id: 'relationship-state',
        operation: {
          key: DND5E_ACTOR_RELATIONSHIP_STATE_OPERATION_KEY,
          contractVersion: 1
        },
        inputs: {}
      }
    ],
    outputs: {
      relationshipOutcomeId: { kind: 'LITERAL', value: input.relationship.id }
    },
    sourceEntryBindings: [{ sourceEntryId: input.relationship.id, nodeId: 'relationship-state' }]
  }
  return serverPublishedRuleDefinitionDtoSchema.parse({
    id: definition.id,
    gameSystemId: definition.gameSystemId,
    definitionFamilyKey: definition.definitionFamilyKey,
    checksum: checksumRuleDocument(definition),
    definition
  })
}

function relationshipRecurrenceGraph(input: {
  action: Dnd5eCompiledEffectActionSource
  relationship: ActorRelationshipAuthored
  modules: readonly ActorRelationshipAuthored['modules'][number][]
  recurrenceDamage: NonNullable<ActorRelationshipAuthored['recurrence']>['damage']
}): ServerPublishedRuleDefinitionDto {
  if (!('diceConfig' in input.recurrenceDamage))
    unsupported('D&D relationship recurrence dice are unavailable.')
  const parsed = parseBoundedDiceConfiguration(input.recurrenceDamage.diceConfig!)
  const term = parsed.terms[0]
  if (
    !term ||
    parsed.terms.length !== 1 ||
    term.reroll ||
    term.selection ||
    term.count < 1 ||
    term.count > 31 ||
    term.die < 2 ||
    term.die > 1000
  )
    unsupported('D&D relationship recurrence dice exceed the bounded exact-dice contract.')
  const dice = Array.from({ length: term.count }, (_, index) => ({
    id: `relationship-die-${index + 1}`,
    operation: { key: 'evidence.integer-range', contractVersion: 1 },
    inputs: {
      min: { kind: 'LITERAL' as const, value: 1 },
      max: { kind: 'LITERAL' as const, value: term.die }
    }
  }))
  const sums = Array.from({ length: Math.max(0, term.count - 1) }, (_, index) => ({
    id: `relationship-sum-${index + 1}`,
    operation: {
      key: addNumbersRuleOperation.key,
      contractVersion: addNumbersRuleOperation.contractVersion
    },
    inputs: {
      left:
        index === 0
          ? {
              kind: 'NODE_OUTPUT' as const,
              nodeId: 'relationship-die-1',
              port: 'value'
            }
          : {
              kind: 'NODE_OUTPUT' as const,
              nodeId: `relationship-sum-${index}`,
              port: 'value'
            },
      right: {
        kind: 'NODE_OUTPUT' as const,
        nodeId: `relationship-die-${index + 2}`,
        port: 'value'
      }
    }
  }))
  const subtotal =
    term.count === 1
      ? {
          kind: 'NODE_OUTPUT' as const,
          nodeId: 'relationship-die-1',
          port: 'value'
        }
      : {
          kind: 'NODE_OUTPUT' as const,
          nodeId: `relationship-sum-${term.count - 1}`,
          port: 'value'
        }
  const amount =
    parsed.modifier === 0
      ? subtotal
      : {
          kind: 'NODE_OUTPUT' as const,
          nodeId: 'relationship-damage-total',
          port: 'value'
        }
  const definition: RuleGraphDefinition = {
    schemaVersion: 1,
    id: input.action.effectId,
    gameSystemId: DND5E_SYSTEM_ID,
    definitionFamilyKey: DND5E_EFFECT_ACTION_FAMILY_KEY,
    nodes: [
      ...dice,
      ...sums,
      ...(parsed.modifier === 0
        ? []
        : [
            {
              id: 'relationship-damage-total',
              operation: {
                key: DND5E_DAMAGE_TOTAL_OPERATION_KEY,
                contractVersion: 1
              },
              inputs: {
                subtotal,
                modifier: { kind: 'LITERAL' as const, value: parsed.modifier }
              }
            }
          ]),
      {
        id: 'relationship-recurrence',
        operation: {
          key: DND5E_DAMAGE_PROPOSAL_OPERATION_KEY,
          contractVersion: 1
        },
        inputs: {
          targetActorId: { kind: 'FACT', factKey: DND5E_TARGET_ACTOR_FACT_KEY },
          targetStateChecksum: {
            kind: 'FACT',
            factKey: DND5E_TARGET_STATE_CHECKSUM_FACT_KEY
          },
          amount,
          damageTypeId: {
            kind: 'LITERAL',
            value: damageTypeIdentity(input.recurrenceDamage.damageTypeId)
          }
        }
      }
    ],
    outputs: {
      targetActorId: {
        kind: 'NODE_OUTPUT',
        nodeId: 'relationship-recurrence',
        port: 'targetActorId'
      },
      amount: {
        kind: 'NODE_OUTPUT',
        nodeId: 'relationship-recurrence',
        port: 'amount'
      },
      damageTypeId: {
        kind: 'NODE_OUTPUT',
        nodeId: 'relationship-recurrence',
        port: 'damageTypeId'
      }
    },
    sourceEntryBindings: [
      {
        sourceEntryId: input.relationship.id,
        nodeId: 'relationship-recurrence'
      }
    ]
  }
  void input.modules
  return serverPublishedRuleDefinitionDtoSchema.parse({
    id: definition.id,
    gameSystemId: definition.gameSystemId,
    definitionFamilyKey: definition.definitionFamilyKey,
    checksum: checksumRuleDocument(definition),
    definition
  })
}

/**
 * The factor an authored damage outcome scales its total by: its `multiplier` (the monster
 * vocabulary for half on a successful save) times its `amountKind` (the spell vocabulary: HALF is
 * 0.5, DOUBLE is 2). Every compiled damage amount reads it, so both vocabularies compile alike.
 */
function damageMultiplier(outcome: {
  amountKind?: 'FULL' | 'HALF' | 'DOUBLE'
  multiplier?: number
}): number {
  const kind = outcome.amountKind === 'HALF' ? 0.5 : outcome.amountKind === 'DOUBLE' ? 2 : 1
  return (outcome.multiplier ?? 1) * kind
}

/** An authored damage multiplier (for example half on a successful save), rounded down. */
function multipliedDamageAmount(amount: number, multiplier: number): number {
  const value = Math.floor(amount * multiplier)
  if (!Number.isFinite(multiplier) || multiplier < 0 || !Number.isSafeInteger(value))
    throw new Dnd5eEffectActionCompilerError(
      'D&D damage multiplier must be a finite nonnegative number.'
    )
  return value
}

function boundedTestOutcome(entry: CompiledEffectGroup['entries'][number]): Outcome {
  if (!('outcome' in entry)) unsupported('D&D test actions require direct authored outcomes.')
  const outcome = entry.outcome
  if (outcome.effectKind === 'CONDITION') {
    uuid(outcome.conditionId, 'D&D condition definition identity')
    return { kind: 'CONDITION_APPLY', conditionId: outcome.conditionId }
  }
  if (outcome.effectKind === 'SCALAR_REDUCTION') {
    uuid(outcome.valueDefinitionId, 'D&D scalar definition identity')
    return {
      kind: 'SCALAR_REDUCTION',
      amount: 1,
      valueDefinitionId: outcome.valueDefinitionId,
      recoveryTriggers: outcome.recoveryTriggers,
      terminalConsequence: outcome.terminalConsequence
    }
  }
  if (outcome.effectKind !== 'HEAL' && outcome.effectKind !== 'DAMAGE')
    unsupported('D&D test action outcome is not supported.')
  if (
    outcome.valueKind !== 'FIXED' ||
    outcome.scalingKind !== 'NONE' ||
    outcome.bonuses?.length ||
    !Number.isSafeInteger(outcome.amount) ||
    outcome.amount <= 0
  )
    unsupported('D&D test action outcomes must use positive safe fixed amounts.')
  if (outcome.effectKind === 'HEAL')
    return {
      kind: outcome.temporary ? 'TEMPORARY_HIT_POINTS' : 'HEAL',
      amount: outcome.amount
    }
  uuid(outcome.damageTypeId, 'D&D damage type identity')
  return {
    kind: 'DAMAGE',
    amount: multipliedDamageAmount(outcome.amount, damageMultiplier(outcome)),
    damageTypeId: outcome.damageTypeId
  }
}

/**
 * TEST/OUTCOME actions select exactly one authored result group.  The TEST
 * phase must therefore reject every reachable result that the bounded
 * OUTCOME compiler cannot construct, rather than quietly retaining the old
 * all-branches graph.
 */
function specializedTestOutcome(entry: CompiledEffectGroup['entries'][number]): SpecializedOutcome {
  if (!('outcome' in entry)) unsupported('D&D test actions require direct authored outcomes.')
  const outcome = entry.outcome
  if (outcome.effectKind === 'SCALAR_REDUCTION') {
    uuid(outcome.valueDefinitionId, 'D&D scalar definition identity')
    parseBoundedDiceConfiguration(outcome.amount.diceConfig)
    return {
      kind: 'DICE_SCALAR_REDUCTION',
      diceConfig: outcome.amount.diceConfig,
      valueDefinitionId: outcome.valueDefinitionId,
      recoveryTriggers: outcome.recoveryTriggers,
      terminalConsequence: outcome.terminalConsequence
    }
  }
  if (outcome.effectKind === 'DAMAGE' && outcome.valueKind === 'DICE') {
    if (
      outcome.scalingKind === 'NONE' &&
      !outcome.bonuses?.length &&
      typeof outcome.dice === 'string' &&
      /^[1-9]\d*$/.test(outcome.dice)
    ) {
      const amount = Number(outcome.dice)
      if (!Number.isSafeInteger(amount))
        unsupported('D&D fixed damage amount exceeds the safe integer contract.')
      uuid(outcome.damageTypeId, 'D&D damage type identity')
      return {
        kind: 'DAMAGE',
        amount: multipliedDamageAmount(amount, damageMultiplier(outcome)),
        damageTypeId: outcome.damageTypeId
      }
    }
    validateDiceOutcomeRow(outcome)
    uuid(outcome.damageTypeId, 'D&D damage type identity')
    return { kind: 'DICE_DAMAGE', damageTypeId: outcome.damageTypeId }
  }
  if (outcome.effectKind === 'HEAL' && outcome.valueKind === 'DICE') {
    if (outcome.scalingKind !== 'NONE')
      unsupported('D&D dice healing requires one unscaled authored value.')
    parseBoundedDiceConfiguration(outcome.diceConfig)
    validateHealBonuses(outcome.bonuses)
    return { kind: 'DICE_HEAL', temporary: outcome.temporary ?? false }
  }
  return boundedTestOutcome(entry)
}

/**
 * The only nested save admitted by this direct-action compiler. It stays in
 * the selected attack OUTCOME so it cannot become an independently invoked
 * action or a delayed workflow.
 */
type ImmediateFollowUpSaveShape =
  | 'FULL_OR_HALF_DAMAGE'
  | 'STATE_ONLY_REDUCTION'
  | 'FORCED_MOVEMENT_ONLY'
  | 'CONDITION_ON_FAILURE'
  | 'DAMAGE_ON_FAILURE'
  | 'REPEATING_CONDITION'

type ImmediatePrimaryDamageEntry = CompiledEffectGroup['entries'][number] & {
  resultBlockId: string
  outcome: Extract<
    Extract<CompiledEffectGroup['entries'][number], { outcome: unknown }>['outcome'],
    { effectKind: 'DAMAGE' }
  >
}
type ImmediateSaveEntry = CompiledEffectGroup['entries'][number] & {
  resultBlockId: string
  outcome: Extract<
    Extract<CompiledEffectGroup['entries'][number], { outcome: unknown }>['outcome'],
    { effectKind: 'FOLLOW_UP_SAVE' }
  >
}

function immediateFollowUpSaveEntries(entries: readonly CompiledEffectGroup['entries'][number][]): {
  primaryDamageEntries: readonly ImmediatePrimaryDamageEntry[]
  saveEntry: ImmediateSaveEntry
} | null {
  const saveEntry = entries.at(-1)
  const primaryDamageEntries = entries.slice(0, -1)
  if (!saveEntry || primaryDamageEntries.length === 0) return null
  if (!('resultBlockId' in saveEntry) || !('outcome' in saveEntry)) return null
  const resultBlockId = saveEntry.resultBlockId
  if (
    saveEntry.resolutionKind !== 'DIRECT' ||
    saveEntry.groupKind !== 'SEQUENTIAL' ||
    saveEntry.pathCode !== 'ON_HIT' ||
    saveEntry.outcome.effectKind !== 'FOLLOW_UP_SAVE'
  ) {
    return null
  }
  const primary = [] as ImmediatePrimaryDamageEntry[]
  for (const entry of primaryDamageEntries) {
    if (!('resultBlockId' in entry) || !('outcome' in entry)) return null
    const outcome = entry.outcome
    if (
      entry.resolutionKind !== 'DIRECT' ||
      entry.groupKind !== 'SEQUENTIAL' ||
      entry.pathCode !== 'ON_HIT' ||
      entry.resultBlockId !== resultBlockId ||
      outcome.effectKind !== 'DAMAGE' ||
      primaryDamageDiceCount(outcome) === null ||
      !UUID.test(entry.entryId) ||
      !isUuid(outcome.damageTypeId)
    ) {
      return null
    }
    primary.push(entry as ImmediatePrimaryDamageEntry)
  }
  return {
    primaryDamageEntries: primary,
    saveEntry: saveEntry as ImmediateSaveEntry
  }
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
  const pinnedDc = pinnedSaveDc(save.savingThrow)
  if (
    save.timing !== 'IMMEDIATE' ||
    save.repeatTiming !== 'TARGET_TURN_END' ||
    save.attempts.kind !== 'ONCE' ||
    save.attempts.repeatOnFailure !== true ||
    !pinnedDc ||
    !UUID.test(save.savingThrow.abilityDefinitionId) ||
    save.onSuccess.kind !== 'END' ||
    save.onFailure.kind !== 'OUTCOMES' ||
    (save.onDurationComplete !== undefined && save.onDurationComplete.kind !== 'END')
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
  const duration = immediateFollowUpSaveDuration(action)
  const initialRemaining = duration ? conditionDurationTurns(duration) : null
  if (duration && initialRemaining === null) return null
  return {
    authoredEffectId: action.effectId,
    compiledEntryId: saveEntry.resultBlockId,
    frozenGraphNodeId: 'repeat-save-test',
    capabilityContractVersion: DND5E_EFFECT_ACTION_CAPABILITY_CONTRACT_VERSION,
    recurrenceStage: 'END_OF_TURN',
    initialRemaining,
    conditionContribution: { conditionId: condition.conditionId },
    adapterFacts: {
      [DND5E_ACTIVE_EFFECT_SAVE_ABILITY_DEFINITION_FACT_KEY]: save.savingThrow.abilityDefinitionId,
      ...pinnedDc.adapterFacts,
      [DND5E_ACTIVE_EFFECT_SAVE_REQUEST_NODE_FACT_KEY]: 'repeat-save-d20',
      [DND5E_ACTIVE_EFFECT_REPEAT_SAVE_CONDITION_FACT_KEY]: condition.conditionId
    },
    castSaveDcFactKey: pinnedDc.castSaveDcFactKey,
    perceptionContributions: [],
    maintenance: maintenancePlan(action, saveEntry)
  }
}

/** The authored duration of a hit's result block, which its follow-up save's condition lasts. */
function immediateFollowUpSaveDuration(
  action: Dnd5eCompiledEffectActionSource
): CompiledDuration | undefined {
  const firstEntry = action.compiledEffect.entries[0]
  return firstEntry && 'duration' in firstEntry ? firstEntry.duration : undefined
}

const TURNS_PER_DURATION_UNIT: Partial<Record<CompiledDuration['durationKind'], number>> = {
  TURN: 1,
  ROUND: 1,
  MINUTE: 10,
  HOUR: 600
}

/**
 * A condition's duration in the target's turns: "1 minute" ends after 10 of them (SRD 5.1). Null
 * for a duration the active-effect lifecycle cannot count (scaled, too long, or not timed).
 */
function conditionDurationTurns(duration: CompiledDuration): number | null {
  const perUnit = TURNS_PER_DURATION_UNIT[duration.durationKind]
  if (
    perUnit === undefined ||
    !('amount' in duration) ||
    duration.scaling ||
    !Number.isSafeInteger(duration.amount) ||
    duration.amount < 1
  )
    return null
  const turns = duration.amount * perUnit
  return turns <= MAX_ACTIVE_EFFECT_TURNS ? turns : null
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
  if (
    !duration ||
    !resolved ||
    exactImmediateFollowUpSaveShape(action.compiledEffect.entries) !== 'CONDITION_ON_FAILURE'
  )
    return null
  const failure = resolved.saveEntry.outcome.onFailure
  const condition = failure.kind === 'OUTCOMES' ? failure.outcomes[0] : undefined
  const initialRemaining = conditionDurationTurns(duration)
  if (
    condition?.effectKind !== 'CONDITION' ||
    initialRemaining === null ||
    !(action.conditionDefinitionIds ?? []).includes(condition.conditionId) ||
    !UUID.test(resolved.saveEntry.resultBlockId)
  )
    return null
  return {
    authoredEffectId: action.effectId,
    compiledEntryId: resolved.saveEntry.resultBlockId,
    frozenGraphNodeId: 'condition-duration',
    capabilityContractVersion: DND5E_EFFECT_ACTION_CAPABILITY_CONTRACT_VERSION,
    recurrenceStage: 'END_OF_TURN',
    initialRemaining,
    conditionContribution: { conditionId: condition.conditionId },
    adapterFacts: { [DND5E_ACTIVE_EFFECT_TIMED_CONDITION_FACT_KEY]: condition.conditionId },
    perceptionContributions: [],
    maintenance: maintenancePlan(action, resolved.saveEntry)
  }
}

function isGrantConsumeEvent(event: string): event is GrantConsumeEvent {
  return pathLifecycleGrantConsumeEventSchema.safeParse(event).success
}

function isGrantEndEvent(event: string): event is GrantEndEvent {
  return pathLifecycleGrantEndEventSchema.safeParse(event).success
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
    ? entries.filter(
        (entry) =>
          isActiveEffectPlanOutcome(entry) &&
          'outcome' in entry &&
          entry.outcome.effectKind === 'APPLY_GRANT'
      )
    : []
  if (hitGrants.length > 1) unsupported('D&D attacks apply at most one grant on a hit.')
  if (
    hitGrants.length === 1 &&
    entries.some((entry) => 'outcome' in entry && entry.outcome.effectKind === 'ACTOR_RELATIONSHIP')
  )
    unsupported('D&D attacks apply one active effect on a hit.')
  const entry = attack ? hitGrants[0] : entries[0]
  return entry ? modifierGrantEntryPlan({ action, entry, attack, untilEndEvent: false }) : null
}

type SlotLevelAmount = {
  valueKind: 'SPELL_SLOT_LEVEL'
  multiplier?: number
  subtractLevels?: number
}

function isSlotLevelAmount(payload: unknown): payload is SlotLevelAmount {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    'valueKind' in payload &&
    payload.valueKind === 'SPELL_SLOT_LEVEL'
  )
}

/** A granted amount that scales by slot level (Aid, Absorb Elements) is the fixed amount a cast level gives. */
function amountAtCastLevel<M extends { payload?: unknown }>(modifier: M, castLevel: number): M {
  const { payload } = modifier
  if (!isSlotLevelAmount(payload)) return modifier
  return {
    ...modifier,
    payload: {
      valueKind: 'FIXED',
      amount: (payload.multiplier ?? 1) * Math.max(0, castLevel - (payload.subtractLevels ?? 0))
    }
  }
}

/**
 * The plan of one APPLY_GRANT entry. With `untilEndEvent` the grant has no counted duration and
 * lasts until one of its authored end events (a speed penalty that lasts until the creature
 * regains Hit Points); without it the grant must be timed, and may also end early on an event
 * (Rage ends when its holder is incapacitated).
 */
function modifierGrantEntryPlan(input: {
  action: Dnd5eCompiledEffectActionSource
  entry: CompiledEffectGroup['entries'][number]
  attack: boolean
  untilEndEvent: boolean
}): Omit<CharacterRuleActionActiveEffectPlan, 'frozenGraph'> | null {
  const { action, entry, attack, untilEndEvent } = input
  if (!('outcome' in entry) || entry.outcome.effectKind !== 'APPLY_GRANT') return null
  const { grants } = entry.outcome
  const { spellCastLevel } = action
  // As a scaled heal is the row the cast level selects, a slot-scaled amount is fixed by it here.
  const modifiers = (grants.modifiers ?? []).map((modifier) =>
    spellCastLevel === undefined ? modifier : amountAtCastLevel(modifier, spellCastLevel)
  )
  const initialRemaining = entry.duration ? conditionDurationTurns(entry.duration) : null
  const {
    turnAnchor,
    consumeOnFirstEvents = [],
    endOnEvents = [],
    endOnConditionIds = [],
    holderEnd = null,
    ...otherLifecycle
  } = entry.lifecycle ?? {}
  const consumeEvents = [...new Set(consumeOnFirstEvents)].sort()
  const endEvents = [...new Set(endOnEvents)].sort()
  const grantConsumeEvents = consumeEvents.filter(isGrantConsumeEvent)
  const grantEndEvents = endEvents.filter(isGrantEndEvent)
  const senses = grants.senses ?? []
  const grantedSenses = senses.flatMap((sense) =>
    sense.selectionKind === 'GRANTED' && sense.scalingKind === 'NONE' && 'senseIds' in sense
      ? [
          {
            grantId: sense.id,
            scalingKind: 'NONE' as const,
            targetIds: [...sense.senseIds],
            levels: [],
            range: { ...sense.range }
          }
        ]
      : []
  )
  if (
    modifiers.length + senses.length === 0 ||
    grantedSenses.length !== senses.length ||
    modifiers.some(({ payload }) => isSlotLevelAmount(payload)) ||
    grants.proficiencies?.length ||
    (untilEndEvent
      ? entry.duration !== undefined || endEvents.length === 0 || turnAnchor !== undefined
      : initialRemaining === null ||
        // A grant created on its anchor's own turn is stored one turn longer (see the Encounter planner).
        initialRemaining >= MAX_ACTIVE_EFFECT_TURNS) ||
    Object.values(otherLifecycle).some((value) => value !== undefined) ||
    grantConsumeEvents.length !== consumeEvents.length ||
    grantEndEvents.length !== endEvents.length ||
    !UUID.test(entry.entryId)
  )
    return null
  return {
    authoredEffectId: action.effectId,
    compiledEntryId: entry.entryId,
    frozenGraphNodeId: 'modifier-grant',
    capabilityContractVersion: DND5E_EFFECT_ACTION_CAPABILITY_CONTRACT_VERSION,
    recurrenceStage: untilEndEvent ? 'NONE' : (turnAnchor?.boundary ?? 'END_OF_TURN'),
    initialRemaining,
    modifierGrantContribution: {
      applyGrantOutcomeId: entry.outcome.id,
      modifiers: buildCharacterGrantFoldModifierFacts(modifiers.map(compileModifierGrant)),
      senses: grantedSenses,
      tickAnchor: turnAnchor?.actor === 'SOURCE' ? 'SOURCE' : 'HOLDER',
      includesCurrentTurn: entry.duration?.durationKind === 'TURN',
      consumeOnFirstEvents: grantConsumeEvents,
      endOnEvents: grantEndEvents,
      endOnConditionIds: [...new Set(endOnConditionIds)].sort(),
      holderEnd
    },
    adapterFacts: attack ? { 'dnd5e.grant-authored-path': entry.pathCode } : {},
    perceptionContributions: [],
    maintenance: maintenancePlan(action, entry)
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
  const { consumeOnFirstEvents = [], ...otherLifecycle } = entry.lifecycle ?? {}
  const consumeEvents = [...new Set(consumeOnFirstEvents)].sort()
  const grantConsumeEvents = consumeEvents.filter(isGrantConsumeEvent)
  if (
    entry.duration?.durationKind !== 'UNTIL_DISPELLED' ||
    grantConsumeEvents.length !== consumeEvents.length ||
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
      consumeOnFirstEvents: grantConsumeEvents
    },
    adapterFacts: {},
    perceptionContributions: [],
    maintenance: maintenancePlan(action, entry)
  }
}

/**
 * The frozen graph of a timed condition or grant: one pure node. A condition's holder turn ends
 * tick it through the turn-effect kernel; a grant is counted by the grant tick planner instead.
 */
function durationPublishedGraph(input: {
  action: Dnd5eCompiledEffectActionSource
  plan: Omit<CharacterRuleActionActiveEffectPlan, 'frozenGraph'>
}): ServerPublishedRuleDefinitionDto {
  const { conditionContribution, modifierGrantContribution } = input.plan
  const definition: RuleGraphDefinition = {
    schemaVersion: 1,
    id: input.action.effectId,
    gameSystemId: DND5E_SYSTEM_ID,
    definitionFamilyKey: DND5E_EFFECT_ACTION_FAMILY_KEY,
    nodes: [
      {
        id: input.plan.frozenGraphNodeId,
        operation: { key: DND5E_CONDITION_DURATION_OPERATION_KEY, contractVersion: 1 },
        inputs: {}
      }
    ],
    outputs: conditionContribution
      ? { conditionId: { kind: 'LITERAL', value: conditionContribution.conditionId } }
      : modifierGrantContribution
        ? {
            applyGrantOutcomeId: {
              kind: 'LITERAL',
              value: modifierGrantContribution.applyGrantOutcomeId
            }
          }
        : {},
    sourceEntryBindings: [
      { sourceEntryId: input.plan.compiledEntryId, nodeId: input.plan.frozenGraphNodeId }
    ]
  }
  return serverPublishedRuleDefinitionDtoSchema.parse({
    id: definition.id,
    gameSystemId: definition.gameSystemId,
    definitionFamilyKey: definition.definitionFamilyKey,
    checksum: checksumRuleDocument(definition),
    definition
  })
}

/**
 * The zone a PLACED_SPACE manifest action places. Its one entering behavior is a fixed-DC saving
 * throw whose failure stops the mover, deals fixed damage and may leave a grant that lasts until
 * its authored end event. Anything else the behavior authors is refused rather than partly honored.
 */
function zonePlacementPlan(
  action: Dnd5eCompiledEffectActionSource
): CharacterRuleActionZonePlacementPlan | null {
  const zone = placedSpaceZone(action.compiledEffect)
  if (!zone) return null
  const triggerModes = zoneTriggerModes(zone.component)
  const { invocation, entries } = zone.behavior
  const savingThrow = 'savingThrow' in invocation ? invocation.savingThrow : undefined
  const placementKind = encounterAreaTargetKind(
    action.compiledEffect.invocation.range.rangeKind,
    zone.shape.shapeKind
  )
  // A directed area is aimed, not placed at a point; a zone is left where its action is centered.
  if (placementKind !== 'POINT' && placementKind !== 'CASTER_CENTERED')
    unsupported('A placed zone takes a point or the caster as its center.')
  if (
    !triggerModes ||
    invocation.triggerCode !== 'SAVING_THROW' ||
    savingThrow?.dcMethod !== 'FIXED_DC' ||
    !UUID.test(savingThrow.abilityDefinitionId) ||
    !Number.isSafeInteger(savingThrow.baseDc) ||
    entries.some(
      (entry) =>
        entry.resolutionKind !== 'DIRECT' ||
        !('outcome' in entry) ||
        entry.pathCode !== 'ON_SAVE_FAIL' ||
        entry.rangeOverride ||
        entry.targetingOverride
    )
  )
    unsupported('A placed zone behavior is a fixed-DC saving throw with direct failure outcomes.')
  const outcomeEntries = (effectKind: string) =>
    entries.filter((entry) => 'outcome' in entry && entry.outcome.effectKind === effectKind)
  const stops = outcomeEntries('MOVEMENT_RULE').filter(
    (entry) =>
      'outcome' in entry &&
      entry.outcome.effectKind === 'MOVEMENT_RULE' &&
      entry.outcome.ruleKind === 'STOP_CURRENT_MOVEMENT'
  )
  const [damage] = outcomeEntries('DAMAGE')
  const [grant] = outcomeEntries('APPLY_GRANT')
  if (
    !damage ||
    !UUID.test(damage.entryId) ||
    outcomeEntries('DAMAGE').length !== 1 ||
    outcomeEntries('APPLY_GRANT').length > 1 ||
    stops.length > 1 ||
    stops.length + 1 + (grant ? 1 : 0) !== entries.length
  )
    unsupported('A placed zone failure stops movement, deals one damage and may apply one grant.')
  const entryPlan: Omit<CharacterRuleActionActiveEffectPlan, 'frozenGraph'> = {
    authoredEffectId: action.effectId,
    compiledEntryId: damage.entryId,
    frozenGraphNodeId: 'proposal-on_save_fail',
    capabilityContractVersion: DND5E_EFFECT_ACTION_CAPABILITY_CONTRACT_VERSION,
    recurrenceStage: 'NONE',
    initialRemaining: null,
    adapterFacts: {
      [DND5E_ACTIVE_EFFECT_SAVE_ABILITY_DEFINITION_FACT_KEY]: savingThrow.abilityDefinitionId,
      [DND5E_SAVE_DC_FACT_KEY]: savingThrow.baseDc,
      [DND5E_ACTIVE_EFFECT_SAVE_REQUEST_NODE_FACT_KEY]: 'd20'
    },
    perceptionContributions: [],
    maintenance: null
  }
  const saveGraph = compileTestDefinition(
    action,
    { kind: 'SAVE', branches: new Map([['ON_SAVE_FAIL', boundedTestOutcome(damage)]]) },
    entryPlan
  )
  const lingeringPlan = grant
    ? modifierGrantEntryPlan({
        action,
        entry: grant,
        attack: false,
        untilEndEvent: true
      })
    : null
  const lingering = lingeringPlan?.modifierGrantContribution
  // The grant is read only for its modifiers and end events; one that is also consumed or
  // maintained would silently lose that behavior on a creature.
  if (
    grant &&
    (!lingering || lingering.consumeOnFirstEvents.length > 0 || lingeringPlan?.maintenance)
  )
    unsupported('A placed zone grant must last until its end event.')
  return {
    label: zone.label,
    shape: zone.shape,
    triggerModes,
    bypassAtHalfSpeed: zone.component.bypassAtHalfSpeed === true,
    entry: {
      ...entryPlan,
      frozenGraph: stops.length ? withMovementInterruption(saveGraph, 'ON_SAVE_FAIL') : saveGraph
    },
    grant: lingering
      ? {
          applyGrantOutcomeId: lingering.applyGrantOutcomeId,
          modifiers: [...lingering.modifiers],
          senses: [...lingering.senses],
          endOnEvents: [...lingering.endOnEvents]
        }
      : null
  }
}

/**
 * The direct-save form applies its condition only in the originating SAVE
 * outcome. Its delayed FOLLOW_UP_SAVE becomes a separate active-effect graph.
 */
function repeatingDirectFollowUpSavePlan(
  action: Dnd5eCompiledEffectActionSource
): Omit<CharacterRuleActionActiveEffectPlan, 'frozenGraph'> | null {
  const { invocation, entries } = action.compiledEffect
  const conditionEntry = entries[0]
  const saveEntry = entries[1]
  if (
    invocation.kind !== 'ACTION' ||
    invocation.triggerCode !== 'SAVING_THROW' ||
    entries.length !== 2 ||
    !conditionEntry ||
    !saveEntry ||
    !('outcome' in conditionEntry) ||
    !('outcome' in saveEntry) ||
    conditionEntry.resolutionKind !== 'DIRECT' ||
    saveEntry.resolutionKind !== 'DIRECT' ||
    conditionEntry.groupKind !== 'SEQUENTIAL' ||
    saveEntry.groupKind !== 'SEQUENTIAL' ||
    conditionEntry.pathCode !== 'ON_SAVE_FAIL' ||
    saveEntry.pathCode !== 'ON_SAVE_FAIL' ||
    conditionEntry.resultBlockId !== saveEntry.resultBlockId ||
    conditionEntry.outcome.effectKind !== 'CONDITION' ||
    saveEntry.outcome.effectKind !== 'FOLLOW_UP_SAVE'
  ) {
    return null
  }
  const condition = conditionEntry.outcome
  const save = saveEntry.outcome
  const initialRemaining = conditionEntry.duration
    ? conditionDurationTurns(conditionEntry.duration)
    : null
  const pinnedDc = pinnedSaveDc(save.savingThrow)
  if (
    !UUID.test(condition.conditionId) ||
    !(action.conditionDefinitionIds ?? []).includes(condition.conditionId) ||
    !UUID.test(conditionEntry.resultBlockId) ||
    initialRemaining === null ||
    save.timing !== 'TARGET_TURN_END' ||
    save.attempts.kind !== 'ONCE' ||
    save.attempts.repeatOnFailure !== true ||
    !pinnedDc ||
    !UUID.test(save.savingThrow.abilityDefinitionId) ||
    save.onSuccess.kind !== 'END' ||
    save.onFailure.kind !== 'CONTINUE' ||
    (save.onDurationComplete !== undefined && save.onDurationComplete.kind !== 'END')
  ) {
    return null
  }
  return {
    authoredEffectId: action.effectId,
    compiledEntryId: conditionEntry.resultBlockId,
    frozenGraphNodeId: 'repeat-save-test',
    capabilityContractVersion: DND5E_EFFECT_ACTION_CAPABILITY_CONTRACT_VERSION,
    recurrenceStage: 'END_OF_TURN',
    initialRemaining,
    conditionContribution: { conditionId: condition.conditionId },
    adapterFacts: {
      [DND5E_ACTIVE_EFFECT_SAVE_ABILITY_DEFINITION_FACT_KEY]: save.savingThrow.abilityDefinitionId,
      ...pinnedDc.adapterFacts,
      [DND5E_ACTIVE_EFFECT_SAVE_REQUEST_NODE_FACT_KEY]: 'repeat-save-d20',
      [DND5E_ACTIVE_EFFECT_REPEAT_SAVE_CONDITION_FACT_KEY]: condition.conditionId,
      ...(save.repeatRollInfluence
        ? {
            [DND5E_ACTIVE_EFFECT_REPEAT_SAVE_ROLL_INFLUENCE_FACT_KEY]:
              save.repeatRollInfluence.influence,
            [DND5E_ACTIVE_EFFECT_REPEAT_SAVE_PERCEPTION_REQUIREMENT_FACT_KEY]:
              save.repeatRollInfluence.when.requirement
          }
        : {})
    },
    castSaveDcFactKey: pinnedDc.castSaveDcFactKey,
    perceptionContributions: [],
    maintenance: maintenancePlan(action, conditionEntry)
  }
}

function repeatingDirectFollowUpSaveConditionEntry(
  action: Dnd5eCompiledEffectActionSource
): CompiledEffectGroup['entries'][number] | null {
  return repeatingDirectFollowUpSavePlan(action) ? (action.compiledEffect.entries[0] ?? null) : null
}

function repeatFollowUpSavePublishedGraph(input: {
  action: Dnd5eCompiledEffectActionSource
  plan: Omit<CharacterRuleActionActiveEffectPlan, 'frozenGraph'>
}): ServerPublishedRuleDefinitionDto {
  const abilityDefinitionId =
    input.plan.adapterFacts[DND5E_ACTIVE_EFFECT_SAVE_ABILITY_DEFINITION_FACT_KEY]
  if (typeof abilityDefinitionId !== 'string' || !UUID.test(abilityDefinitionId)) {
    throw new Dnd5eEffectActionCompilerError('D&D repeat-save facts are unavailable.')
  }
  const definition: RuleGraphDefinition = {
    schemaVersion: 1,
    id: input.action.effectId,
    gameSystemId: DND5E_SYSTEM_ID,
    definitionFamilyKey: DND5E_EFFECT_ACTION_FAMILY_KEY,
    nodes: [
      {
        id: 'repeat-save-d20',
        operation: { key: 'evidence.integer-range', contractVersion: 1 },
        inputs: {
          min: { kind: 'LITERAL', value: 1 },
          max: { kind: 'LITERAL', value: 20 }
        }
      },
      {
        id: input.plan.frozenGraphNodeId,
        operation: { key: DND5E_SAVE_TEST_OPERATION_KEY, contractVersion: 2 },
        inputs: {
          targetActorId: { kind: 'FACT', factKey: DND5E_TARGET_ACTOR_FACT_KEY },
          naturalD20: {
            kind: 'NODE_OUTPUT',
            nodeId: 'repeat-save-d20',
            port: 'value'
          },
          modifier: { kind: 'FACT', factKey: DND5E_SAVE_MODIFIER_FACT_KEY },
          threshold: { kind: 'FACT', factKey: DND5E_SAVE_DC_FACT_KEY },
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
        nodeId: input.plan.frozenGraphNodeId,
        port: 'targetActorId'
      },
      naturalD20: {
        kind: 'NODE_OUTPUT',
        nodeId: input.plan.frozenGraphNodeId,
        port: 'naturalD20'
      },
      total: {
        kind: 'NODE_OUTPUT',
        nodeId: input.plan.frozenGraphNodeId,
        port: 'total'
      },
      resultPath: {
        kind: 'NODE_OUTPUT',
        nodeId: input.plan.frozenGraphNodeId,
        port: 'resultPath'
      },
      contributorChecksum: {
        kind: 'NODE_OUTPUT',
        nodeId: input.plan.frozenGraphNodeId,
        port: 'contributorChecksum'
      }
    },
    sourceEntryBindings: [
      {
        sourceEntryId: input.plan.compiledEntryId,
        nodeId: input.plan.frozenGraphNodeId
      }
    ]
  }
  return serverPublishedRuleDefinitionDtoSchema.parse({
    id: definition.id,
    gameSystemId: definition.gameSystemId,
    definitionFamilyKey: definition.definitionFamilyKey,
    checksum: checksumRuleDocument(definition),
    definition
  })
}

function exactImmediateFollowUpSaveShape(
  entries: readonly CompiledEffectGroup['entries'][number][]
): ImmediateFollowUpSaveShape | null {
  const resolved = immediateFollowUpSaveEntries(entries)
  if (!resolved) return null
  const { primaryDamageEntries, saveEntry } = resolved
  const damageEntry = primaryDamageEntries[0]!
  const save = saveEntry.outcome
  const failed = save.onFailure
  const succeeded = save.onSuccess
  if (
    save.timing !== 'IMMEDIATE' ||
    save.attempts.kind !== 'ONCE' ||
    save.savingThrow.dcMethod !== 'FIXED_DC' ||
    !UUID.test(save.savingThrow.abilityDefinitionId) ||
    !Number.isSafeInteger(save.savingThrow.baseDc) ||
    failed.kind !== 'OUTCOMES'
  ) {
    return null
  }
  const failure = failed.outcomes[0]
  const primaryDiceCount = primaryDamageEntries.reduce<number | null>((total, entry) => {
    const count = primaryDamageDiceCount(entry.outcome)
    return total === null || count === null ? null : total + count
  }, 0)
  const commonBoundedSave =
    primaryDiceCount !== null &&
    1 + primaryDiceCount * 2 + 1 <= MAX_RULE_EXECUTION_AUTOMATIC_EVIDENCE_REQUESTS
  const repeatingCondition =
    failed.outcomes.length === 1 && failed.outcomes[0]?.effectKind === 'CONDITION'
      ? failed.outcomes[0]
      : failed.outcomes.length === 2 && failed.outcomes[1]?.effectKind === 'CONDITION'
        ? failed.outcomes[1]
        : null
  const repeatingDamage =
    failed.outcomes.length === 2 && failed.outcomes[0]?.effectKind === 'DAMAGE'
      ? failed.outcomes[0]
      : null
  const repeatingDamageDiceCount =
    repeatingDamage?.valueKind === 'DICE' && typeof repeatingDamage.dice === 'string'
      ? boundedSingleDiceCount(repeatingDamage.dice)
      : null
  if (
    save.attempts.repeatOnFailure === true &&
    save.repeatTiming === 'TARGET_TURN_END' &&
    (failed.resultKind === 'SINGLE' || failed.resultKind === 'SEQUENCE') &&
    (save.onDurationComplete === undefined || save.onDurationComplete.kind === 'END') &&
    succeeded.kind === 'END' &&
    repeatingCondition &&
    UUID.test(repeatingCondition.conditionId) &&
    (repeatingDamage === null ||
      (repeatingDamage.valueKind === 'DICE' &&
        repeatingDamage.scalingKind === 'NONE' &&
        typeof repeatingDamage.dice === 'string' &&
        repeatingDamageDiceCount !== null &&
        isUuid(repeatingDamage.damageTypeId) &&
        damageMultiplier(repeatingDamage) === 1 &&
        !repeatingDamage.bonuses?.length &&
        primaryDiceCount !== null &&
        1 + primaryDiceCount * 2 + 1 + repeatingDamageDiceCount <=
          MAX_RULE_EXECUTION_AUTOMATIC_EVIDENCE_REQUESTS)) &&
    commonBoundedSave
  ) {
    return 'REPEATING_CONDITION'
  }
  if (save.attempts.repeatOnFailure === true || save.onDurationComplete) return null
  const failureDiceCount =
    failure?.effectKind === 'DAMAGE' && failure.valueKind === 'DICE'
      ? boundedSingleDiceCount(failure.dice)
      : null
  if (
    succeeded.kind === 'END' &&
    failed.outcomes.length === 1 &&
    failure?.effectKind === 'DAMAGE' &&
    failure.valueKind === 'DICE' &&
    failure.scalingKind === 'NONE' &&
    failureDiceCount !== null &&
    isUuid(failure.damageTypeId) &&
    damageMultiplier(failure) === 1 &&
    !failure.bonuses?.length &&
    commonBoundedSave &&
    1 + primaryDiceCount! * 2 + 1 + failureDiceCount <=
      MAX_RULE_EXECUTION_AUTOMATIC_EVIDENCE_REQUESTS
  ) {
    return 'DAMAGE_ON_FAILURE'
  }
  if (
    succeeded.kind === 'END' &&
    failed.outcomes.length === 1 &&
    failure?.effectKind === 'CONDITION' &&
    UUID.test(failure.id) &&
    UUID.test(failure.conditionId) &&
    commonBoundedSave
  ) {
    return 'CONDITION_ON_FAILURE'
  }
  if (
    succeeded.kind === 'END' &&
    failed.outcomes.length === 1 &&
    failure?.effectKind === 'HIT_POINT_MAXIMUM_REDUCTION' &&
    UUID.test(failure.id) &&
    failure.amountSource.kind === 'DAMAGE_TAKEN' &&
    failure.amountSource.damageOutcomeId === damageEntry.outcome.id &&
    UUID.test(failure.amountSource.damageOutcomeId) &&
    hitPointMaximumReductionRecoveryTagsSchema.safeParse(failure.recoveryTags).success &&
    commonBoundedSave
  ) {
    return 'STATE_ONLY_REDUCTION'
  }
  if (
    succeeded.kind === 'END' &&
    failed.outcomes.length === 1 &&
    failure?.effectKind === 'FORCED_MOVEMENT' &&
    UUID.test(failure.id) &&
    failure.direction === 'TOWARD_SOURCE' &&
    failure.actionEconomy === 'NONE' &&
    failure.distanceMode === 'FIXED_DISTANCE' &&
    failure.amount === 25 &&
    failure.unit === 'FEET' &&
    commonBoundedSave
  ) {
    return 'FORCED_MOVEMENT_ONLY'
  }
  if (
    succeeded.kind !== 'OUTCOMES' ||
    succeeded.resultKind !== 'SINGLE' ||
    failed.outcomes.length < 1 ||
    failed.outcomes.length > 2 ||
    succeeded.outcomes.length !== 1
  ) {
    return null
  }
  const reduction = failed.outcomes[1]
  const success = succeeded.outcomes[0]
  const nestedDiceCount =
    failure && 'dice' in failure && typeof failure.dice === 'string'
      ? boundedSingleDiceCount(failure.dice)
      : null
  if (
    failure?.effectKind === 'DAMAGE' &&
    success?.effectKind === 'DAMAGE' &&
    failure.valueKind === 'DICE' &&
    success.valueKind === 'DICE' &&
    failure.scalingKind === 'NONE' &&
    success.scalingKind === 'NONE' &&
    typeof failure.dice === 'string' &&
    failure.dice === success.dice &&
    nestedDiceCount !== null &&
    isUuid(failure.damageTypeId) &&
    failure.damageTypeId === success.damageTypeId &&
    damageMultiplier(failure) === 1 &&
    damageMultiplier(success) === 0.5 &&
    !failure.bonuses?.length &&
    !success.bonuses?.length &&
    (reduction === undefined ||
      (reduction.effectKind === 'HIT_POINT_MAXIMUM_REDUCTION' &&
        UUID.test(reduction.id) &&
        reduction.amountSource.kind === 'DAMAGE_TAKEN' &&
        reduction.amountSource.damageOutcomeId === damageEntry.outcome.id &&
        UUID.test(reduction.amountSource.damageOutcomeId) &&
        hitPointMaximumReductionRecoveryTagsSchema.safeParse(reduction.recoveryTags).success)) &&
    commonBoundedSave &&
    // One TEST d20, doubled primary critical dice, one nested save d20, and
    // the selected nested damage dice must fit the coordinator-wide bound.
    1 + primaryDiceCount! * 2 + 1 + nestedDiceCount <=
      MAX_RULE_EXECUTION_AUTOMATIC_EVIDENCE_REQUESTS
  ) {
    return 'FULL_OR_HALF_DAMAGE'
  }
  return null
}

/**
 * The dice one primary hit-damage outcome requests before the nested save: its exact bounded
 * term (a flat modifier or ability bonuses allowed, at most 15 dice) or none for a fixed amount.
 */
function primaryDamageDiceCount(outcome: ImmediatePrimaryDamageEntry['outcome']): number | null {
  if (outcome.scalingKind !== 'NONE') return null
  if (outcome.valueKind === 'FIXED')
    return Number.isSafeInteger(outcome.amount) && outcome.amount > 0 && !outcome.bonuses?.length
      ? 0
      : null
  if (outcome.valueKind !== 'DICE') return null
  // A constant authored as dice ("1") rolls nothing, like a fixed amount.
  if (/^[1-9]\d*$/.test(outcome.dice)) return outcome.bonuses?.length ? null : 0
  try {
    validateDamageBonuses(outcome.bonuses)
    const count = parseBoundedDiceConfiguration(outcome.dice).terms[0]!.count
    return count <= 15 ? count : null
  } catch (error) {
    if (error instanceof CharacterRuleActionUnsupportedCompilationError) return null
    throw error
  }
}

function immediateFollowUpSaveMaximumReduction(
  action: Dnd5eCompiledEffectActionSource
): HitPointMaximumReductionAuthored | null {
  const saveEntry = action.compiledEffect.entries.at(-1)
  if (!saveEntry || !('outcome' in saveEntry) || saveEntry.outcome.effectKind !== 'FOLLOW_UP_SAVE')
    return null
  const failure = saveEntry.outcome.onFailure
  if (failure.kind !== 'OUTCOMES') return null
  const reductions = failure.outcomes.filter(
    (outcome): outcome is HitPointMaximumReductionAuthored =>
      outcome.effectKind === 'HIT_POINT_MAXIMUM_REDUCTION'
  )
  return reductions.length === 1 ? reductions[0]! : null
}

function boundedSingleDiceCount(value: unknown): number | null {
  try {
    const parsed = parseBoundedDiceConfiguration(value)
    const term = parsed.terms[0]
    return term && parsed.modifier === 0 ? term.count : null
  } catch (error) {
    if (error instanceof Dnd5eEffectActionCompilerError) return null
    throw error
  }
}

function isExactImmediateFollowUpSaveAction(action: Dnd5eCompiledEffectActionSource): boolean {
  const failure = immediateFollowUpSaveEntries(action.compiledEffect.entries)?.saveEntry.outcome
    .onFailure
  const shape = exactImmediateFollowUpSaveShape(action.compiledEffect.entries)
  // A repeating save runs only with its active-effect plan; without one the condition would
  // never be saved against again. A duration belongs to the repeating save's condition or to a
  // one-time save's condition (D62.2), which its own active effect times.
  const entries = action.compiledEffect.entries
  const lifecycle = entries.some((entry) => 'lifecycle' in entry && entry.lifecycle)
  const timed = entries.some((entry) => 'duration' in entry && entry.duration)
  return (
    testPhaseKindOrNull(action) === 'ATTACK' &&
    ((shape !== null &&
      shape !== 'REPEATING_CONDITION' &&
      !lifecycle &&
      (!timed || timedImmediateConditionPlan(action) !== null)) ||
      repeatingImmediateFollowUpSavePlan(action) !== null) &&
    (failure?.kind !== 'OUTCOMES' ||
      failure.outcomes.every(
        (outcome) =>
          outcome.effectKind !== 'CONDITION' ||
          (action.conditionDefinitionIds ?? []).includes(outcome.conditionId)
      ))
  )
}

function parseBoundedDiceConfiguration(value: unknown): ParsedRollExpression {
  if (typeof value !== 'string') unsupported('D&D dice configuration is unavailable.')
  let parsed: ParsedRollExpression
  try {
    parsed = parseRollExpression(value)
  } catch {
    unsupported('D&D dice configuration is malformed.')
  }
  const term = parsed.terms[0]
  if (
    parsed.terms.length !== 1 ||
    parsed.transform.kind !== 'NONE' ||
    !term ||
    term.reroll ||
    term.selection ||
    term.count < 1 ||
    term.count > 31 ||
    term.die < 2 ||
    term.die > 1000
  ) {
    unsupported('D&D dice configuration exceeds the bounded exact-dice contract.')
  }
  return parsed
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

function validateDamageBonuses(value: unknown): void {
  if (value === undefined) return
  if (!Array.isArray(value) || value.length > 100)
    unsupported('D&D dice outcome bonuses exceed the bounded contract.')
  for (const bonus of value) {
    if (!bonus || typeof bonus !== 'object' || Array.isArray(bonus))
      unsupported('D&D dice outcome bonus is malformed.')
    const row = bonus as Record<string, unknown>
    if (
      (row.bonusKind !== 'ABILITY_BONUS' &&
        row.bonusKind !== 'SKILL_BONUS' &&
        row.bonusKind !== 'PROFICIENCY_BONUS') ||
      !Number.isSafeInteger(row.order) ||
      Number(row.order) < 0 ||
      (row.min !== undefined && !Number.isSafeInteger(row.min)) ||
      (row.max !== undefined && !Number.isSafeInteger(row.max)) ||
      (row.multiplier !== undefined && !Number.isSafeInteger(row.multiplier)) ||
      (row.bonusKind === 'ABILITY_BONUS' &&
        (typeof row.ability !== 'string' || row.ability.length === 0)) ||
      (row.bonusKind === 'SKILL_BONUS' &&
        (typeof row.skillId !== 'string' || row.skillId.length === 0))
    ) {
      unsupported('D&D dice outcome bonus is malformed.')
    }
  }
}

/**
 * The dice a heal rolls: its one authored value, or the row the spell's cast level reaches. A
 * heal's dice count shapes its graph, so the cast level is a compile input rather than a runtime fact.
 */
function healDiceConfiguration(
  outcome: Record<string, unknown>,
  spellCastLevel: number | undefined
): string {
  if (outcome.scalingKind === 'NONE' && typeof outcome.diceConfig === 'string')
    return outcome.diceConfig
  if (
    outcome.scalingKind !== 'PER_LEVEL' ||
    outcome.scalingSource !== 'SPELL_CAST_LEVEL' ||
    !Array.isArray(outcome.levels)
  )
    unsupported('D&D dice healing requires one authored dice value or spell cast level rows.')
  if (spellCastLevel === undefined) unsupported('D&D dice healing scaling facts are unavailable.')
  const row = selectScalingRow(outcome.levels as readonly Record<string, unknown>[], spellCastLevel)
  if (!row || typeof row.diceConfig !== 'string')
    unsupported('D&D dice healing scaling does not select an authored value.')
  return row.diceConfig
}

function validateHealBonuses(value: unknown): void {
  if (value === undefined) return
  if (!Array.isArray(value) || value.length > 100)
    unsupported('D&D dice healing bonuses exceed the bounded contract.')
  for (const bonus of value) {
    if (!bonus || typeof bonus !== 'object' || Array.isArray(bonus))
      unsupported('D&D dice healing bonus is malformed.')
    const row = bonus as Record<string, unknown>
    if (
      (row.bonusKind !== 'ABILITY_BONUS' &&
        row.bonusKind !== 'PROFICIENCY_BONUS' &&
        row.bonusKind !== 'CLASS_LEVEL') ||
      !Number.isSafeInteger(row.order) ||
      Number(row.order) < 0 ||
      (row.min !== undefined && !Number.isSafeInteger(row.min)) ||
      (row.max !== undefined && !Number.isSafeInteger(row.max)) ||
      (row.multiplier !== undefined && !Number.isSafeInteger(row.multiplier)) ||
      (row.bonusKind === 'ABILITY_BONUS' &&
        (typeof row.ability !== 'string' || row.ability.length === 0)) ||
      (row.bonusKind === 'CLASS_LEVEL' &&
        (typeof row.classId !== 'string' || row.classId.length === 0))
    ) {
      unsupported('D&D dice healing bonus is malformed.')
    }
  }
}

type CompiledDiceDamageEffect = Extract<CompiledDamageEffect, { valueKind: 'DICE' }>

/** Validate one compiled dice row before TEST publication. */
function validateDiceOutcomeRow(outcome: CompiledDiceDamageEffect): void {
  validateDamageBonuses(outcome.bonuses)
  if (outcome.scalingKind === 'NONE') {
    parseBoundedDiceConfiguration(outcome.dice)
    return
  }
  if (outcome.scalingKind !== 'PER_LEVEL')
    unsupported('D&D dice outcomes require NONE or PER_LEVEL scaling.')
  if (
    outcome.scalingSource !== 'CHARACTER_LEVEL' &&
    outcome.scalingSource !== 'CLASS_LEVEL' &&
    outcome.scalingSource !== 'PARENT_CLASS_LEVEL' &&
    outcome.scalingSource !== 'SPELL_CAST_LEVEL'
  ) {
    unsupported('D&D dice outcomes use an unsupported scaling source.')
  }
  parseBoundedDiceConfiguration(outcome.dice)
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
          parseBoundedDiceConfiguration(dice).terms[0]!.count > 15
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
    !isSupportedTestTargetPolicy(invocation) ||
    entries.length < 1
  )
    unsupported(
      'D&D test actions must use one bounded single-target action or movement-reaction shape.'
    )
  const relationshipEntries = entries.filter(
    (entry) => 'outcome' in entry && entry.outcome.effectKind === 'ACTOR_RELATIONSHIP'
  )
  const executableEntries = entries.filter((entry) => !isActiveEffectPlanOutcome(entry))
  if (relationshipEntries.length > 1)
    unsupported('D&D action has more than one relationship outcome.')
  const branches = new Map<string, Outcome>()
  const branchResultBlocks = new Map<string, string>()
  const recurringPlan = supportedRecurringPlan(action)
  for (const entry of executableEntries) {
    if (
      entry.resolutionKind !== 'DIRECT' ||
      (entry.groupKind !== 'SINGLE' &&
        !(relationshipEntries.length === 1 && entry.groupKind === 'SEQUENTIAL')) ||
      ((entry.duration || entry.lifecycle) &&
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

function supported(action: Dnd5eCompiledEffectActionSource): SpecializedOutcome {
  const effect = action.compiledEffect
  const invocation = effect.invocation
  const grantPlan = modifierGrantPlan(action)
  // A CHECK action rolls its authored check against a fixed DC, each observer's passive score or
  // the concealments that hide creatures from the checker; a contest waits for ATTACK-7.
  const checkAction = invocation.triggerCode === 'CHECK'
  const supportsSelf =
    invocation.range.rangeKind === 'SELF' && invocation.targeting?.selectionKind === 'SELF'
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
    // A grant (Help) or a check (First Aid) may ask for a willing target: an unwilling one only warns,
    // and the table can override it.
    (invocation.targeting.dispositionKind === 'ANY' ||
      (invocation.targeting.dispositionKind === 'WILLING' && (grantPlan !== null || checkAction)))
  // A bounded list of chosen creatures (Mass Healing Word), inside a round area when it names one
  // (Mass Cure Wounds), resolves the one outcome on each; only a heal is supported, checked below
  // once the outcome is read.
  const supportsChosenCreatures =
    supportsTargetRange &&
    invocation.targeting?.selectionKind === 'CHOSEN_CREATURES' &&
    invocation.targeting.dispositionKind === 'ANY' &&
    chosenCreaturesMaxTargets(invocation.targeting) !== null &&
    (!invocation.shape ||
      chosenCreaturesAreaSupported(invocation.range.rangeKind, invocation.shape.shapeKind))
  // A Legendary Action option is free; the Feature charge it spends is its cost.
  const supportedActivation =
    invocation.kind === 'ACTION' &&
    (invocation.activation.code === 'FREE'
      ? invocation.resourceUse !== undefined
      : (invocation.activation.code === 'ACTION' ||
          invocation.activation.code === 'BONUS_ACTION' ||
          // A reaction to being attacked or to taking damage; the attack's pending decision offers it (never a direct action).
          (invocation.activation.code === 'REACTION' &&
            'reactionTrigger' in invocation &&
            (invocation.reactionTrigger?.kind === 'ATTACKED_SELF' ||
              invocation.reactionTrigger?.kind === 'DAMAGE_TAKEN'))) &&
        invocation.activation.amount === 1)
  if (
    invocation.kind !== 'ACTION' ||
    (invocation.triggerCode !== 'ACTIVATED' &&
      !(invocation.triggerCode === 'CHECK' && invocation.check.dc.kind !== 'CONTEST')) ||
    !supportedActivation ||
    (!supportsSelf && !supportsSingleTarget && !supportsChosenCreatures) ||
    (invocation.shape && !supportsChosenCreatures)
  )
    unsupported('D&D Effect action is not the supported activated self action shape.')
  const entry = effect.entries[0]
  if (
    effect.entries.length !== 1 ||
    !entry ||
    entry.resolutionKind !== 'DIRECT' ||
    entry.groupKind !== 'SINGLE' ||
    entry.pathCode !== (checkAction ? 'ON_CHECK_SUCCESS' : 'ON_USE') ||
    (entry.maintenanceDefinitionId && !supportedRecurringPlan(action) && !grantPlan) ||
    ((entry.duration || entry.lifecycle) &&
      !supportedRecurringPlan(action) &&
      !grantPlan &&
      !concealmentPlan(action)) ||
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
  if (
    checkAction &&
    outcome.effectKind !== 'STABILIZE' &&
    outcome.effectKind !== 'CONCEAL_FROM_OBSERVERS' &&
    outcome.effectKind !== 'DETECT_CONCEALED'
  )
    unsupported('D&D check action outcome is not supported yet.')
  if (supportsChosenCreatures && outcome.effectKind !== 'HEAL')
    unsupported('D&D chosen-creature action outcome must be a heal.')
  if (
    !checkAction &&
    (outcome.effectKind === 'CONCEAL_FROM_OBSERVERS' || outcome.effectKind === 'DETECT_CONCEALED')
  )
    unsupported('D&D conceal and detect outcomes belong to a check action.')
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
  if (outcome.effectKind === 'CONDITION') {
    uuid(outcome.conditionId, 'D&D condition definition identity')
    if (!(action.conditionDefinitionIds ?? []).includes(outcome.conditionId))
      unsupported('D&D Effect action condition is not in the pinned System vocabulary.')
    return { kind: 'CONDITION_APPLY', conditionId: outcome.conditionId }
  }
  if (outcome.effectKind === 'STABILIZE') return { kind: 'STABILIZE' }
  if (outcome.effectKind === 'CONCEAL_FROM_OBSERVERS') return { kind: 'CONCEAL' }
  if (outcome.effectKind === 'DETECT_CONCEALED') return { kind: 'DETECT_CONCEALED' }
  if (outcome.effectKind === 'APPLY_GRANT' && grantPlan) return { kind: 'MODIFIER_GRANT' }
  // The Action is spent and the GM rules the result: nothing is stored on the target.
  if (outcome.effectKind === 'MANUAL_ADJUDICATION') return { kind: 'MANUAL_ADJUDICATION' }
  // Dash: the committed action adds the actor's speed to this turn's movement; the commit records it.
  if (outcome.effectKind === 'MOVEMENT_RULE' && outcome.ruleKind === 'ADD_SPEED_TO_MOVEMENT')
    return { kind: 'ADD_SPEED_TO_MOVEMENT' }
  if (outcome.effectKind !== 'HEAL' && outcome.effectKind !== 'DAMAGE')
    unsupported('D&D Effect action outcome is not a supported hit-point or condition outcome.')
  if (outcome.effectKind === 'HEAL' && outcome.valueKind === 'DICE') {
    parseBoundedDiceConfiguration(
      healDiceConfiguration(outcome as unknown as Record<string, unknown>, action.spellCastLevel)
    )
    validateHealBonuses(outcome.bonuses)
    return { kind: 'DICE_HEAL', temporary: outcome.temporary ?? false }
  }
  if (
    outcome.valueKind !== 'FIXED' ||
    outcome.scalingKind !== 'NONE' ||
    outcome.bonuses?.length ||
    !Number.isSafeInteger(outcome.amount) ||
    outcome.amount <= 0
  )
    unsupported(
      'D&D Effect action must be a positive safe fixed amount with no scaling or bonuses.'
    )
  if (outcome.effectKind === 'HEAL')
    return {
      kind: outcome.temporary ? 'TEMPORARY_HIT_POINTS' : 'HEAL',
      amount: outcome.amount
    }
  uuid(outcome.damageTypeId, 'D&D damage type identity')
  return {
    kind: 'DAMAGE',
    amount: multipliedDamageAmount(outcome.amount, damageMultiplier(outcome)),
    damageTypeId: outcome.damageTypeId
  }
}
function simpleOperation(key: string): ProposalRuleOperationContract {
  return {
    key,
    contractVersion: 1,
    executionKind: 'PROPOSAL',
    inputs: {
      targetActorId: RULE_VALUE_KIND.TEXT,
      amount: RULE_VALUE_KIND.NUMBER,
      targetStateChecksum: RULE_VALUE_KIND.TEXT
    },
    outputs: {
      targetActorId: RULE_VALUE_KIND.TEXT,
      amount: RULE_VALUE_KIND.NUMBER,
      applicationCandidate: RULE_VALUE_KIND.BOOLEAN,
      authorized: RULE_VALUE_KIND.BOOLEAN,
      targetStateChecksum: RULE_VALUE_KIND.TEXT
    },
    execute(inputs) {
      const targetActorId = inputs.targetActorId
      const amount = inputs.amount
      if (typeof targetActorId !== 'string' || !UUID.test(targetActorId))
        throw new Error('D&D proposal requires a canonical target actor UUID.')
      if (typeof amount !== 'number' || !Number.isSafeInteger(amount) || amount <= 0)
        throw new Error('D&D proposal requires a positive integer amount.')
      const targetStateChecksum = inputs.targetStateChecksum
      if (typeof targetStateChecksum !== 'string' || !/^[a-f0-9]{64}$/.test(targetStateChecksum))
        throw new Error('D&D proposal requires target state checksum.')
      return {
        targetActorId,
        amount,
        applicationCandidate: true,
        authorized: true,
        targetStateChecksum
      }
    }
  }
}
export const dnd5eHealProposalOperation = simpleOperation(DND5E_HEAL_PROPOSAL_OPERATION_KEY)
/**
 * A proposal that applies one fixed outcome to the target and carries no amount. With
 * `changesTargetState` false the outcome stores nothing on the target (an Active Effect owns it), so
 * a stored-state batch needs no application for it.
 */
function targetOnlyProposalOperation(
  key: string,
  label: string,
  changesTargetState = true
): ProposalRuleOperationContract {
  return {
    key,
    contractVersion: 1,
    executionKind: 'PROPOSAL',
    inputs: {
      targetActorId: RULE_VALUE_KIND.TEXT,
      targetStateChecksum: RULE_VALUE_KIND.TEXT
    },
    outputs: {
      targetActorId: RULE_VALUE_KIND.TEXT,
      applicationCandidate: RULE_VALUE_KIND.BOOLEAN,
      authorized: RULE_VALUE_KIND.BOOLEAN,
      targetStateChecksum: RULE_VALUE_KIND.TEXT,
      ...(changesTargetState ? {} : { changesTargetState: RULE_VALUE_KIND.BOOLEAN })
    },
    execute(inputs) {
      const targetActorId = inputs.targetActorId
      const targetStateChecksum = inputs.targetStateChecksum
      if (typeof targetActorId !== 'string' || !UUID.test(targetActorId))
        throw new Error(`D&D ${label} proposal requires a canonical target actor UUID.`)
      if (typeof targetStateChecksum !== 'string' || !/^[a-f0-9]{64}$/.test(targetStateChecksum))
        throw new Error(`D&D ${label} proposal requires target state checksum.`)
      return {
        targetActorId,
        applicationCandidate: true,
        authorized: true,
        targetStateChecksum,
        ...(changesTargetState ? {} : { changesTargetState: false })
      }
    }
  }
}
export const dnd5eStabilizeProposalOperation = targetOnlyProposalOperation(
  DND5E_STABILIZE_PROPOSAL_OPERATION_KEY,
  'stabilize'
)
export const dnd5eModifierGrantProposalOperation = targetOnlyProposalOperation(
  DND5E_MODIFIER_GRANT_PROPOSAL_OPERATION_KEY,
  'modifier grant',
  false
)
export const dnd5eManualAdjudicationProposalOperation = targetOnlyProposalOperation(
  DND5E_MANUAL_ADJUDICATION_PROPOSAL_OPERATION_KEY,
  'manual adjudication',
  false
)
export const dnd5eConcealProposalOperation = targetOnlyProposalOperation(
  DND5E_CONCEAL_PROPOSAL_OPERATION_KEY,
  'conceal',
  false
)
export const dnd5eDetectConcealedProposalOperation = targetOnlyProposalOperation(
  DND5E_DETECT_CONCEALED_PROPOSAL_OPERATION_KEY,
  'detect concealed',
  false
)
export const dnd5eAddSpeedToMovementProposalOperation = targetOnlyProposalOperation(
  DND5E_ADD_SPEED_TO_MOVEMENT_PROPOSAL_OPERATION_KEY,
  'add speed to movement',
  false
)
export const dnd5eTemporaryHitPointsProposalOperation = simpleOperation(
  DND5E_TEMPORARY_HIT_POINTS_PROPOSAL_OPERATION_KEY
)
export const dnd5eDamageProposalOperation: ProposalRuleOperationContract = {
  key: DND5E_DAMAGE_PROPOSAL_OPERATION_KEY,
  contractVersion: 1,
  executionKind: 'PROPOSAL',
  inputs: {
    targetActorId: RULE_VALUE_KIND.TEXT,
    amount: RULE_VALUE_KIND.NUMBER,
    damageTypeId: RULE_VALUE_KIND.TEXT,
    targetStateChecksum: RULE_VALUE_KIND.TEXT
  },
  outputs: {
    targetActorId: RULE_VALUE_KIND.TEXT,
    amount: RULE_VALUE_KIND.NUMBER,
    damageTypeId: RULE_VALUE_KIND.TEXT,
    applicationCandidate: RULE_VALUE_KIND.BOOLEAN,
    authorized: RULE_VALUE_KIND.BOOLEAN,
    targetStateChecksum: RULE_VALUE_KIND.TEXT
  },
  execute(inputs) {
    const targetActorId = inputs.targetActorId
    const amount = inputs.amount
    const damageTypeId = inputs.damageTypeId
    if (
      typeof targetActorId !== 'string' ||
      !UUID.test(targetActorId) ||
      typeof amount !== 'number' ||
      !Number.isSafeInteger(amount) ||
      amount < 0 ||
      typeof damageTypeId !== 'string' ||
      !UUID.test(damageTypeId)
    )
      throw new Error(
        'D&D damage proposal requires canonical identities and a nonnegative integer amount.'
      )
    const targetStateChecksum = inputs.targetStateChecksum
    if (typeof targetStateChecksum !== 'string' || !/^[a-f0-9]{64}$/.test(targetStateChecksum))
      throw new Error('D&D damage proposal requires target state checksum.')
    return {
      targetActorId,
      amount,
      damageTypeId,
      applicationCandidate: true,
      authorized: true,
      targetStateChecksum
    }
  }
}
/** A reduction's recovery tags travel through its graph as canonical JSON text. */
function parseRecoveryTags(value: unknown): HitPointMaximumReductionRecoveryTag[] | null {
  if (typeof value !== 'string') return null
  try {
    const parsed = hitPointMaximumReductionRecoveryTagsSchema.safeParse(JSON.parse(value))
    return parsed.success && JSON.stringify(parsed.data) === value ? parsed.data : null
  } catch {
    return null
  }
}

export const dnd5eHitPointMaximumReductionProposalOperation: ProposalRuleOperationContract = {
  key: DND5E_HIT_POINT_MAXIMUM_REDUCTION_PROPOSAL_OPERATION_KEY,
  contractVersion: 1,
  executionKind: 'PROPOSAL',
  inputs: {
    targetActorId: RULE_VALUE_KIND.TEXT,
    resultPath: RULE_VALUE_KIND.TEXT,
    sourceDamageNodeId: RULE_VALUE_KIND.TEXT,
    sourceDamageOperationKey: RULE_VALUE_KIND.TEXT,
    sourceDamageOutcomeId: RULE_VALUE_KIND.TEXT,
    recoveryTags: RULE_VALUE_KIND.TEXT,
    targetStateChecksum: RULE_VALUE_KIND.TEXT
  },
  outputs: {
    targetActorId: RULE_VALUE_KIND.TEXT,
    resultPath: RULE_VALUE_KIND.TEXT,
    sourceDamageNodeId: RULE_VALUE_KIND.TEXT,
    sourceDamageOperationKey: RULE_VALUE_KIND.TEXT,
    sourceDamageOutcomeId: RULE_VALUE_KIND.TEXT,
    recoveryTags: RULE_VALUE_KIND.TEXT,
    applicationCandidate: RULE_VALUE_KIND.BOOLEAN,
    authorized: RULE_VALUE_KIND.BOOLEAN,
    targetStateChecksum: RULE_VALUE_KIND.TEXT
  },
  execute(inputs) {
    const targetActorId = inputs.targetActorId
    const resultPath = inputs.resultPath
    const sourceDamageNodeId = inputs.sourceDamageNodeId
    const sourceDamageOperationKey = inputs.sourceDamageOperationKey
    const sourceDamageOutcomeId = inputs.sourceDamageOutcomeId
    const recoveryTags = inputs.recoveryTags
    const targetStateChecksum = inputs.targetStateChecksum
    if (
      typeof targetActorId !== 'string' ||
      !UUID.test(targetActorId) ||
      typeof resultPath !== 'string' ||
      typeof sourceDamageNodeId !== 'string' ||
      sourceDamageNodeId.length === 0 ||
      typeof sourceDamageOperationKey !== 'string' ||
      sourceDamageOperationKey.length === 0 ||
      typeof sourceDamageOutcomeId !== 'string' ||
      !UUID.test(sourceDamageOutcomeId) ||
      typeof recoveryTags !== 'string' ||
      !parseRecoveryTags(recoveryTags) ||
      typeof targetStateChecksum !== 'string' ||
      !/^[a-f0-9]{64}$/.test(targetStateChecksum)
    ) {
      throw new Error('D&D hit point maximum reduction proposal is invalid.')
    }
    return {
      targetActorId,
      resultPath,
      sourceDamageNodeId,
      sourceDamageOperationKey,
      sourceDamageOutcomeId,
      recoveryTags,
      applicationCandidate: true,
      authorized: resultPath === 'ON_SAVE_FAIL',
      targetStateChecksum
    }
  }
}
export const dnd5eScalarReductionProposalOperation: ProposalRuleOperationContract = {
  key: DND5E_SCALAR_REDUCTION_PROPOSAL_OPERATION_KEY,
  contractVersion: 1,
  executionKind: 'PROPOSAL',
  inputs: {
    targetActorId: RULE_VALUE_KIND.TEXT,
    amount: RULE_VALUE_KIND.NUMBER,
    valueDefinitionId: RULE_VALUE_KIND.TEXT,
    recoveryTriggers: RULE_VALUE_KIND.TEXT,
    terminalConsequence: RULE_VALUE_KIND.TEXT,
    targetStateChecksum: RULE_VALUE_KIND.TEXT
  },
  outputs: {
    targetActorId: RULE_VALUE_KIND.TEXT,
    amount: RULE_VALUE_KIND.NUMBER,
    valueDefinitionId: RULE_VALUE_KIND.TEXT,
    recoveryTriggers: RULE_VALUE_KIND.TEXT,
    terminalConsequence: RULE_VALUE_KIND.TEXT,
    applicationCandidate: RULE_VALUE_KIND.BOOLEAN,
    authorized: RULE_VALUE_KIND.BOOLEAN,
    targetStateChecksum: RULE_VALUE_KIND.TEXT
  },
  execute(inputs) {
    const {
      targetActorId,
      amount,
      valueDefinitionId,
      recoveryTriggers,
      terminalConsequence,
      targetStateChecksum
    } = inputs
    let triggers: unknown
    if (typeof recoveryTriggers === 'string') {
      try {
        triggers = JSON.parse(recoveryTriggers)
      } catch {
        triggers = null
      }
    }
    if (
      typeof targetActorId !== 'string' ||
      !UUID.test(targetActorId) ||
      typeof amount !== 'number' ||
      !Number.isSafeInteger(amount) ||
      amount < 1 ||
      typeof valueDefinitionId !== 'string' ||
      !UUID.test(valueDefinitionId) ||
      typeof recoveryTriggers !== 'string' ||
      !Array.isArray(triggers) ||
      typeof terminalConsequence !== 'string' ||
      terminalConsequence !== 'TARGET_DIED' ||
      typeof targetStateChecksum !== 'string' ||
      !/^[a-f0-9]{64}$/.test(targetStateChecksum)
    )
      throw new Error('D&D scalar reduction proposal is invalid.')
    if (
      triggers.length < 1 ||
      triggers.length > 2 ||
      new Set(triggers).size !== triggers.length ||
      triggers.some((trigger) => trigger !== 'SHORT_REST' && trigger !== 'LONG_REST')
    )
      throw new Error('D&D scalar reduction recovery is invalid.')
    return {
      targetActorId,
      amount,
      valueDefinitionId,
      recoveryTriggers,
      terminalConsequence,
      applicationCandidate: true,
      authorized: true,
      targetStateChecksum
    }
  }
}
export const dnd5eForcedMovementProposalOperation: ProposalRuleOperationContract = {
  key: DND5E_FORCED_MOVEMENT_PROPOSAL_OPERATION_KEY,
  contractVersion: 1,
  executionKind: 'PROPOSAL',
  inputs: {
    targetActorId: RULE_VALUE_KIND.TEXT,
    sourceEntryId: RULE_VALUE_KIND.TEXT,
    resultPath: RULE_VALUE_KIND.TEXT,
    authoredPath: RULE_VALUE_KIND.TEXT,
    direction: RULE_VALUE_KIND.TEXT,
    distanceMode: RULE_VALUE_KIND.TEXT,
    amount: RULE_VALUE_KIND.NUMBER,
    unit: RULE_VALUE_KIND.TEXT,
    actionEconomy: RULE_VALUE_KIND.TEXT,
    targetStateChecksum: RULE_VALUE_KIND.TEXT
  },
  outputs: {
    targetActorId: RULE_VALUE_KIND.TEXT,
    sourceEntryId: RULE_VALUE_KIND.TEXT,
    resultPath: RULE_VALUE_KIND.TEXT,
    authoredPath: RULE_VALUE_KIND.TEXT,
    direction: RULE_VALUE_KIND.TEXT,
    distanceMode: RULE_VALUE_KIND.TEXT,
    amount: RULE_VALUE_KIND.NUMBER,
    unit: RULE_VALUE_KIND.TEXT,
    actionEconomy: RULE_VALUE_KIND.TEXT,
    applicationCandidate: RULE_VALUE_KIND.BOOLEAN,
    authorized: RULE_VALUE_KIND.BOOLEAN,
    targetStateChecksum: RULE_VALUE_KIND.TEXT
  },
  execute(inputs) {
    const {
      targetActorId,
      sourceEntryId,
      resultPath,
      authoredPath,
      direction,
      distanceMode,
      amount,
      unit,
      actionEconomy,
      targetStateChecksum
    } = inputs
    if (
      typeof targetActorId !== 'string' ||
      !UUID.test(targetActorId) ||
      typeof sourceEntryId !== 'string' ||
      !UUID.test(sourceEntryId) ||
      (resultPath !== 'ON_SAVE_FAIL' && resultPath !== 'ON_SAVE_SUCCESS') ||
      authoredPath !== 'ON_HIT' ||
      direction !== 'TOWARD_SOURCE' ||
      distanceMode !== 'FIXED_DISTANCE' ||
      amount !== 25 ||
      unit !== 'FEET' ||
      actionEconomy !== 'NONE' ||
      typeof targetStateChecksum !== 'string' ||
      !/^[a-f0-9]{64}$/.test(targetStateChecksum)
    ) {
      throw new Error('D&D forced movement proposal is invalid.')
    }
    return {
      targetActorId,
      sourceEntryId,
      resultPath,
      authoredPath,
      direction,
      distanceMode,
      amount,
      unit,
      actionEconomy,
      applicationCandidate: true,
      authorized: resultPath === 'ON_SAVE_FAIL',
      targetStateChecksum
    }
  }
}
export const dnd5eDamageTotalOperation: PureRuleOperationContract = {
  key: DND5E_DAMAGE_TOTAL_OPERATION_KEY,
  contractVersion: 1,
  executionKind: 'PURE',
  inputs: {
    subtotal: RULE_VALUE_KIND.NUMBER,
    modifier: RULE_VALUE_KIND.NUMBER
  },
  outputs: { value: RULE_VALUE_KIND.NUMBER },
  execute(inputs) {
    const subtotal = inputs.subtotal
    const modifier = inputs.modifier
    if (
      typeof subtotal !== 'number' ||
      !Number.isSafeInteger(subtotal) ||
      typeof modifier !== 'number' ||
      !Number.isSafeInteger(modifier) ||
      !Number.isSafeInteger(subtotal + modifier)
    ) {
      throw new Error('D&D damage total requires safe integer operands.')
    }
    return { value: Math.max(0, subtotal + modifier) }
  }
}
/** Selects the one authored full-or-floor-half damage value after a nested save. */
export const dnd5eSaveDamageTotalOperation: PureRuleOperationContract = {
  key: DND5E_SAVE_DAMAGE_TOTAL_OPERATION_KEY,
  contractVersion: 1,
  executionKind: 'PURE',
  inputs: {
    subtotal: RULE_VALUE_KIND.NUMBER,
    resultPath: RULE_VALUE_KIND.TEXT
  },
  outputs: { value: RULE_VALUE_KIND.NUMBER },
  execute(inputs) {
    const subtotal = inputs.subtotal
    const resultPath = inputs.resultPath
    if (
      typeof subtotal !== 'number' ||
      !Number.isSafeInteger(subtotal) ||
      subtotal < 0 ||
      (resultPath !== 'ON_SAVE_FAIL' && resultPath !== 'ON_SAVE_SUCCESS')
    ) {
      throw new Error('D&D nested save damage requires a bounded save result and subtotal.')
    }
    return {
      value: resultPath === 'ON_SAVE_SUCCESS' ? Math.floor(subtotal / 2) : subtotal
    }
  }
}
/** Applies an authored damage multiplier to rolled damage, rounding down (SRD). */
export const dnd5eDamageMultiplierOperation: PureRuleOperationContract = {
  key: DND5E_DAMAGE_MULTIPLIER_OPERATION_KEY,
  contractVersion: 1,
  executionKind: 'PURE',
  inputs: {
    amount: RULE_VALUE_KIND.NUMBER,
    multiplier: RULE_VALUE_KIND.NUMBER
  },
  outputs: { value: RULE_VALUE_KIND.NUMBER },
  execute(inputs) {
    const amount = inputs.amount
    const multiplier = inputs.multiplier
    if (
      typeof amount !== 'number' ||
      !Number.isSafeInteger(amount) ||
      amount < 0 ||
      typeof multiplier !== 'number'
    ) {
      throw new Error('D&D damage multiplier requires a safe damage amount.')
    }
    return { value: multipliedDamageAmount(amount, multiplier) }
  }
}
export const dnd5eHealTotalOperation: PureRuleOperationContract = {
  key: DND5E_HEAL_TOTAL_OPERATION_KEY,
  contractVersion: 1,
  executionKind: 'PURE',
  inputs: {
    subtotal: RULE_VALUE_KIND.NUMBER,
    modifier: RULE_VALUE_KIND.NUMBER
  },
  outputs: { value: RULE_VALUE_KIND.NUMBER },
  execute(inputs) {
    const subtotal = inputs.subtotal
    const modifier = inputs.modifier
    if (
      typeof subtotal !== 'number' ||
      !Number.isSafeInteger(subtotal) ||
      typeof modifier !== 'number' ||
      !Number.isSafeInteger(modifier) ||
      !Number.isSafeInteger(subtotal + modifier)
    ) {
      throw new Error('D&D healing total requires safe integer operands.')
    }
    return { value: Math.max(0, subtotal + modifier) }
  }
}
export const dnd5eConditionApplyProposalOperation: ProposalRuleOperationContract = {
  key: DND5E_CONDITION_APPLY_PROPOSAL_OPERATION_KEY,
  contractVersion: 1,
  executionKind: 'PROPOSAL',
  inputs: {
    targetActorId: RULE_VALUE_KIND.TEXT,
    conditionId: RULE_VALUE_KIND.TEXT,
    conditionImmune: RULE_VALUE_KIND.BOOLEAN,
    targetStateChecksum: RULE_VALUE_KIND.TEXT
  },
  outputs: {
    targetActorId: RULE_VALUE_KIND.TEXT,
    conditionId: RULE_VALUE_KIND.TEXT,
    applicationCandidate: RULE_VALUE_KIND.BOOLEAN,
    authorized: RULE_VALUE_KIND.BOOLEAN,
    targetStateChecksum: RULE_VALUE_KIND.TEXT
  },
  execute(inputs) {
    const targetActorId = inputs.targetActorId
    const conditionId = inputs.conditionId
    if (
      typeof targetActorId !== 'string' ||
      !UUID.test(targetActorId) ||
      typeof conditionId !== 'string' ||
      !UUID.test(conditionId)
    )
      throw new Error('D&D condition proposal requires canonical target and condition identities.')
    const targetStateChecksum = inputs.targetStateChecksum
    if (typeof targetStateChecksum !== 'string' || !/^[a-f0-9]{64}$/.test(targetStateChecksum))
      throw new Error('D&D condition proposal requires target state checksum.')
    const conditionImmune = inputs.conditionImmune
    if (typeof conditionImmune !== 'boolean')
      throw new Error('D&D condition proposal requires normalized target protections.')
    return {
      targetActorId,
      conditionId,
      applicationCandidate: true,
      authorized: !conditionImmune,
      targetStateChecksum
    }
  }
}

const DND5E_TEST_OUTCOME_RULES = ['NONE', 'SAVE_AUTO_FAIL', 'HIT_IS_CRITICAL'] as const
type Dnd5eTestOutcomeRule = (typeof DND5E_TEST_OUTCOME_RULES)[number]

function isDnd5eTestOutcomeRule(value: unknown): value is Dnd5eTestOutcomeRule {
  return DND5E_TEST_OUTCOME_RULES.some((rule) => rule === value)
}

/**
 * The D&D test result path. A natural 20 always hits critically and a natural 1 always misses; a
 * target's condition can make a hit critical or a save fail without counting the roll (D94).
 */
function dnd5eTestResultPath(input: {
  kind: TestKind
  naturalD20: number
  total: number
  threshold: number
  outcomeRule: Dnd5eTestOutcomeRule
}) {
  if (input.kind === 'SAVE')
    return input.outcomeRule !== 'SAVE_AUTO_FAIL' && input.total >= input.threshold
      ? 'ON_SAVE_SUCCESS'
      : 'ON_SAVE_FAIL'
  if (input.naturalD20 === 20) return 'ON_CRIT'
  if (input.naturalD20 === 1 || input.total < input.threshold) return 'ON_MISS'
  return input.outcomeRule === 'HIT_IS_CRITICAL' ? 'ON_CRIT' : 'ON_HIT'
}

/** A target's save outcome rule: its conditions fail saves of these abilities unrolled (D94). */
function dnd5eSaveOutcomeRule(
  rules: CharacterRuleActionConditionOutcomeRules | null | undefined,
  abilityDefinitionId: string
): Dnd5eTestOutcomeRule {
  return rules?.saveAutoFailAbilityIds.includes(abilityDefinitionId) ? 'SAVE_AUTO_FAIL' : 'NONE'
}

function testOperation(key: string, kind: TestKind): PureRuleOperationContract {
  return {
    key,
    contractVersion: 2,
    executionKind: 'PURE',
    inputs: {
      targetActorId: RULE_VALUE_KIND.TEXT,
      naturalD20: RULE_VALUE_KIND.NUMBER,
      modifier: RULE_VALUE_KIND.NUMBER,
      threshold: RULE_VALUE_KIND.NUMBER,
      contributorChecksum: RULE_VALUE_KIND.TEXT,
      outcomeRule: RULE_VALUE_KIND.TEXT
    },
    outputs: {
      targetActorId: RULE_VALUE_KIND.TEXT,
      naturalD20: RULE_VALUE_KIND.NUMBER,
      total: RULE_VALUE_KIND.NUMBER,
      resultPath: RULE_VALUE_KIND.TEXT,
      contributorChecksum: RULE_VALUE_KIND.TEXT
    },
    execute(inputs) {
      const targetActorId = inputs.targetActorId
      const naturalD20 = inputs.naturalD20
      const modifier = inputs.modifier
      const threshold = inputs.threshold
      const outcomeRule = inputs.outcomeRule
      if (
        !isDnd5eTestOutcomeRule(outcomeRule) ||
        typeof targetActorId !== 'string' ||
        !UUID.test(targetActorId) ||
        typeof naturalD20 !== 'number' ||
        !Number.isSafeInteger(naturalD20) ||
        naturalD20 < 1 ||
        naturalD20 > 20 ||
        typeof modifier !== 'number' ||
        !Number.isSafeInteger(modifier) ||
        typeof threshold !== 'number' ||
        !Number.isSafeInteger(threshold)
      )
        throw new Error('D&D test resolution requires canonical target and safe integer facts.')
      const total = naturalD20 + modifier
      if (!Number.isSafeInteger(total))
        throw new Error('D&D test total exceeds safe integer range.')
      const resultPath = dnd5eTestResultPath({ kind, naturalD20, total, threshold, outcomeRule })
      const contributorChecksum = inputs.contributorChecksum
      if (typeof contributorChecksum !== 'string' || !/^[a-f0-9]{64}$/.test(contributorChecksum))
        throw new Error('D&D test resolution requires contributor evidence checksum.')
      return {
        targetActorId,
        naturalD20,
        total,
        resultPath,
        contributorChecksum
      }
    }
  }
}

export const dnd5eAttackTestOperation = testOperation(DND5E_ATTACK_TEST_OPERATION_KEY, 'ATTACK')
export const dnd5eSaveTestOperation = testOperation(DND5E_SAVE_TEST_OPERATION_KEY, 'SAVE')
export const dnd5eMovementInterruptionAuthorizationOperation: PureRuleOperationContract = {
  key: DND5E_MOVEMENT_INTERRUPTION_AUTHORIZATION_OPERATION_KEY,
  contractVersion: 1,
  executionKind: 'PURE',
  inputs: { resultPath: RULE_VALUE_KIND.TEXT, authoredPath: RULE_VALUE_KIND.TEXT },
  outputs: { authorized: RULE_VALUE_KIND.BOOLEAN },
  execute(inputs) {
    const { resultPath, authoredPath } = inputs
    if (
      typeof resultPath !== 'string' ||
      typeof authoredPath !== 'string' ||
      !isSpecializedPath(resultPath) ||
      !isSpecializedPath(authoredPath)
    )
      throw new Error('D&D movement interruption requires canonical result paths.')
    return {
      authorized:
        resultPath === authoredPath || (resultPath === 'ON_CRIT' && authoredPath === 'ON_HIT')
    }
  }
}

function testProposalOperation(
  key: string,
  payload: Readonly<Record<string, typeof RULE_VALUE_KIND.NUMBER | typeof RULE_VALUE_KIND.TEXT>>,
  conditionProtection = false
): ProposalRuleOperationContract {
  return {
    key,
    contractVersion: 1,
    executionKind: 'PROPOSAL',
    inputs: {
      targetActorId: RULE_VALUE_KIND.TEXT,
      resolvedPath: RULE_VALUE_KIND.TEXT,
      authoredPath: RULE_VALUE_KIND.TEXT,
      targetStateChecksum: RULE_VALUE_KIND.TEXT,
      ...(conditionProtection ? { conditionImmune: RULE_VALUE_KIND.BOOLEAN } : {}),
      ...payload
    },
    outputs: {
      targetActorId: RULE_VALUE_KIND.TEXT,
      resolvedPath: RULE_VALUE_KIND.TEXT,
      authoredPath: RULE_VALUE_KIND.TEXT,
      authorized: RULE_VALUE_KIND.BOOLEAN,
      applicationCandidate: RULE_VALUE_KIND.BOOLEAN,
      targetStateChecksum: RULE_VALUE_KIND.TEXT,
      ...payload
    },
    execute(inputs) {
      const targetActorId = inputs.targetActorId
      const resolvedPath = inputs.resolvedPath
      const authoredPath = inputs.authoredPath
      const targetStateChecksum = inputs.targetStateChecksum
      if (
        typeof targetActorId !== 'string' ||
        !UUID.test(targetActorId) ||
        typeof resolvedPath !== 'string' ||
        typeof authoredPath !== 'string' ||
        typeof targetStateChecksum !== 'string' ||
        !/^[a-f0-9]{64}$/.test(targetStateChecksum)
      )
        throw new Error('D&D test proposal requires exact target and path identities.')
      for (const [port, kind] of Object.entries(payload)) {
        const value = inputs[port]
        if (
          (kind === RULE_VALUE_KIND.NUMBER &&
            (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0)) ||
          (kind === RULE_VALUE_KIND.TEXT && typeof value !== 'string')
        )
          throw new Error('D&D test proposal payload is invalid.')
      }
      const conditionImmune = inputs.conditionImmune
      if (conditionProtection && typeof conditionImmune !== 'boolean')
        throw new Error('D&D test condition proposal requires normalized target protections.')
      return {
        targetActorId,
        resolvedPath,
        authoredPath,
        authorized:
          (resolvedPath === authoredPath ||
            (resolvedPath === 'ON_CRIT' && authoredPath === 'ON_HIT')) &&
          (!conditionProtection || !conditionImmune),
        applicationCandidate: true,
        targetStateChecksum,
        ...Object.fromEntries(Object.keys(payload).map((port) => [port, inputs[port]!]))
      }
    }
  }
}

export const dnd5eTestHealProposalOperation = testProposalOperation(
  DND5E_TEST_HEAL_PROPOSAL_OPERATION_KEY,
  { amount: RULE_VALUE_KIND.NUMBER }
)
export const dnd5eTestTemporaryHitPointsProposalOperation = testProposalOperation(
  DND5E_TEST_TEMPORARY_HIT_POINTS_PROPOSAL_OPERATION_KEY,
  { amount: RULE_VALUE_KIND.NUMBER }
)
export const dnd5eTestDamageProposalOperation = testProposalOperation(
  DND5E_TEST_DAMAGE_PROPOSAL_OPERATION_KEY,
  { amount: RULE_VALUE_KIND.NUMBER, damageTypeId: RULE_VALUE_KIND.TEXT }
)
export const dnd5eTestConditionProposalOperation = testProposalOperation(
  DND5E_TEST_CONDITION_PROPOSAL_OPERATION_KEY,
  { conditionId: RULE_VALUE_KIND.TEXT },
  true
)
export const dnd5eTestScalarReductionProposalOperation = testProposalOperation(
  DND5E_TEST_SCALAR_REDUCTION_PROPOSAL_OPERATION_KEY,
  {
    amount: RULE_VALUE_KIND.NUMBER,
    valueDefinitionId: RULE_VALUE_KIND.TEXT,
    recoveryTriggers: RULE_VALUE_KIND.TEXT,
    terminalConsequence: RULE_VALUE_KIND.TEXT
  }
)
/** Binds a persistent relationship's authored entry; application is owned by the effect planner. */
export const dnd5eActorRelationshipStateOperation: PureRuleOperationContract = {
  key: DND5E_ACTOR_RELATIONSHIP_STATE_OPERATION_KEY,
  contractVersion: 1,
  executionKind: 'PURE',
  inputs: {},
  outputs: {},
  execute: () => ({})
}
/** Marks one counted turn of a timed condition; the effect planner owns its removal. */
export const dnd5eConditionDurationOperation: PureRuleOperationContract = {
  key: DND5E_CONDITION_DURATION_OPERATION_KEY,
  contractVersion: 1,
  executionKind: 'PURE',
  inputs: {},
  outputs: {},
  execute: () => ({})
}
export const dnd5eEffectActionCapability: GameSystemRuleCapabilityContract = {
  gameSystemId: DND5E_SYSTEM_ID,
  contractVersion: 1,
  authoredRootKinds: ['effect'],
  definitionFamilyKeys: [
    DND5E_EFFECT_ACTION_FAMILY_KEY,
    SENSE_DEFINITION_FAMILY_KEY,
    'dnd5e-optional-combat',
    RULE_CAPABILITY_DEFINITION_FAMILY_KEY,
    CONDITION_RULE_STATE_DEFINITION_FAMILY_KEY,
    RULE_MAINTENANCE_DEFINITION_FAMILY_KEY,
    BASIC_ACTION_DEFINITION_FAMILY_KEY,
    ...new Set([
      ...dnd5eConcentrationCapabilityContribution.definitionFamilyKeys,
      ...dnd5eEncounterLifecycleCapabilityContribution.definitionFamilyKeys,
      ...dnd5eInitiativeCapabilityContribution.definitionFamilyKeys,
      ...dnd5eOptionalCombatContestCapabilityContribution.definitionFamilyKeys,
      ...dnd5eReactionEligibilityCapabilityContribution.definitionFamilyKeys
    ])
  ],
  factContracts: [
    { key: DND5E_TARGET_ACTOR_FACT_KEY, valueKind: RULE_VALUE_KIND.TEXT },
    { key: DND5E_ATTACK_MODIFIER_FACT_KEY, valueKind: RULE_VALUE_KIND.NUMBER },
    { key: DND5E_TARGET_DEFENSE_FACT_KEY, valueKind: RULE_VALUE_KIND.NUMBER },
    { key: DND5E_SAVE_MODIFIER_FACT_KEY, valueKind: RULE_VALUE_KIND.NUMBER },
    { key: DND5E_SAVE_DC_FACT_KEY, valueKind: RULE_VALUE_KIND.NUMBER },
    {
      key: DND5E_ROLL_CONTRIBUTOR_CHECKSUM_FACT_KEY,
      valueKind: RULE_VALUE_KIND.TEXT
    },
    { key: DND5E_TEST_OUTCOME_RULE_FACT_KEY, valueKind: RULE_VALUE_KIND.TEXT },
    {
      key: DND5E_TARGET_STATE_CHECKSUM_FACT_KEY,
      valueKind: RULE_VALUE_KIND.TEXT
    },
    {
      key: DND5E_TARGET_CONDITION_IMMUNE_FACT_KEY,
      valueKind: RULE_VALUE_KIND.BOOLEAN
    },
    ...Object.keys(DND5E_CONDITION_IMMUNE_FACT_KEYS).flatMap((pathCode) =>
      Array.from({ length: MAX_CONDITIONS_PER_PATH }, (_, index) => ({
        key: conditionImmuneFactKey(pathCode, index + 1)!,
        valueKind: RULE_VALUE_KIND.BOOLEAN
      }))
    ),
    ...Object.values(DND5E_RESOLVED_DAMAGE_EXPRESSION_FACT_KEYS).map((key) => ({
      key,
      valueKind: RULE_VALUE_KIND.TEXT
    })),
    {
      key: DND5E_RESOLVED_DAMAGE_OUTCOME_EXPRESSIONS_FACT_KEY,
      valueKind: RULE_VALUE_KIND.TEXT
    },
    {
      key: DND5E_RESOLVED_HEAL_MODIFIER_FACT_KEY,
      valueKind: RULE_VALUE_KIND.NUMBER
    },
    {
      key: DND5E_SPELL_CAST_LEVEL_FACT_KEY,
      valueKind: RULE_VALUE_KIND.NUMBER
    },
    { key: DND5E_CLASS_LEVELS_FACT_KEY, valueKind: RULE_VALUE_KIND.TEXT },
    {
      key: REACTION_CHOICE_MIN_FACT_KEY,
      valueKind: RULE_VALUE_KIND.NUMBER
    },
    {
      key: REACTION_CHOICE_MAX_FACT_KEY,
      valueKind: RULE_VALUE_KIND.NUMBER
    },
    ...dnd5eConcentrationCapabilityContribution.factContracts,
    ...dnd5eEncounterLifecycleCapabilityContribution.factContracts,
    ...dnd5eInitiativeCapabilityContribution.factContracts,
    ...dnd5eOptionalCombatContestCapabilityContribution.factContracts,
    ...dnd5eReactionEligibilityCapabilityContribution.factContracts
  ],
  operationContracts: [
    'evidence.integer-range',
    addNumbersRuleOperation.key,
    REACTION_CHOICE_OPERATION_KEY,
    DND5E_HEAL_PROPOSAL_OPERATION_KEY,
    DND5E_TEMPORARY_HIT_POINTS_PROPOSAL_OPERATION_KEY,
    DND5E_STABILIZE_PROPOSAL_OPERATION_KEY,
    DND5E_MODIFIER_GRANT_PROPOSAL_OPERATION_KEY,
    DND5E_MANUAL_ADJUDICATION_PROPOSAL_OPERATION_KEY,
    DND5E_CONCEAL_PROPOSAL_OPERATION_KEY,
    DND5E_DETECT_CONCEALED_PROPOSAL_OPERATION_KEY,
    DND5E_ADD_SPEED_TO_MOVEMENT_PROPOSAL_OPERATION_KEY,
    DND5E_DAMAGE_PROPOSAL_OPERATION_KEY,
    DND5E_HIT_POINT_MAXIMUM_REDUCTION_PROPOSAL_OPERATION_KEY,
    DND5E_SCALAR_REDUCTION_PROPOSAL_OPERATION_KEY,
    DND5E_FORCED_MOVEMENT_PROPOSAL_OPERATION_KEY,
    DND5E_DAMAGE_TOTAL_OPERATION_KEY,
    DND5E_SAVE_DAMAGE_TOTAL_OPERATION_KEY,
    DND5E_DAMAGE_MULTIPLIER_OPERATION_KEY,
    DND5E_HEAL_TOTAL_OPERATION_KEY,
    DND5E_CONDITION_APPLY_PROPOSAL_OPERATION_KEY,
    DND5E_ACTOR_RELATIONSHIP_STATE_OPERATION_KEY,
    DND5E_CONDITION_DURATION_OPERATION_KEY,
    DND5E_MOVEMENT_INTERRUPTION_AUTHORIZATION_OPERATION_KEY,
    DND5E_TEST_HEAL_PROPOSAL_OPERATION_KEY,
    DND5E_TEST_TEMPORARY_HIT_POINTS_PROPOSAL_OPERATION_KEY,
    DND5E_TEST_DAMAGE_PROPOSAL_OPERATION_KEY,
    DND5E_TEST_CONDITION_PROPOSAL_OPERATION_KEY,
    DND5E_TEST_SCALAR_REDUCTION_PROPOSAL_OPERATION_KEY,
    ...dnd5eConcentrationCapabilityContribution.operationContracts.map(({ key }) => key),
    ...dnd5eEncounterLifecycleCapabilityContribution.operationContracts.map(({ key }) => key),
    ...dnd5eInitiativeCapabilityContribution.operationContracts.map(({ key }) => key),
    ...dnd5eOptionalCombatContestCapabilityContribution.operationContracts.map(({ key }) => key),
    ...dnd5eReactionEligibilityCapabilityContribution.operationContracts.map(({ key }) => key)
  ]
    .filter((key, index, keys) => keys.indexOf(key) === index)
    .map((key) => ({ key, contractVersion: 1 }))
    .concat(
      [dnd5eAttackTestOperation, dnd5eSaveTestOperation].map(({ key, contractVersion }) => ({
        key,
        contractVersion
      }))
    )
}

function testProposalOperationKey(outcome: Outcome): string {
  return outcome.kind === 'HEAL'
    ? DND5E_TEST_HEAL_PROPOSAL_OPERATION_KEY
    : outcome.kind === 'TEMPORARY_HIT_POINTS'
      ? DND5E_TEST_TEMPORARY_HIT_POINTS_PROPOSAL_OPERATION_KEY
      : outcome.kind === 'DAMAGE'
        ? DND5E_TEST_DAMAGE_PROPOSAL_OPERATION_KEY
        : outcome.kind === 'SCALAR_REDUCTION'
          ? DND5E_TEST_SCALAR_REDUCTION_PROPOSAL_OPERATION_KEY
          : DND5E_TEST_CONDITION_PROPOSAL_OPERATION_KEY
}

function proposalNode(pathCode: string, outcome: Outcome) {
  if (outcome.kind === 'STABILIZE')
    unsupported('D&D stabilize outcomes cannot follow an attack or saving throw.')
  if (outcome.kind === 'MODIFIER_GRANT')
    unsupported('D&D modifier grants cannot follow an attack or saving throw.')
  if (outcome.kind === 'MANUAL_ADJUDICATION')
    unsupported('D&D manual adjudications cannot follow an attack or saving throw.')
  if (outcome.kind === 'CONCEAL' || outcome.kind === 'DETECT_CONCEALED')
    unsupported('D&D concealment outcomes cannot follow an attack or saving throw.')
  if (outcome.kind === 'ADD_SPEED_TO_MOVEMENT')
    unsupported('D&D speed-to-movement outcomes cannot follow an attack or saving throw.')
  const id = `proposal-${pathCode.toLowerCase()}`
  return {
    id,
    operation: { key: testProposalOperationKey(outcome), contractVersion: 1 },
    inputs: {
      targetActorId: {
        kind: 'FACT' as const,
        factKey: DND5E_TARGET_ACTOR_FACT_KEY
      },
      resolvedPath: {
        kind: 'NODE_OUTPUT' as const,
        nodeId: 'test',
        port: 'resultPath'
      },
      authoredPath: { kind: 'LITERAL' as const, value: pathCode },
      targetStateChecksum: {
        kind: 'FACT' as const,
        factKey: DND5E_TARGET_STATE_CHECKSUM_FACT_KEY
      },
      ...(outcome.kind === 'CONDITION_APPLY'
        ? {
            conditionId: {
              kind: 'LITERAL' as const,
              value: outcome.conditionId
            },
            conditionImmune: {
              kind: 'FACT' as const,
              factKey:
                DND5E_CONDITION_IMMUNE_FACT_KEYS[
                  pathCode as keyof typeof DND5E_CONDITION_IMMUNE_FACT_KEYS
                ]
            }
          }
        : outcome.kind === 'SCALAR_REDUCTION'
          ? {
              amount: { kind: 'LITERAL' as const, value: 1 },
              valueDefinitionId: { kind: 'LITERAL' as const, value: outcome.valueDefinitionId },
              recoveryTriggers: {
                kind: 'LITERAL' as const,
                value: JSON.stringify(outcome.recoveryTriggers)
              },
              terminalConsequence: {
                kind: 'LITERAL' as const,
                value: outcome.terminalConsequence
              }
            }
          : {
              amount: { kind: 'LITERAL' as const, value: outcome.amount },
              ...(outcome.kind === 'DAMAGE'
                ? {
                    damageTypeId: {
                      kind: 'LITERAL' as const,
                      value: outcome.damageTypeId
                    }
                  }
                : {})
            })
    }
  }
}

function compileTestDefinition(
  action: Dnd5eCompiledEffectActionSource,
  plan: TestPlan,
  recurringPlan: Omit<CharacterRuleActionActiveEffectPlan, 'frozenGraph'> | null
) {
  const modifierFact =
    plan.kind === 'ATTACK' ? DND5E_ATTACK_MODIFIER_FACT_KEY : DND5E_SAVE_MODIFIER_FACT_KEY
  const thresholdFact =
    plan.kind === 'ATTACK' ? DND5E_TARGET_DEFENSE_FACT_KEY : DND5E_SAVE_DC_FACT_KEY
  const testOperation =
    plan.kind === 'ATTACK' ? DND5E_ATTACK_TEST_OPERATION_KEY : DND5E_SAVE_TEST_OPERATION_KEY
  const proposalNodes = [...plan.branches].map(([pathCode, outcome]) =>
    proposalNode(pathCode, outcome)
  )
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
      {
        id: 'test',
        operation: { key: testOperation, contractVersion: 2 },
        inputs: {
          targetActorId: { kind: 'FACT', factKey: DND5E_TARGET_ACTOR_FACT_KEY },
          naturalD20: { kind: 'NODE_OUTPUT', nodeId: 'd20', port: 'value' },
          modifier: { kind: 'FACT', factKey: modifierFact },
          threshold: { kind: 'FACT', factKey: thresholdFact },
          contributorChecksum: {
            kind: 'FACT',
            factKey: DND5E_ROLL_CONTRIBUTOR_CHECKSUM_FACT_KEY
          },
          outcomeRule: { kind: 'FACT', factKey: DND5E_TEST_OUTCOME_RULE_FACT_KEY }
        }
      },
      ...proposalNodes
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
  return serverPublishedRuleDefinitionDtoSchema.parse({
    id: definition.id,
    gameSystemId: definition.gameSystemId,
    definitionFamilyKey: definition.definitionFamilyKey,
    checksum: checksumRuleDocument(definition),
    definition
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
    !isSupportedTestTargetPolicy(invocation) ||
    action.compiledEffect.entries.length < 1
  ) {
    unsupported('D&D test action has an unsupported bounded shape.')
  }
  if (isExactImmediateFollowUpSaveAction(action)) return 'ATTACK'
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
  const conditionCounts = new Map<string, number>()
  for (const entry of action.compiledEffect.entries) {
    if (isActiveEffectPlanOutcome(entry)) continue
    // A SEQUENCE result block applies each of its outcomes in order; OUTCOME
    // specializes every outcome as its own group, exactly like separate paths.
    if (
      entry.resolutionKind !== 'DIRECT' ||
      (entry.groupKind !== 'SINGLE' && entry.groupKind !== 'SEQUENTIAL') ||
      entry.duration ||
      entry.lifecycle ||
      entry.maintenanceDefinitionId ||
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
      const count = (conditionCounts.get(entry.pathCode) ?? 0) + 1
      if (count > MAX_CONDITIONS_PER_PATH)
        unsupported(
          'D&D test action outcome is not supported: one path applies too many conditions.'
        )
      conditionCounts.set(entry.pathCode, count)
    }
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
      {
        id: 'test',
        operation: { key: testOperation, contractVersion: 2 },
        inputs: {
          targetActorId: { kind: 'FACT', factKey: DND5E_TARGET_ACTOR_FACT_KEY },
          naturalD20: { kind: 'NODE_OUTPUT', nodeId: 'd20', port: 'value' },
          modifier: { kind: 'FACT', factKey: modifierFact },
          threshold: { kind: 'FACT', factKey: thresholdFact },
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
  const base = serverPublishedRuleDefinitionDtoSchema.parse({
    id: definition.id,
    gameSystemId: definition.gameSystemId,
    definitionFamilyKey: definition.definitionFamilyKey,
    checksum: checksumRuleDocument(definition),
    definition
  })
  const published = bindMovementInterruptionTestOutput({ action, published: base, kind })
  return { phase: 'TEST', published, templateChecksum: published.checksum }
}

function scalingLevel(source: unknown, facts: Dnd5eEffectScalingFacts): number {
  const positiveLevel = (value: unknown): number | null =>
    typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : null
  if (source === 'CHARACTER_LEVEL') {
    const value = positiveLevel(facts.characterLevel)
    if (value !== null) return value
  }
  if (source === 'PARENT_CLASS_LEVEL') {
    const value = positiveLevel(facts.parentClassLevel)
    if (value !== null) return value
  }
  if (source === 'SPELL_CAST_LEVEL') {
    const value = positiveLevel(facts.spellCastLevel)
    if (value !== null) return value
  }
  if (source === 'CLASS_LEVEL') return -1
  unsupported('D&D dice scaling facts are unavailable.')
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
  outcomes: readonly Record<string, unknown>[],
  facts: Dnd5eEffectScalingFacts,
  selectedPath: SpecializedPath,
  outcomeId: string
): string {
  const outcome = outcomes[0]
  if (!outcome) unsupported('D&D selected outcome has no authored dice value.')
  if (outcome.valueKind !== 'DICE') unsupported('D&D outcome is not a supported dice value.')
  let authored: string
  if (outcome.scalingKind === 'NONE' && typeof outcome.dice === 'string') {
    authored = outcome.dice
  } else {
    const source = outcome.scalingSource
    let level = scalingLevel(source, facts)
    if (source === 'CLASS_LEVEL') {
      const classId = outcome.classId
      if (typeof classId !== 'string') unsupported('D&D class dice scaling has no class identity.')
      const value = facts.classLevels?.[classId]
      if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0)
        unsupported('D&D class dice scaling facts are unavailable.')
      level = value
    }
    const selected = selectScalingRow(
      outcomes.filter((candidate) => typeof candidate.dice === 'string'),
      level
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
  const resolved =
    facts.resolvedDamageOutcomeExpressions?.[outcomeId] ??
    facts.resolvedDamageExpressions?.[selectedPath]
  if (!resolved) {
    if ((Array.isArray(outcome.bonuses) && outcome.bonuses.length > 0) || halfHitPointsDice)
      unsupported('D&D resolved damage expression is unavailable.')
    return authored
  }
  const resolvedTerm = parseBoundedDiceConfiguration(resolved).terms[0]!
  const matchesAuthoredDice = (dice: string) => {
    const authoredTerm = parseBoundedDiceConfiguration(dice).terms[0]!
    return authoredTerm.count === resolvedTerm.count && authoredTerm.die === resolvedTerm.die
  }
  if (
    !matchesAuthoredDice(authored) &&
    !(halfHitPointsDice && matchesAuthoredDice(halfHitPointsDice))
  )
    unsupported('D&D resolved damage expression does not match the authored dice.')
  return resolved
}

/**
 * A critical hit rolls every damage die of the attack's hit damage twice and adds the modifier
 * once (SRD 5.1). Every attack OUTCOME applies it here; authored ON_CRIT riders and the damage of
 * a save the hit forces are not the attack's damage and keep their dice.
 */
function isCriticalHitDamage(
  selectedPath: SpecializedPath,
  entry: CompiledEffectGroup['entries'][number]
): boolean {
  return (
    selectedPath === 'ON_CRIT' &&
    entry.pathCode === 'ON_HIT' &&
    'outcome' in entry &&
    entry.outcome.effectKind === 'DAMAGE'
  )
}

function diceGraphDefinition(input: {
  action: Dnd5eCompiledEffectActionSource
  entry: CompiledEffectGroup['entries'][number]
  diceConfig: string
  /** Roll the dice twice for a critical hit; the modifier is still added once. */
  critical?: boolean
  modifierFactKey?: string
  nodePrefix?: string
  recurring?: Pick<CharacterRuleActionActiveEffectPlan, 'compiledEntryId' | 'frozenGraphNodeId'>
}): RuleGraphDefinition {
  if (
    !('outcome' in input.entry) ||
    (input.entry.outcome.effectKind !== 'DAMAGE' &&
      input.entry.outcome.effectKind !== 'HEAL' &&
      input.entry.outcome.effectKind !== 'SCALAR_REDUCTION')
  )
    unsupported('Only direct D&D dice outcomes are currently specialized.')
  const outcome = input.entry.outcome
  const scalar = outcome.effectKind === 'SCALAR_REDUCTION'
  if (!scalar && outcome.valueKind !== 'DICE') unsupported('D&D outcome is not dice-backed.')
  const damageTypeId =
    outcome.effectKind === 'DAMAGE' ? damageTypeIdentity(outcome.damageTypeId) : null
  const parsed = parseBoundedDiceConfiguration(input.diceConfig)
  const authoredTerm = parsed.terms[0]
  if (!authoredTerm) unsupported('D&D dice configuration exceeds the bounded exact-dice contract.')
  const term = input.critical ? { ...authoredTerm, count: authoredTerm.count * 2 } : authoredTerm
  if (
    term.reroll ||
    term.selection ||
    term.count < 1 ||
    term.count > 31 ||
    term.die < 2 ||
    term.die > 1000
  )
    unsupported('D&D dice configuration exceeds the bounded exact-dice contract.')
  const prefix = input.nodePrefix ?? ''
  const dieNodeId = (index: number) => `${prefix}die-${index + 1}`
  const sumNodeId = (index: number) => `${prefix}sum-${index + 1}`
  const diceNodes = Array.from({ length: term.count }, (_, index) => ({
    id: dieNodeId(index),
    operation: { key: 'evidence.integer-range', contractVersion: 1 },
    inputs: {
      min: { kind: 'LITERAL' as const, value: 1 },
      max: { kind: 'LITERAL' as const, value: term.die }
    }
  }))
  const sumNodes = Array.from({ length: Math.max(0, term.count - 1) }, (_, index) => ({
    id: sumNodeId(index),
    operation: {
      key: addNumbersRuleOperation.key,
      contractVersion: addNumbersRuleOperation.contractVersion
    },
    inputs: {
      left:
        index === 0
          ? {
              kind: 'NODE_OUTPUT' as const,
              nodeId: dieNodeId(0),
              port: 'value'
            }
          : {
              kind: 'NODE_OUTPUT' as const,
              nodeId: sumNodeId(index - 1),
              port: 'value'
            },
      right: {
        kind: 'NODE_OUTPUT' as const,
        nodeId: dieNodeId(index + 1),
        port: 'value'
      }
    }
  }))
  const rolledSubtotal =
    term.count === 1
      ? { kind: 'NODE_OUTPUT' as const, nodeId: dieNodeId(0), port: 'value' }
      : {
          kind: 'NODE_OUTPUT' as const,
          nodeId: sumNodeId(term.count - 2),
          port: 'value'
        }
  const modifier = input.modifierFactKey
    ? { kind: 'FACT' as const, factKey: input.modifierFactKey }
    : { kind: 'LITERAL' as const, value: parsed.modifier }
  const needsTotal = input.modifierFactKey !== undefined || parsed.modifier !== 0
  const totalNodeId = `${prefix}${outcome.effectKind === 'DAMAGE' ? 'damage' : scalar ? 'scalar' : 'heal'}-total`
  const totalNode = !needsTotal
    ? []
    : [
        {
          id: totalNodeId,
          operation: {
            key:
              outcome.effectKind === 'DAMAGE'
                ? DND5E_DAMAGE_TOTAL_OPERATION_KEY
                : DND5E_HEAL_TOTAL_OPERATION_KEY,
            contractVersion: 1
          },
          inputs: {
            subtotal: rolledSubtotal,
            modifier
          }
        }
      ]
  const total = !needsTotal
    ? rolledSubtotal
    : { kind: 'NODE_OUTPUT' as const, nodeId: totalNodeId, port: 'value' }
  const multiplier =
    outcome.effectKind === 'DAMAGE' && damageMultiplier(outcome) !== 1
      ? damageMultiplier(outcome)
      : null
  const multipliedNodeId = `${prefix}damage-multiplied`
  const multiplierNode =
    multiplier === null
      ? []
      : [
          {
            id: multipliedNodeId,
            operation: { key: DND5E_DAMAGE_MULTIPLIER_OPERATION_KEY, contractVersion: 1 },
            inputs: {
              amount: total,
              multiplier: { kind: 'LITERAL' as const, value: multiplier }
            }
          }
        ]
  const amount =
    multiplier === null
      ? total
      : { kind: 'NODE_OUTPUT' as const, nodeId: multipliedNodeId, port: 'value' }
  const proposalId =
    input.recurring?.frozenGraphNodeId ?? `${prefix}proposal-${input.entry.pathCode.toLowerCase()}`
  const sourceEntryId = input.recurring?.compiledEntryId ?? input.entry.entryId
  const proposalOperation =
    outcome.effectKind === 'DAMAGE'
      ? DND5E_DAMAGE_PROPOSAL_OPERATION_KEY
      : scalar
        ? DND5E_SCALAR_REDUCTION_PROPOSAL_OPERATION_KEY
        : outcome.temporary
          ? DND5E_TEMPORARY_HIT_POINTS_PROPOSAL_OPERATION_KEY
          : DND5E_HEAL_PROPOSAL_OPERATION_KEY
  return {
    schemaVersion: 1,
    id: input.action.effectId,
    gameSystemId: DND5E_SYSTEM_ID,
    definitionFamilyKey: DND5E_EFFECT_ACTION_FAMILY_KEY,
    nodes: [
      ...diceNodes,
      ...sumNodes,
      ...totalNode,
      ...multiplierNode,
      {
        id: proposalId,
        operation: { key: proposalOperation, contractVersion: 1 },
        inputs: {
          targetActorId: { kind: 'FACT', factKey: DND5E_TARGET_ACTOR_FACT_KEY },
          targetStateChecksum: {
            kind: 'FACT',
            factKey: DND5E_TARGET_STATE_CHECKSUM_FACT_KEY
          },
          amount,
          ...(damageTypeId === null
            ? {}
            : { damageTypeId: { kind: 'LITERAL' as const, value: damageTypeId } }),
          ...(scalar
            ? {
                valueDefinitionId: { kind: 'LITERAL' as const, value: outcome.valueDefinitionId },
                recoveryTriggers: {
                  kind: 'LITERAL' as const,
                  value: JSON.stringify(outcome.recoveryTriggers)
                },
                terminalConsequence: {
                  kind: 'LITERAL' as const,
                  value: outcome.terminalConsequence
                }
              }
            : {})
        }
      }
    ],
    outputs: {
      targetActorId: {
        kind: 'NODE_OUTPUT',
        nodeId: proposalId,
        port: 'targetActorId'
      },
      amount: { kind: 'NODE_OUTPUT', nodeId: proposalId, port: 'amount' },
      ...(outcome.effectKind === 'DAMAGE'
        ? {
            damageTypeId: {
              kind: 'NODE_OUTPUT' as const,
              nodeId: proposalId,
              port: 'damageTypeId'
            }
          }
        : {})
    },
    ...(UUID.test(sourceEntryId)
      ? {
          sourceEntryBindings: [{ sourceEntryId, nodeId: proposalId }]
        }
      : {})
  }
}

/**
 * The exact immediate/once nested save admitted by isExactImmediateFollowUpSaveAction.
 * It either selects full or floor-half nested damage, or applies a state-only
 * maximum-hit-point reduction from the already-resolved primary damage.
 */
function immediateFollowUpSaveDamageGraphDefinition(input: {
  action: Dnd5eCompiledEffectActionSource
}): RuleGraphDefinition {
  const resolved = immediateFollowUpSaveEntries(input.action.compiledEffect.entries)
  const saveEntry = resolved?.saveEntry
  if (
    !saveEntry ||
    !('outcome' in saveEntry) ||
    saveEntry.outcome.effectKind !== 'FOLLOW_UP_SAVE'
  ) {
    unsupported('D&D immediate follow-up save source is unavailable.')
  }
  const save = saveEntry.outcome
  if (save.onFailure.kind !== 'OUTCOMES' || save.savingThrow.dcMethod !== 'FIXED_DC')
    unsupported('D&D immediate follow-up save branches are unavailable.')
  const shape = exactImmediateFollowUpSaveShape(input.action.compiledEffect.entries)
  if (!shape) unsupported('D&D immediate follow-up save shape is unavailable.')
  const failure = save.onFailure.outcomes[0]
  const reduction = immediateFollowUpSaveMaximumReduction(input.action)
  const forcedMovement =
    shape === 'FORCED_MOVEMENT_ONLY' && failure?.effectKind === 'FORCED_MOVEMENT' ? failure : null
  // Damage only on a failed save is proposed against the save's own result path.
  const failureOnlyDamage = shape === 'REPEATING_CONDITION' || shape === 'DAMAGE_ON_FAILURE'
  const nestedDamage =
    (shape === 'FULL_OR_HALF_DAMAGE' || failureOnlyDamage) &&
    failure &&
    failure.effectKind === 'DAMAGE' &&
    failure.valueKind === 'DICE' &&
    typeof failure.dice === 'string'
      ? failure
      : null
  const failureCondition =
    shape === 'REPEATING_CONDITION' || shape === 'CONDITION_ON_FAILURE'
      ? save.onFailure.outcomes.find(
          (outcome): outcome is Extract<typeof outcome, { effectKind: 'CONDITION' }> =>
            outcome.effectKind === 'CONDITION'
        )
      : null
  if (shape === 'FULL_OR_HALF_DAMAGE' && !nestedDamage)
    unsupported('D&D immediate follow-up save damage is unavailable.')
  const parsed = nestedDamage ? parseBoundedDiceConfiguration(nestedDamage.dice) : null
  const term = parsed?.terms[0]
  if (
    nestedDamage &&
    (!term ||
      term.reroll ||
      term.selection ||
      term.count < 1 ||
      term.count > 31 ||
      term.die < 2 ||
      term.die > 1000 ||
      parsed.modifier !== 0)
  ) {
    unsupported('D&D immediate follow-up save dice exceed the exact bounded contract.')
  }
  const dieId = (index: number) => `nested-save-die-${index + 1}`
  const sumId = (index: number) => `nested-save-sum-${index + 1}`
  const diceNodes = term
    ? Array.from({ length: term.count }, (_, index) => ({
        id: dieId(index),
        operation: { key: 'evidence.integer-range', contractVersion: 1 },
        inputs: {
          min: { kind: 'LITERAL' as const, value: 1 },
          max: { kind: 'LITERAL' as const, value: term.die }
        }
      }))
    : []
  const sumNodes = Array.from({ length: Math.max(0, (term?.count ?? 0) - 1) }, (_, index) => ({
    id: sumId(index),
    operation: {
      key: addNumbersRuleOperation.key,
      contractVersion: addNumbersRuleOperation.contractVersion
    },
    inputs: {
      left:
        index === 0
          ? { kind: 'NODE_OUTPUT' as const, nodeId: dieId(0), port: 'value' }
          : {
              kind: 'NODE_OUTPUT' as const,
              nodeId: sumId(index - 1),
              port: 'value'
            },
      right: {
        kind: 'NODE_OUTPUT' as const,
        nodeId: dieId(index + 1),
        port: 'value'
      }
    }
  }))
  const subtotal =
    term?.count === 1
      ? { kind: 'NODE_OUTPUT' as const, nodeId: dieId(0), port: 'value' }
      : term
        ? {
            kind: 'NODE_OUTPUT' as const,
            nodeId: sumId(term.count - 2),
            port: 'value'
          }
        : null
  const abilityDefinitionId = save.savingThrow.abilityDefinitionId
  const dc = save.savingThrow.baseDc
  if (!UUID.test(abilityDefinitionId) || !Number.isSafeInteger(dc))
    unsupported('D&D immediate follow-up save policy is unavailable.')
  return {
    schemaVersion: 1,
    id: input.action.effectId,
    gameSystemId: DND5E_SYSTEM_ID,
    definitionFamilyKey: DND5E_EFFECT_ACTION_FAMILY_KEY,
    nodes: [
      {
        id: 'nested-save-d20',
        operation: { key: 'evidence.integer-range', contractVersion: 1 },
        inputs: {
          min: { kind: 'LITERAL', value: 1 },
          max: { kind: 'LITERAL', value: 20 }
        }
      },
      {
        id: 'nested-save-test',
        operation: { key: DND5E_SAVE_TEST_OPERATION_KEY, contractVersion: 2 },
        inputs: {
          targetActorId: { kind: 'FACT', factKey: DND5E_TARGET_ACTOR_FACT_KEY },
          naturalD20: {
            kind: 'NODE_OUTPUT',
            nodeId: 'nested-save-d20',
            port: 'value'
          },
          modifier: { kind: 'FACT', factKey: DND5E_SAVE_MODIFIER_FACT_KEY },
          threshold: { kind: 'LITERAL', value: dc },
          contributorChecksum: {
            kind: 'FACT',
            factKey: DND5E_ROLL_CONTRIBUTOR_CHECKSUM_FACT_KEY
          },
          outcomeRule: { kind: 'FACT', factKey: DND5E_TEST_OUTCOME_RULE_FACT_KEY }
        }
      },
      ...(nestedDamage && subtotal
        ? [
            ...diceNodes,
            ...sumNodes,
            ...(failureOnlyDamage
              ? []
              : [
                  {
                    id: 'nested-save-damage-total',
                    operation: {
                      key: DND5E_SAVE_DAMAGE_TOTAL_OPERATION_KEY,
                      contractVersion: 1
                    },
                    inputs: {
                      subtotal,
                      resultPath: {
                        kind: 'NODE_OUTPUT' as const,
                        nodeId: 'nested-save-test',
                        port: 'resultPath'
                      }
                    }
                  }
                ]),
            {
              id: 'nested-save-proposal',
              operation: {
                key: failureOnlyDamage
                  ? DND5E_TEST_DAMAGE_PROPOSAL_OPERATION_KEY
                  : DND5E_DAMAGE_PROPOSAL_OPERATION_KEY,
                contractVersion: 1
              },
              inputs: {
                targetActorId: {
                  kind: 'FACT' as const,
                  factKey: DND5E_TARGET_ACTOR_FACT_KEY
                },
                targetStateChecksum: {
                  kind: 'FACT' as const,
                  factKey: DND5E_TARGET_STATE_CHECKSUM_FACT_KEY
                },
                amount: failureOnlyDamage
                  ? subtotal
                  : {
                      kind: 'NODE_OUTPUT' as const,
                      nodeId: 'nested-save-damage-total',
                      port: 'value'
                    },
                ...(failureOnlyDamage
                  ? {
                      resolvedPath: {
                        kind: 'NODE_OUTPUT' as const,
                        nodeId: 'nested-save-test',
                        port: 'resultPath'
                      },
                      authoredPath: {
                        kind: 'LITERAL' as const,
                        value: 'ON_SAVE_FAIL'
                      }
                    }
                  : {}),
                damageTypeId: {
                  kind: 'LITERAL' as const,
                  value: damageTypeIdentity(nestedDamage.damageTypeId)
                }
              }
            }
          ]
        : []),
      ...(reduction
        ? [
            {
              id: 'nested-save-hit-point-maximum-reduction',
              operation: {
                key: DND5E_HIT_POINT_MAXIMUM_REDUCTION_PROPOSAL_OPERATION_KEY,
                contractVersion: 1
              },
              inputs: {
                targetActorId: {
                  kind: 'FACT' as const,
                  factKey: DND5E_TARGET_ACTOR_FACT_KEY
                },
                resultPath: {
                  kind: 'NODE_OUTPUT' as const,
                  nodeId: 'nested-save-test',
                  port: 'resultPath'
                },
                sourceDamageNodeId: {
                  kind: 'LITERAL' as const,
                  value: 'proposal-on_hit'
                },
                sourceDamageOperationKey: {
                  kind: 'LITERAL' as const,
                  value: DND5E_DAMAGE_PROPOSAL_OPERATION_KEY
                },
                sourceDamageOutcomeId: {
                  kind: 'LITERAL' as const,
                  value: reduction.amountSource.damageOutcomeId
                },
                recoveryTags: {
                  kind: 'LITERAL' as const,
                  value: JSON.stringify(reduction.recoveryTags)
                },
                targetStateChecksum: {
                  kind: 'FACT' as const,
                  factKey: DND5E_TARGET_STATE_CHECKSUM_FACT_KEY
                }
              }
            }
          ]
        : []),
      ...(forcedMovement && forcedMovement.distanceMode === 'FIXED_DISTANCE'
        ? [
            {
              id: 'nested-save-forced-movement',
              operation: {
                key: DND5E_FORCED_MOVEMENT_PROPOSAL_OPERATION_KEY,
                contractVersion: 1
              },
              inputs: {
                targetActorId: {
                  kind: 'FACT' as const,
                  factKey: DND5E_TARGET_ACTOR_FACT_KEY
                },
                sourceEntryId: {
                  kind: 'LITERAL' as const,
                  value: forcedMovement.id
                },
                resultPath: {
                  kind: 'NODE_OUTPUT' as const,
                  nodeId: 'nested-save-test',
                  port: 'resultPath'
                },
                authoredPath: { kind: 'LITERAL' as const, value: 'ON_HIT' },
                direction: {
                  kind: 'LITERAL' as const,
                  value: forcedMovement.direction
                },
                distanceMode: {
                  kind: 'LITERAL' as const,
                  value: forcedMovement.distanceMode
                },
                amount: {
                  kind: 'LITERAL' as const,
                  value: forcedMovement.amount
                },
                unit: { kind: 'LITERAL' as const, value: forcedMovement.unit },
                actionEconomy: {
                  kind: 'LITERAL' as const,
                  value: forcedMovement.actionEconomy
                },
                targetStateChecksum: {
                  kind: 'FACT' as const,
                  factKey: DND5E_TARGET_STATE_CHECKSUM_FACT_KEY
                }
              }
            }
          ]
        : []),
      ...(failureCondition
        ? [
            {
              id: 'nested-save-condition',
              operation: {
                key: DND5E_TEST_CONDITION_PROPOSAL_OPERATION_KEY,
                contractVersion: 1
              },
              inputs: {
                targetActorId: {
                  kind: 'FACT' as const,
                  factKey: DND5E_TARGET_ACTOR_FACT_KEY
                },
                resolvedPath: {
                  kind: 'NODE_OUTPUT' as const,
                  nodeId: 'nested-save-test',
                  port: 'resultPath'
                },
                authoredPath: {
                  kind: 'LITERAL' as const,
                  value: 'ON_SAVE_FAIL'
                },
                conditionId: {
                  kind: 'LITERAL' as const,
                  value: failureCondition.conditionId
                },
                conditionImmune: {
                  kind: 'FACT' as const,
                  factKey: DND5E_CONDITION_IMMUNE_FACT_KEYS.ON_SAVE_FAIL
                },
                targetStateChecksum: {
                  kind: 'FACT' as const,
                  factKey: DND5E_TARGET_STATE_CHECKSUM_FACT_KEY
                }
              }
            }
          ]
        : [])
    ],
    outputs: {
      ...(nestedDamage
        ? {
            targetActorId: {
              kind: 'NODE_OUTPUT' as const,
              nodeId: 'nested-save-proposal',
              port: 'targetActorId'
            },
            amount: {
              kind: 'NODE_OUTPUT' as const,
              nodeId: 'nested-save-proposal',
              port: 'amount'
            },
            damageTypeId: {
              kind: 'NODE_OUTPUT' as const,
              nodeId: 'nested-save-proposal',
              port: 'damageTypeId'
            }
          }
        : {}),
      nestedSaveAbilityDefinitionId: {
        kind: 'LITERAL',
        value: abilityDefinitionId
      }
    },
    sourceEntryBindings: [
      {
        sourceEntryId: saveEntry.entryId,
        nodeId: nestedDamage ? 'nested-save-proposal' : 'nested-save-test'
      },
      ...(reduction
        ? [
            {
              sourceEntryId: reduction.id,
              nodeId: 'nested-save-hit-point-maximum-reduction'
            }
          ]
        : []),
      ...(forcedMovement
        ? [
            {
              sourceEntryId: forcedMovement.id,
              nodeId: 'nested-save-forced-movement'
            }
          ]
        : []),
      ...(failureCondition
        ? [
            {
              sourceEntryId: failureCondition.id,
              nodeId: 'nested-save-condition'
            }
          ]
        : [])
    ]
  }
}

function fixedOutcomeGraphDefinition(input: {
  action: Dnd5eCompiledEffectActionSource
  entry: CompiledEffectGroup['entries'][number]
  outcome: Outcome
  nodePrefix?: string
  /** The condition's place among its path's conditions, which selects its immunity fact. */
  conditionOrdinal?: number
}): RuleGraphDefinition {
  const proposalId = `${input.nodePrefix ?? ''}proposal-${input.entry.pathCode.toLowerCase()}`
  const operation =
    input.outcome.kind === 'HEAL'
      ? DND5E_HEAL_PROPOSAL_OPERATION_KEY
      : input.outcome.kind === 'TEMPORARY_HIT_POINTS'
        ? DND5E_TEMPORARY_HIT_POINTS_PROPOSAL_OPERATION_KEY
        : input.outcome.kind === 'DAMAGE'
          ? DND5E_DAMAGE_PROPOSAL_OPERATION_KEY
          : input.outcome.kind === 'STABILIZE'
            ? DND5E_STABILIZE_PROPOSAL_OPERATION_KEY
            : input.outcome.kind === 'MODIFIER_GRANT'
              ? DND5E_MODIFIER_GRANT_PROPOSAL_OPERATION_KEY
              : input.outcome.kind === 'MANUAL_ADJUDICATION'
                ? DND5E_MANUAL_ADJUDICATION_PROPOSAL_OPERATION_KEY
                : input.outcome.kind === 'CONCEAL'
                  ? DND5E_CONCEAL_PROPOSAL_OPERATION_KEY
                  : input.outcome.kind === 'DETECT_CONCEALED'
                    ? DND5E_DETECT_CONCEALED_PROPOSAL_OPERATION_KEY
                    : input.outcome.kind === 'ADD_SPEED_TO_MOVEMENT'
                      ? DND5E_ADD_SPEED_TO_MOVEMENT_PROPOSAL_OPERATION_KEY
                      : DND5E_CONDITION_APPLY_PROPOSAL_OPERATION_KEY
  const inputs = {
    targetActorId: {
      kind: 'FACT' as const,
      factKey: DND5E_TARGET_ACTOR_FACT_KEY
    },
    targetStateChecksum: {
      kind: 'FACT' as const,
      factKey: DND5E_TARGET_STATE_CHECKSUM_FACT_KEY
    },
    ...(input.outcome.kind === 'STABILIZE' ||
    input.outcome.kind === 'MODIFIER_GRANT' ||
    input.outcome.kind === 'MANUAL_ADJUDICATION' ||
    input.outcome.kind === 'CONCEAL' ||
    input.outcome.kind === 'DETECT_CONCEALED' ||
    input.outcome.kind === 'ADD_SPEED_TO_MOVEMENT'
      ? {}
      : input.outcome.kind === 'CONDITION_APPLY'
        ? {
            conditionId: {
              kind: 'LITERAL' as const,
              value: input.outcome.conditionId
            },
            conditionImmune: {
              kind: 'FACT' as const,
              factKey:
                conditionImmuneFactKey(input.entry.pathCode, input.conditionOrdinal ?? 1) ??
                unsupported('D&D result path applies too many conditions.')
            }
          }
        : {
            amount: { kind: 'LITERAL' as const, value: input.outcome.amount },
            ...(input.outcome.kind === 'DAMAGE'
              ? {
                  damageTypeId: {
                    kind: 'LITERAL' as const,
                    value: input.outcome.damageTypeId
                  }
                }
              : {})
          })
  }
  const outputs = {
    targetActorId: {
      kind: 'NODE_OUTPUT' as const,
      nodeId: proposalId,
      port: 'targetActorId'
    },
    ...(input.outcome.kind === 'STABILIZE' ||
    input.outcome.kind === 'MODIFIER_GRANT' ||
    input.outcome.kind === 'MANUAL_ADJUDICATION' ||
    input.outcome.kind === 'CONCEAL' ||
    input.outcome.kind === 'DETECT_CONCEALED' ||
    input.outcome.kind === 'ADD_SPEED_TO_MOVEMENT'
      ? {}
      : input.outcome.kind === 'CONDITION_APPLY'
        ? {
            conditionId: {
              kind: 'NODE_OUTPUT' as const,
              nodeId: proposalId,
              port: 'conditionId'
            }
          }
        : {
            amount: {
              kind: 'NODE_OUTPUT' as const,
              nodeId: proposalId,
              port: 'amount'
            },
            ...(input.outcome.kind === 'DAMAGE'
              ? {
                  damageTypeId: {
                    kind: 'NODE_OUTPUT' as const,
                    nodeId: proposalId,
                    port: 'damageTypeId'
                  }
                }
              : {})
          })
  }
  return {
    schemaVersion: 1,
    id: input.action.effectId,
    gameSystemId: DND5E_SYSTEM_ID,
    definitionFamilyKey: DND5E_EFFECT_ACTION_FAMILY_KEY,
    nodes: [
      {
        id: proposalId,
        operation: { key: operation, contractVersion: 1 },
        inputs
      }
    ],
    outputs,
    ...(UUID.test(input.entry.entryId)
      ? {
          sourceEntryBindings: [{ sourceEntryId: input.entry.entryId, nodeId: proposalId }]
        }
      : {})
  }
}

/** The authored result path in a direct proposal node id: `[prefix]proposal-<path>`. */
function proposalNodePathCode(nodeId: string): string | null {
  return /(?:^|-)proposal-([a-z_]+)$/.exec(nodeId)?.[1]?.toUpperCase() ?? null
}

function authoredOutcomeGroups(
  action: Dnd5eCompiledEffectActionSource,
  pathCode: SpecializedPath
): readonly (readonly CompiledEffectGroup['entries'][number][])[] {
  const entries = action.compiledEffect.entries.filter(
    (entry) => entry.pathCode === pathCode && !isActiveEffectPlanOutcome(entry)
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

/** An optional rider's entry resolves only when the player chose its rider; every other entry always does. */
function isChosenEntry(
  entry: CompiledEffectGroup['entries'][number] | undefined,
  facts: Dnd5eEffectScalingFacts
): boolean {
  const optionalRider = entry && 'optionalRider' in entry ? entry.optionalRider : undefined
  return !optionalRider || (facts.selectedOptionalRiderIds ?? []).includes(optionalRider.riderId)
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

function specializeDnd5eEffectActionOutcomeBody(input: {
  action: Dnd5eCompiledEffectActionSource
  selectedPath: SpecializedPath
  facts: Dnd5eEffectScalingFacts
}): Dnd5eEffectActionTemplate | null {
  supportedTestPhaseKind(input.action)
  assertKnownTestResultPath(input.action, input.selectedPath)
  if (
    (input.selectedPath === 'ON_HIT' || input.selectedPath === 'ON_CRIT') &&
    isExactImmediateFollowUpSaveAction(input.action)
  ) {
    const immediate = immediateFollowUpSaveEntries(input.action.compiledEffect.entries)
    if (!immediate) unsupported('D&D immediate follow-up save primary damage is unavailable.')
    const primaryDefinitions = immediate.primaryDamageEntries.map((primaryDamageEntry, index) => {
      if (!('outcome' in primaryDamageEntry))
        unsupported('D&D immediate follow-up save primary damage is unavailable.')
      const primaryDamage = specializedTestOutcome(primaryDamageEntry)
      const nodePrefix =
        immediate.primaryDamageEntries.length > 1 ? { nodePrefix: `primary-${index + 1}-` } : {}
      // A fixed amount ("1 piercing damage") has no dice to double on a critical hit.
      if (primaryDamage.kind === 'DAMAGE')
        return fixedOutcomeGraphDefinition({
          action: input.action,
          entry: primaryDamageEntry,
          outcome: primaryDamage,
          ...nodePrefix
        })
      if (primaryDamage.kind !== 'DICE_DAMAGE')
        unsupported('D&D immediate follow-up save requires damage before the save.')
      const primaryDiceConfiguration = exactDiceConfiguration(
        [primaryDamageEntry.outcome as unknown as Record<string, unknown>],
        input.facts,
        input.selectedPath,
        compiledOutcomeIdentity(primaryDamageEntry)
      )
      return diceGraphDefinition({
        action: input.action,
        entry: primaryDamageEntry,
        diceConfig: primaryDiceConfiguration,
        critical: isCriticalHitDamage(input.selectedPath, primaryDamageEntry),
        ...nodePrefix
      })
    })
    const definition = mergedOutcomeGraphDefinition({
      action: input.action,
      definitions: [
        ...primaryDefinitions,
        immediateFollowUpSaveDamageGraphDefinition({ action: input.action })
      ]
    })
    const published = serverPublishedRuleDefinitionDtoSchema.parse({
      id: definition.id,
      gameSystemId: definition.gameSystemId,
      definitionFamilyKey: definition.definitionFamilyKey,
      checksum: checksumRuleDocument(definition),
      definition
    })
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
    const entry = repeatingDirectFollowUpSaveConditionEntry(input.action)
    if (!entry) unsupported('D&D direct repeated save condition is unavailable.')
    const outcome = specializedTestOutcome(entry)
    if (outcome.kind !== 'CONDITION_APPLY')
      unsupported('D&D direct repeated save condition is unavailable.')
    const definition = fixedOutcomeGraphDefinition({
      action: input.action,
      entry,
      outcome
    })
    const published = serverPublishedRuleDefinitionDtoSchema.parse({
      id: definition.id,
      gameSystemId: definition.gameSystemId,
      definitionFamilyKey: definition.definitionFamilyKey,
      checksum: checksumRuleDocument(definition),
      definition
    })
    return {
      phase: 'OUTCOME',
      published,
      templateChecksum: checksumRuleDocument([entry])
    }
  }
  const authoredGroups = selectedOutcomeGroups(input.action, input.selectedPath)
  const groups = authoredGroups.filter(([entry]) => isChosenEntry(entry, input.facts))
  if (groups.length === 0) return null
  const definitions = groups.map((entries, groupIndex) => {
    const entry = entries[0]
    if (!entry) unsupported('D&D selected outcome path is unavailable.')
    const outcome = specializedTestOutcome(entry)
    const groupNodePrefix = groups.length > 1 ? { nodePrefix: `outcome${groupIndex + 1}-` } : {}
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
                      (candidate as Extract<typeof candidate, { outcome: unknown }>)
                        .outcome as unknown as Record<string, unknown>
                  ),
                  input.facts,
                  input.selectedPath,
                  compiledOutcomeIdentity(entry)
                )
              : outcome.kind === 'DICE_SCALAR_REDUCTION'
                ? outcome.diceConfig
                : compiledDiceConfiguration(entry),
          critical: isCriticalHitDamage(input.selectedPath, entry),
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
  const definition = mergedOutcomeGraphDefinition({
    action: input.action,
    definitions
  })
  const published = serverPublishedRuleDefinitionDtoSchema.parse({
    id: definition.id,
    gameSystemId: definition.gameSystemId,
    definitionFamilyKey: definition.definitionFamilyKey,
    checksum: checksumRuleDocument(definition),
    definition
  })
  return {
    phase: 'OUTCOME',
    published,
    // The selected authored result groups, chosen optional riders included or not, are the
    // immutable OUTCOME template; the published checksum above identifies its locked dice
    // and rider specialization.
    templateChecksum: checksumRuleDocument(authoredGroups)
  }
}

/**
 * A movement interruption is an explicit authored reaction binding.  The
 * compiler projects it into the graph so execution never infers it from an
 * action label, outcome, or system-specific branch.
 */
function movementInterruptionOf(action: Dnd5eCompiledEffectActionSource) {
  const { invocation } = action.compiledEffect
  const trigger = 'reactionTrigger' in invocation ? invocation.reactionTrigger : undefined
  return trigger?.kind === 'MOVEMENT' ? trigger.movementInterruption : null
}

function bindMovementInterruptionTestOutput(input: {
  action: Dnd5eCompiledEffectActionSource
  published: ServerPublishedRuleDefinitionDto
  kind: TestKind
}): ServerPublishedRuleDefinitionDto {
  const binding = movementInterruptionOf(input.action)
  if (binding?.kind !== 'STOP') return input.published
  const allowedPaths =
    input.kind === 'ATTACK' ? ['ON_HIT', 'ON_MISS', 'ON_CRIT'] : ['ON_SAVE_FAIL', 'ON_SAVE_SUCCESS']
  if (
    !allowedPaths.includes(binding.whenResultPath) ||
    !input.action.compiledEffect.entries.some((entry) => entry.pathCode === binding.whenResultPath)
  )
    throw new Dnd5eEffectActionCompilerError(
      'Movement interruption must bind one exact authored D&D test path.'
    )
  return withMovementInterruption(input.published, binding.whenResultPath)
}

/** Adds the output that stops the mover when the test resolves to `whenResultPath`. */
function withMovementInterruption(
  published: ServerPublishedRuleDefinitionDto,
  whenResultPath: string
): ServerPublishedRuleDefinitionDto {
  const definition: RuleGraphDefinition = {
    ...published.definition,
    nodes: [
      ...published.definition.nodes,
      {
        id: 'movement-interruption',
        operation: {
          key: DND5E_MOVEMENT_INTERRUPTION_AUTHORIZATION_OPERATION_KEY,
          contractVersion: 1
        },
        inputs: {
          resultPath: { kind: 'NODE_OUTPUT', nodeId: 'test', port: 'resultPath' },
          authoredPath: { kind: 'LITERAL', value: whenResultPath }
        }
      }
    ],
    outputs: {
      ...published.definition.outputs,
      movementInterruption: {
        kind: 'NODE_OUTPUT',
        nodeId: 'movement-interruption',
        port: 'authorized'
      }
    }
  }
  return serverPublishedRuleDefinitionDtoSchema.parse({
    ...published,
    checksum: checksumRuleDocument(definition),
    definition
  })
}

function bindMovementInterruptionOutput(input: {
  action: Dnd5eCompiledEffectActionSource
  published: ServerPublishedRuleDefinitionDto
}): ServerPublishedRuleDefinitionDto {
  const binding = movementInterruptionOf(input.action)
  if (binding?.kind !== 'STOP') return input.published

  const proposalNodeId = `proposal-${binding.whenResultPath.toLowerCase()}`
  const proposal = input.published.definition.nodes.find((node) => node.id === proposalNodeId)
  if (
    !proposal ||
    proposal.inputs.authoredPath?.kind !== 'LITERAL' ||
    proposal.inputs.authoredPath.value !== binding.whenResultPath
  ) {
    throw new Dnd5eEffectActionCompilerError(
      'Movement interruption must bind one exact D&D test proposal path.'
    )
  }

  const definition: RuleGraphDefinition = {
    ...input.published.definition,
    outputs: {
      ...input.published.definition.outputs,
      movementInterruption: {
        kind: 'NODE_OUTPUT',
        nodeId: proposalNodeId,
        port: 'authorized'
      }
    }
  }
  return serverPublishedRuleDefinitionDtoSchema.parse({
    ...input.published,
    checksum: checksumRuleDocument(definition),
    definition
  })
}

/** Whether the active-effect plan the action ends up with is held under a maintained effect. */
function startsMaintainedEffect(action: Dnd5eCompiledEffectActionSource): boolean {
  const plan =
    repeatingDirectFollowUpSavePlan(action) ??
    repeatingImmediateFollowUpSavePlan(action) ??
    timedImmediateConditionPlan(action) ??
    modifierGrantPlan(action) ??
    relationshipPlan(action) ??
    supportedRecurringPlan(action)
  return plan?.maintenance != null
}

function compileDnd5eEffectAction({
  action
}: {
  action: Dnd5eCompiledEffectActionSource
}): ServerPublishedRuleDefinitionDto {
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
  if (isExactImmediateFollowUpSaveAction(action) || repeatingDirectFollowUpSavePlan(action)) {
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
  const outcome = supported(action)
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
      diceConfig: healDiceConfiguration(
        entry.outcome as unknown as Record<string, unknown>,
        action.spellCastLevel
      ),
      modifierFactKey: DND5E_RESOLVED_HEAL_MODIFIER_FACT_KEY,
      ...(recurringPlan ? { recurring: recurringPlan } : {})
    })
    return bindMovementInterruptionOutput({
      action,
      published: serverPublishedRuleDefinitionDtoSchema.parse({
        id: definition.id,
        gameSystemId: definition.gameSystemId,
        definitionFamilyKey: definition.definitionFamilyKey,
        checksum: checksumRuleDocument(definition),
        definition
      })
    })
  }
  if (outcome.kind === 'DICE_DAMAGE')
    unsupported('D&D direct dice damage requires an authored test phase.')
  if (outcome.kind === 'DICE_SCALAR_REDUCTION')
    unsupported('D&D direct dice scalar reduction requires an authored test phase.')
  const operation =
    outcome.kind === 'HEAL'
      ? DND5E_HEAL_PROPOSAL_OPERATION_KEY
      : outcome.kind === 'TEMPORARY_HIT_POINTS'
        ? DND5E_TEMPORARY_HIT_POINTS_PROPOSAL_OPERATION_KEY
        : outcome.kind === 'DAMAGE'
          ? DND5E_DAMAGE_PROPOSAL_OPERATION_KEY
          : outcome.kind === 'STABILIZE'
            ? DND5E_STABILIZE_PROPOSAL_OPERATION_KEY
            : outcome.kind === 'MODIFIER_GRANT'
              ? DND5E_MODIFIER_GRANT_PROPOSAL_OPERATION_KEY
              : outcome.kind === 'MANUAL_ADJUDICATION'
                ? DND5E_MANUAL_ADJUDICATION_PROPOSAL_OPERATION_KEY
                : outcome.kind === 'CONCEAL'
                  ? DND5E_CONCEAL_PROPOSAL_OPERATION_KEY
                  : outcome.kind === 'DETECT_CONCEALED'
                    ? DND5E_DETECT_CONCEALED_PROPOSAL_OPERATION_KEY
                    : outcome.kind === 'ADD_SPEED_TO_MOVEMENT'
                      ? DND5E_ADD_SPEED_TO_MOVEMENT_PROPOSAL_OPERATION_KEY
                      : DND5E_CONDITION_APPLY_PROPOSAL_OPERATION_KEY
  const nodeId = recurringPlan ? recurringPlan.frozenGraphNodeId : outcome.kind.toLowerCase()
  const definition: RuleGraphDefinition = {
    schemaVersion: 1,
    id: action.effectId,
    gameSystemId: DND5E_SYSTEM_ID,
    definitionFamilyKey: DND5E_EFFECT_ACTION_FAMILY_KEY,
    nodes: [
      {
        id: nodeId,
        operation: { key: operation, contractVersion: 1 },
        inputs: {
          targetActorId: { kind: 'FACT', factKey: DND5E_TARGET_ACTOR_FACT_KEY },
          targetStateChecksum: {
            kind: 'FACT',
            factKey: DND5E_TARGET_STATE_CHECKSUM_FACT_KEY
          },
          ...(outcome.kind === 'STABILIZE' ||
          outcome.kind === 'MODIFIER_GRANT' ||
          outcome.kind === 'MANUAL_ADJUDICATION' ||
          outcome.kind === 'CONCEAL' ||
          outcome.kind === 'DETECT_CONCEALED' ||
          outcome.kind === 'ADD_SPEED_TO_MOVEMENT'
            ? {}
            : outcome.kind === 'CONDITION_APPLY'
              ? {
                  conditionId: { kind: 'LITERAL', value: outcome.conditionId },
                  conditionImmune: {
                    kind: 'FACT',
                    factKey: DND5E_TARGET_CONDITION_IMMUNE_FACT_KEY
                  }
                }
              : {
                  amount: { kind: 'LITERAL', value: outcome.amount },
                  ...(outcome.kind === 'DAMAGE'
                    ? {
                        damageTypeId: {
                          kind: 'LITERAL',
                          value: outcome.damageTypeId
                        }
                      }
                    : {})
                })
        }
      }
    ],
    outputs: {
      targetActorId: { kind: 'NODE_OUTPUT', nodeId, port: 'targetActorId' },
      ...(outcome.kind === 'STABILIZE' ||
      outcome.kind === 'MODIFIER_GRANT' ||
      outcome.kind === 'MANUAL_ADJUDICATION' ||
      outcome.kind === 'CONCEAL' ||
      outcome.kind === 'DETECT_CONCEALED' ||
      outcome.kind === 'ADD_SPEED_TO_MOVEMENT'
        ? {}
        : outcome.kind === 'CONDITION_APPLY'
          ? { conditionId: { kind: 'NODE_OUTPUT', nodeId, port: 'conditionId' } }
          : {
              amount: { kind: 'NODE_OUTPUT', nodeId, port: 'amount' },
              ...(outcome.kind === 'DAMAGE'
                ? {
                    damageTypeId: {
                      kind: 'NODE_OUTPUT',
                      nodeId,
                      port: 'damageTypeId'
                    }
                  }
                : {})
            })
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
    published: serverPublishedRuleDefinitionDtoSchema.parse({
      id: definition.id,
      gameSystemId: definition.gameSystemId,
      definitionFamilyKey: definition.definitionFamilyKey,
      checksum: checksumRuleDocument(definition),
      definition
    })
  })
}
function positive(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0
}

function hitPointStateIsValid(input: {
  currentHitPoints: number
  maximumHitPoints: number
  temporaryHitPoints: number
}): boolean {
  return (
    Number.isSafeInteger(input.currentHitPoints) &&
    Number.isSafeInteger(input.maximumHitPoints) &&
    Number.isSafeInteger(input.temporaryHitPoints) &&
    input.currentHitPoints >= 0 &&
    input.maximumHitPoints >= 0 &&
    input.temporaryHitPoints >= 0 &&
    input.currentHitPoints <= input.maximumHitPoints
  )
}

function testApplications(
  input: Parameters<CharacterRuleActionSystemAdapter['interpret']>[0],
  replacementPath?: 'ON_SAVE_SUCCESS'
): readonly CharacterRuleActionApplication[] | null {
  const { execution, published } = input
  const [d20Trace, testTrace, ...remainingTraces] = execution.evidence.trace
  const containsRootTestTrace = input.execution.evidence.trace.some(
    (trace) => trace.nodeId === 'd20' || trace.nodeId === 'test'
  )
  if (
    d20Trace?.nodeId !== 'd20' ||
    d20Trace?.operation.key !== 'evidence.integer-range' ||
    d20Trace.operation.contractVersion !== 1 ||
    d20Trace.inputs.min !== 1 ||
    d20Trace.inputs.max !== 20 ||
    d20Trace.evidence?.kind !== 'INTEGER_RANGE' ||
    d20Trace.evidence.requestId !== `${input.occurrenceId}:0:d20` ||
    testTrace?.nodeId !== 'test' ||
    (testTrace.operation.key !== DND5E_ATTACK_TEST_OPERATION_KEY &&
      testTrace.operation.key !== DND5E_SAVE_TEST_OPERATION_KEY)
  ) {
    if (containsRootTestTrace)
      throw new Dnd5eEffectActionCompilerError('The committed D&D test graph topology is invalid.')
    return null
  }
  const source = execution.evidence.source
  if (
    source.definitionId !== published.id ||
    source.gameSystemId !== published.gameSystemId ||
    source.definitionFamilyKey !== published.definitionFamilyKey ||
    source.checksum !== published.checksum
  )
    throw new Dnd5eEffectActionCompilerError('The committed D&D test source identity is invalid.')
  const expectedNodes = new Map(
    published.definition.nodes.map((node) => [
      node.id,
      `${node.operation.key}:${node.operation.contractVersion}`
    ])
  )
  const seenNodes = new Set<string>()
  if (
    execution.evidence.trace.length !== expectedNodes.size ||
    execution.evidence.trace.some((trace) => {
      if (seenNodes.has(trace.nodeId)) return true
      seenNodes.add(trace.nodeId)
      return (
        expectedNodes.get(trace.nodeId) !==
        `${trace.operation.key}:${trace.operation.contractVersion}`
      )
    })
  )
    throw new Dnd5eEffectActionCompilerError('The committed D&D test graph topology is invalid.')
  const movementInterruptionTraces = remainingTraces.filter(
    (trace) => trace.nodeId === 'movement-interruption'
  )
  if (movementInterruptionTraces.length > 1)
    throw new Dnd5eEffectActionCompilerError(
      'The committed D&D test movement interruption topology is invalid.'
    )
  const movementInterruptionTrace = movementInterruptionTraces[0]
  if (movementInterruptionTrace) {
    const movementInterruptionNode = published.definition.nodes.find(
      (node) => node.id === 'movement-interruption'
    )
    const resultPathBinding = movementInterruptionNode?.inputs.resultPath
    const authoredPathBinding = movementInterruptionNode?.inputs.authoredPath
    const movementInterruptionOutput = published.definition.outputs.movementInterruption
    const resultPath = testTrace.outputs.resultPath
    const authoredPath = movementInterruptionTrace.inputs.authoredPath
    if (
      typeof resultPath !== 'string' ||
      typeof authoredPath !== 'string' ||
      !isSpecializedPath(resultPath) ||
      !isSpecializedPath(authoredPath)
    )
      throw new Dnd5eEffectActionCompilerError(
        'The committed D&D test movement interruption topology is invalid.'
      )
    const expected = dnd5eMovementInterruptionAuthorizationOperation.execute({
      resultPath,
      authoredPath
    }).authorized
    if (
      movementInterruptionTrace.operation.key !==
        DND5E_MOVEMENT_INTERRUPTION_AUTHORIZATION_OPERATION_KEY ||
      movementInterruptionTrace.operation.contractVersion !== 1 ||
      movementInterruptionNode?.operation.key !==
        DND5E_MOVEMENT_INTERRUPTION_AUTHORIZATION_OPERATION_KEY ||
      movementInterruptionNode?.operation.contractVersion !== 1 ||
      resultPathBinding?.kind !== 'NODE_OUTPUT' ||
      resultPathBinding.nodeId !== 'test' ||
      resultPathBinding.port !== 'resultPath' ||
      authoredPathBinding?.kind !== 'LITERAL' ||
      movementInterruptionTrace.inputs.resultPath !== resultPath ||
      authoredPath !== authoredPathBinding.value ||
      typeof movementInterruptionTrace.outputs.authorized !== 'boolean' ||
      movementInterruptionTrace.outputs.authorized !== expected ||
      movementInterruptionOutput?.kind !== 'NODE_OUTPUT' ||
      movementInterruptionOutput.nodeId !== 'movement-interruption' ||
      movementInterruptionOutput.port !== 'authorized' ||
      execution.outputs.movementInterruption !== movementInterruptionTrace.outputs.authorized
    )
      throw new Dnd5eEffectActionCompilerError(
        'The committed D&D test movement interruption topology is invalid.'
      )
  }
  const proposalTraces = remainingTraces.filter((trace) => trace.nodeId !== 'movement-interruption')
  const naturalD20 = testTrace.outputs.naturalD20
  const modifier = testTrace.inputs.modifier
  const threshold = testTrace.inputs.threshold
  const targetActorId = testTrace.outputs.targetActorId
  const resultPath = testTrace.outputs.resultPath
  if (
    targetActorId !== input.targetActorId ||
    testTrace.inputs.targetActorId !== input.targetActorId ||
    naturalD20 !== d20Trace.evidence.value ||
    typeof naturalD20 !== 'number' ||
    typeof naturalD20 !== 'number' ||
    !Number.isSafeInteger(naturalD20) ||
    naturalD20 < 1 ||
    naturalD20 > 20 ||
    typeof modifier !== 'number' ||
    !Number.isSafeInteger(modifier) ||
    typeof threshold !== 'number' ||
    !Number.isSafeInteger(threshold) ||
    testTrace.outputs.total !== naturalD20 + modifier ||
    typeof resultPath !== 'string'
  )
    throw new Dnd5eEffectActionCompilerError('The committed D&D test result trace is invalid.')
  const attack = testTrace.operation.key === DND5E_ATTACK_TEST_OPERATION_KEY
  const modifierFactKey = attack ? DND5E_ATTACK_MODIFIER_FACT_KEY : DND5E_SAVE_MODIFIER_FACT_KEY
  const thresholdFactKey = attack ? DND5E_TARGET_DEFENSE_FACT_KEY : DND5E_SAVE_DC_FACT_KEY
  const expectedModifier = execution.evidence.facts[modifierFactKey]
  const expectedThreshold = execution.evidence.facts[thresholdFactKey]
  const expectedContributorChecksum =
    execution.evidence.facts[DND5E_ROLL_CONTRIBUTOR_CHECKSUM_FACT_KEY]
  const outcomeRule = execution.evidence.facts[DND5E_TEST_OUTCOME_RULE_FACT_KEY]
  if (!isDnd5eTestOutcomeRule(outcomeRule) || testTrace.inputs.outcomeRule !== outcomeRule)
    throw new Dnd5eEffectActionCompilerError(
      'The committed D&D test outcome rule does not match D&D policy.'
    )
  const expectedPath = dnd5eTestResultPath({
    kind: attack ? 'ATTACK' : 'SAVE',
    naturalD20,
    total: naturalD20 + modifier,
    threshold,
    outcomeRule
  })
  if (
    modifier !== expectedModifier ||
    threshold !== expectedThreshold ||
    testTrace.inputs.contributorChecksum !== expectedContributorChecksum ||
    testTrace.outputs.contributorChecksum !== expectedContributorChecksum ||
    naturalD20 !== d20Trace.outputs.value ||
    naturalD20 !== d20Trace.evidence.value ||
    resultPath !== expectedPath ||
    input.execution.outputs.resultPath !== resultPath
  )
    throw new Dnd5eEffectActionCompilerError(
      'The committed D&D test result does not match D&D policy.'
    )
  if (
    replacementPath !== undefined &&
    (attack || resultPath !== 'ON_SAVE_FAIL' || replacementPath !== 'ON_SAVE_SUCCESS')
  ) {
    throw new Dnd5eEffectActionCompilerError(
      'A D&D save-success replacement requires one completed failed saving throw.'
    )
  }
  const authorizedPaths =
    replacementPath !== undefined
      ? [replacementPath]
      : attack && resultPath === 'ON_CRIT'
        ? ['ON_HIT', 'ON_CRIT']
        : [resultPath]
  const directOperationByTestOperation = new Map<string, string>([
    [DND5E_TEST_HEAL_PROPOSAL_OPERATION_KEY, DND5E_HEAL_PROPOSAL_OPERATION_KEY],
    [
      DND5E_TEST_TEMPORARY_HIT_POINTS_PROPOSAL_OPERATION_KEY,
      DND5E_TEMPORARY_HIT_POINTS_PROPOSAL_OPERATION_KEY
    ],
    [DND5E_TEST_DAMAGE_PROPOSAL_OPERATION_KEY, DND5E_DAMAGE_PROPOSAL_OPERATION_KEY],
    [DND5E_TEST_CONDITION_PROPOSAL_OPERATION_KEY, DND5E_CONDITION_APPLY_PROPOSAL_OPERATION_KEY]
  ])
  const paths = new Set<string>()
  for (const proposal of proposalTraces) {
    const authoredPath = proposal.inputs.authoredPath
    const publishedNode = published.definition.nodes.find((node) => node.id === proposal.nodeId)
    const expectedTarget = publishedNode?.inputs.targetActorId
    const expectedResolvedPath = publishedNode?.inputs.resolvedPath
    const expectedAuthoredPath = publishedNode?.inputs.authoredPath
    const expectedLiteral = (port: string) => {
      const binding = publishedNode?.inputs[port]
      return binding?.kind === 'LITERAL' ? binding.value : undefined
    }
    if (
      !directOperationByTestOperation.has(proposal.operation.key) ||
      !publishedNode ||
      publishedNode.operation.key !== proposal.operation.key ||
      publishedNode.operation.contractVersion !== proposal.operation.contractVersion ||
      typeof authoredPath !== 'string' ||
      proposal.nodeId !== `proposal-${authoredPath.toLowerCase()}` ||
      expectedTarget?.kind !== 'FACT' ||
      expectedTarget.factKey !== DND5E_TARGET_ACTOR_FACT_KEY ||
      proposal.inputs.targetActorId !== input.targetActorId ||
      proposal.outputs.targetActorId !== input.targetActorId ||
      expectedResolvedPath?.kind !== 'NODE_OUTPUT' ||
      expectedResolvedPath.nodeId !== 'test' ||
      expectedResolvedPath.port !== 'resultPath' ||
      proposal.inputs.resolvedPath !== resultPath ||
      proposal.outputs.resolvedPath !== resultPath ||
      expectedAuthoredPath?.kind !== 'LITERAL' ||
      expectedAuthoredPath.value !== authoredPath ||
      proposal.outputs.authoredPath !== authoredPath ||
      proposal.outputs.applicationCandidate !== true ||
      proposal.outputs.authorized !==
        (resultPath === authoredPath || (resultPath === 'ON_CRIT' && authoredPath === 'ON_HIT')) ||
      paths.has(authoredPath)
    )
      throw new Dnd5eEffectActionCompilerError(
        'The committed D&D test proposal topology is invalid.'
      )
    paths.add(authoredPath)
    for (const port of ['amount', 'damageTypeId', 'conditionId']) {
      const expected = expectedLiteral(port)
      if (
        expected !== undefined &&
        (proposal.inputs[port] !== expected || proposal.outputs[port] !== expected)
      )
        throw new Dnd5eEffectActionCompilerError(
          'The committed D&D test proposal payload is invalid.'
        )
    }
  }
  const applications: CharacterRuleActionApplication[] = []
  for (const path of authorizedPaths) {
    const matching = proposalTraces.filter(
      (trace) => trace.nodeId === `proposal-${path.toLowerCase()}`
    )
    if (matching.length > 1)
      throw new Dnd5eEffectActionCompilerError(
        'The committed D&D test has duplicate outcome traces.'
      )
    const proposal = matching[0]
    if (!proposal) continue
    if (
      proposal.outputs.applicationCandidate !== true ||
      (replacementPath === undefined && proposal.outputs.authorized !== true)
    )
      throw new Dnd5eEffectActionCompilerError('The committed D&D test proposal is unauthorized.')
    if (proposal.outputs.targetActorId !== input.targetActorId)
      throw new Dnd5eEffectActionCompilerError('The committed D&D test proposal target is invalid.')
    const directOperation = directOperationByTestOperation.get(proposal.operation.key)
    if (!directOperation)
      throw new Dnd5eEffectActionCompilerError('The committed D&D test proposal is invalid.')
    const replacementProposal =
      replacementPath === undefined
        ? proposal
        : {
            ...proposal,
            inputs: { ...proposal.inputs, resolvedPath: replacementPath },
            outputs: {
              ...proposal.outputs,
              resolvedPath: replacementPath,
              authorized: true
            }
          }
    const {
      resolvedPath: _resolvedPath,
      authoredPath: _authoredPath,
      ...outputs
    } = replacementProposal.outputs
    const direct = interpretDirect(
      {
        ...input,
        execution: {
          ...input.execution,
          outputs,
          evidence: {
            ...input.execution.evidence,
            trace: [
              {
                ...replacementProposal,
                operation: { key: directOperation, contractVersion: 1 },
                outputs
              }
            ]
          }
        }
      },
      {
        nodes: published.definition.nodes,
        source: {
          definitionId: published.id,
          gameSystemId: published.gameSystemId,
          definitionFamilyKey: published.definitionFamilyKey,
          checksum: published.checksum
        }
      }
    )
    const traced = direct.map((application) => ({
      ...application,
      // An attack that hit as a critical hit makes its damage critical (D96).
      ...(application.kind === 'DAMAGE' ? { critical: attack && resultPath === 'ON_CRIT' } : {}),
      sourceNodeId: replacementProposal.nodeId,
      sourceOperationKey: replacementProposal.operation.key,
      authoredPath: replacementProposal.outputs.authoredPath as string,
      resolvedPath: replacementProposal.outputs.resolvedPath as string
    }))
    applications.push(...traced)
    for (const application of traced) {
      if (
        application.kind === 'CONDITION_APPLY' ||
        application.kind === 'CONDITION_REMOVE' ||
        application.kind === 'HIT_POINT_MAXIMUM_REDUCTION' ||
        application.kind === 'SCALAR_REDUCTION' ||
        application.kind === 'STABILIZE'
      )
        continue
      input = {
        ...input,
        currentHitPoints: application.afterCurrentHitPoints,
        temporaryHitPoints: application.afterTemporaryHitPoints
      }
    }
  }
  return applications
}

function repeatedFollowUpSaveResultPath(input: {
  execution: Extract<ServerRuleExecutionResultDto, { status: 'COMPLETE' }>
  occurrenceId: string
  definition: Parameters<
    NonNullable<CharacterRuleActionSystemAdapter['interpretActiveEffect']>
  >[0]['definition']
  graph: CompiledRuleGraph
  targetActorId: string
}): 'ON_SAVE_FAIL' | 'ON_SAVE_SUCCESS' | null {
  const conditionId =
    input.definition.adapterFacts[DND5E_ACTIVE_EFFECT_REPEAT_SAVE_CONDITION_FACT_KEY]
  if (typeof conditionId !== 'string') return null
  if (!UUID.test(conditionId)) {
    throw new Dnd5eEffectActionCompilerError('D&D repeated save condition identity is invalid.')
  }
  const [d20Trace, saveTrace] = input.execution.evidence.trace
  const d20NodeId = input.definition.adapterFacts[DND5E_ACTIVE_EFFECT_SAVE_REQUEST_NODE_FACT_KEY]
  const naturalD20 = d20Trace?.evidence?.kind === 'INTEGER_RANGE' ? d20Trace.evidence.value : null
  const modifier = saveTrace?.inputs.modifier
  const threshold = saveTrace?.inputs.threshold
  if (
    d20NodeId !== 'repeat-save-d20' ||
    input.graph.nodes.length !== 2 ||
    input.graph.nodes[0]?.id !== d20NodeId ||
    input.graph.nodes[0]?.operation.key !== 'evidence.integer-range' ||
    input.graph.nodes[1]?.id !== input.definition.frozenGraphNodeId ||
    input.graph.nodes[1]?.operation.key !== DND5E_SAVE_TEST_OPERATION_KEY ||
    input.execution.evidence.trace.length !== 2 ||
    d20Trace?.nodeId !== d20NodeId ||
    d20Trace.operation.key !== 'evidence.integer-range' ||
    d20Trace.inputs.min !== 1 ||
    d20Trace.inputs.max !== 20 ||
    d20Trace.evidence?.kind !== 'INTEGER_RANGE' ||
    d20Trace.evidence.requestId !== `${input.occurrenceId}:0:${d20NodeId}` ||
    saveTrace?.nodeId !== input.definition.frozenGraphNodeId ||
    saveTrace.operation.key !== DND5E_SAVE_TEST_OPERATION_KEY ||
    saveTrace.inputs.targetActorId !== input.targetActorId ||
    saveTrace.outputs.targetActorId !== input.targetActorId ||
    !Number.isSafeInteger(naturalD20) ||
    saveTrace.inputs.naturalD20 !== naturalD20 ||
    saveTrace.outputs.naturalD20 !== naturalD20 ||
    typeof modifier !== 'number' ||
    !Number.isSafeInteger(modifier) ||
    typeof threshold !== 'number' ||
    !Number.isSafeInteger(threshold) ||
    modifier !== input.execution.evidence.facts[DND5E_SAVE_MODIFIER_FACT_KEY] ||
    threshold !== input.definition.adapterFacts[DND5E_SAVE_DC_FACT_KEY] ||
    saveTrace.inputs.contributorChecksum !==
      input.execution.evidence.facts[DND5E_ROLL_CONTRIBUTOR_CHECKSUM_FACT_KEY] ||
    saveTrace.outputs.contributorChecksum !== saveTrace.inputs.contributorChecksum ||
    saveTrace.outputs.total !== naturalD20 + modifier ||
    (saveTrace.outputs.resultPath !== 'ON_SAVE_FAIL' &&
      saveTrace.outputs.resultPath !== 'ON_SAVE_SUCCESS') ||
    input.execution.outputs.resultPath !== saveTrace.outputs.resultPath ||
    input.execution.outputs.total !== saveTrace.outputs.total
  ) {
    throw new Dnd5eEffectActionCompilerError('The committed D&D repeat-save graph is invalid.')
  }
  const outcomeRule = input.execution.evidence.facts[DND5E_TEST_OUTCOME_RULE_FACT_KEY]
  if (!isDnd5eTestOutcomeRule(outcomeRule) || saveTrace.inputs.outcomeRule !== outcomeRule) {
    throw new Dnd5eEffectActionCompilerError(
      'The committed D&D repeat-save outcome rule is invalid.'
    )
  }
  const expected = dnd5eTestResultPath({
    kind: 'SAVE',
    naturalD20,
    total: naturalD20 + modifier,
    threshold,
    outcomeRule
  })
  if (saveTrace.outputs.resultPath !== expected) {
    throw new Dnd5eEffectActionCompilerError('The committed D&D repeat-save result is invalid.')
  }
  return expected
}

type DirectInterpretationInput = Pick<
  Parameters<CharacterRuleActionSystemAdapter['interpret']>[0],
  | 'execution'
  | 'targetActorId'
  | 'currentHitPoints'
  | 'temporaryHitPoints'
  | 'maximumHitPoints'
  | 'defenses'
  | 'conditionImmunityIds'
>

function conditionImmunityFacts(
  graph: Pick<CompiledRuleGraph, 'nodes'>,
  conditionImmunityIds: readonly string[] | undefined
): Record<string, boolean> {
  const facts: Record<string, boolean> = {}
  const identitiesByFactKey = new Map<string, string>()
  const conditionNodes = graph.nodes.filter(
    (node) =>
      node.operation.key === DND5E_CONDITION_APPLY_PROPOSAL_OPERATION_KEY ||
      node.operation.key === DND5E_TEST_CONDITION_PROPOSAL_OPERATION_KEY
  )
  const legacySingleCondition =
    conditionNodes.length === 1 &&
    conditionNodes[0]?.inputs.authoredPath === undefined &&
    conditionNodes[0]?.inputs.conditionImmune?.kind === 'FACT' &&
    conditionNodes[0].inputs.conditionImmune.factKey === DND5E_TARGET_CONDITION_IMMUNE_FACT_KEY
  let conditionCount = 0
  for (const node of graph.nodes) {
    if (
      node.operation.key !== DND5E_CONDITION_APPLY_PROPOSAL_OPERATION_KEY &&
      node.operation.key !== DND5E_TEST_CONDITION_PROPOSAL_OPERATION_KEY
    )
      continue
    conditionCount += 1
    const conditionId = node.inputs.conditionId
    if (
      !conditionId ||
      conditionId.kind !== 'LITERAL' ||
      typeof conditionId.value !== 'string' ||
      !UUID.test(conditionId.value)
    )
      throw new Dnd5eEffectActionCompilerError(
        'The D&D condition action does not bind one exact condition identity.'
      )
    const binding = node.inputs.conditionImmune
    const path = node.inputs.authoredPath
    const pathCode =
      path?.kind === 'LITERAL' && typeof path.value === 'string'
        ? path.value
        : proposalNodePathCode(node.id)
    if (
      !binding ||
      binding.kind !== 'FACT' ||
      (legacySingleCondition
        ? binding.factKey !== DND5E_TARGET_CONDITION_IMMUNE_FACT_KEY
        : !pathCode || !isPathConditionImmuneFactKey(binding.factKey, pathCode))
    )
      throw new Dnd5eEffectActionCompilerError(
        'The D&D condition action immunity binding is invalid.'
      )
    const factKey = binding.factKey
    const previous = identitiesByFactKey.get(factKey)
    if (previous !== undefined && previous !== conditionId.value)
      throw new Dnd5eEffectActionCompilerError(
        'The D&D condition action reuses one immunity fact for different conditions.'
      )
    identitiesByFactKey.set(factKey, conditionId.value)
    facts[factKey] = (conditionImmunityIds ?? []).includes(conditionId.value)
  }
  if (conditionCount === 1 && legacySingleCondition) {
    const conditionId = [...identitiesByFactKey.values()][0]
    if (conditionId !== undefined)
      facts[DND5E_TARGET_CONDITION_IMMUNE_FACT_KEY] = (conditionImmunityIds ?? []).includes(
        conditionId
      )
  }
  return facts
}

function interpretDirectProposal(
  input: DirectInterpretationInput,
  graph: Pick<CompiledRuleGraph, 'nodes' | 'source'>
): readonly CharacterRuleActionApplication[] {
  const { outputs, evidence } = input.execution
  const trace = evidence.trace[0]
  if (outputs.targetActorId !== input.targetActorId || !trace || evidence.trace.length !== 1)
    throw new Dnd5eEffectActionCompilerError(
      'The committed D&D rule action did not produce one exact hit-point proposal.'
    )
  const publishedNode = graph.nodes.find((node) => node.id === trace.nodeId)
  const expectedOperation =
    publishedNode?.operation.key === DND5E_TEST_CONDITION_PROPOSAL_OPERATION_KEY
      ? DND5E_CONDITION_APPLY_PROPOSAL_OPERATION_KEY
      : publishedNode?.operation.key.startsWith('dnd5e.test-')
        ? publishedNode.operation.key.replace('dnd5e.test-', 'dnd5e.')
        : publishedNode?.operation.key
  if (
    !publishedNode ||
    trace.nodeId !== publishedNode.id ||
    trace.operation.key !== expectedOperation ||
    trace.operation.contractVersion !== publishedNode.operation.contractVersion ||
    evidence.source.definitionId !== graph.source.definitionId ||
    evidence.source.gameSystemId !== graph.source.gameSystemId ||
    evidence.source.definitionFamilyKey !== graph.source.definitionFamilyKey ||
    evidence.source.checksum !== graph.source.checksum
  )
    throw new Dnd5eEffectActionCompilerError('The committed D&D rule action source is invalid.')
  if (
    trace.outputs.applicationCandidate !== true ||
    trace.outputs.targetStateChecksum !==
      input.execution.evidence.facts[DND5E_TARGET_STATE_CHECKSUM_FACT_KEY]
  )
    throw new Dnd5eEffectActionCompilerError('The committed D&D rule action proposal is invalid.')
  // A grant changes no stored target state; its active effect owns the modifiers.
  if (
    trace.operation.key === DND5E_MODIFIER_GRANT_PROPOSAL_OPERATION_KEY ||
    trace.operation.key === DND5E_MANUAL_ADJUDICATION_PROPOSAL_OPERATION_KEY ||
    trace.operation.key === DND5E_CONCEAL_PROPOSAL_OPERATION_KEY ||
    trace.operation.key === DND5E_DETECT_CONCEALED_PROPOSAL_OPERATION_KEY ||
    trace.operation.key === DND5E_ADD_SPEED_TO_MOVEMENT_PROPOSAL_OPERATION_KEY
  )
    return []
  if (trace.operation.key === DND5E_CONDITION_APPLY_PROPOSAL_OPERATION_KEY) {
    const conditionIdBinding = publishedNode.inputs.conditionId
    const authoredPathBinding = publishedNode.inputs.authoredPath
    const graphConditionNodes = graph.nodes.filter(
      (node) =>
        node.operation.key === DND5E_CONDITION_APPLY_PROPOSAL_OPERATION_KEY ||
        node.operation.key === DND5E_TEST_CONDITION_PROPOSAL_OPERATION_KEY
    )
    const legacySingleCondition =
      graphConditionNodes.length === 1 &&
      authoredPathBinding === undefined &&
      publishedNode.inputs.conditionImmune?.kind === 'FACT' &&
      publishedNode.inputs.conditionImmune.factKey === DND5E_TARGET_CONDITION_IMMUNE_FACT_KEY
    const authoredPath =
      authoredPathBinding?.kind === 'LITERAL' && typeof authoredPathBinding.value === 'string'
        ? authoredPathBinding.value
        : proposalNodePathCode(publishedNode.id)
    const conditionBinding = publishedNode.inputs.conditionImmune
    const conditionFactKey = legacySingleCondition
      ? DND5E_TARGET_CONDITION_IMMUNE_FACT_KEY
      : authoredPath &&
          conditionBinding?.kind === 'FACT' &&
          isPathConditionImmuneFactKey(conditionBinding.factKey, authoredPath)
        ? conditionBinding.factKey
        : undefined
    const conditionFacts = conditionImmunityFacts(graph, input.conditionImmunityIds)
    if (
      typeof outputs.conditionId !== 'string' ||
      !UUID.test(outputs.conditionId) ||
      trace.outputs.targetActorId !== input.targetActorId ||
      trace.outputs.conditionId !== outputs.conditionId ||
      conditionIdBinding?.kind !== 'LITERAL' ||
      conditionIdBinding.value !== outputs.conditionId ||
      !conditionFactKey ||
      typeof conditionFacts[conditionFactKey] !== 'boolean'
    )
      throw new Dnd5eEffectActionCompilerError(
        'The committed D&D condition proposal trace is invalid.'
      )
    if (trace.outputs.authorized !== !conditionFacts[conditionFactKey]) {
      throw new Dnd5eEffectActionCompilerError(
        'The committed D&D condition proposal protection evidence is invalid.'
      )
    }
    if (trace.outputs.authorized === false) return []
    return [
      {
        kind: 'CONDITION_APPLY',
        conditionId: outputs.conditionId,
        targetActorId: input.targetActorId,
        sourceNodeId: trace.nodeId,
        sourceOperationKey: trace.operation.key,
        authoredPath: null,
        resolvedPath: null
      }
    ]
  }
  if (trace.outputs.authorized !== true)
    throw new Dnd5eEffectActionCompilerError('The committed D&D rule action proposal is invalid.')
  if (trace.operation.key === DND5E_STABILIZE_PROPOSAL_OPERATION_KEY) {
    if (trace.outputs.targetActorId !== input.targetActorId)
      throw new Dnd5eEffectActionCompilerError(
        'The committed D&D stabilize proposal trace is invalid.'
      )
    return [
      {
        kind: 'STABILIZE',
        targetActorId: input.targetActorId,
        sourceNodeId: trace.nodeId,
        sourceOperationKey: trace.operation.key,
        authoredPath: null,
        resolvedPath: null
      }
    ]
  }
  if (!positive(outputs.amount) || !hitPointStateIsValid(input))
    throw new Dnd5eEffectActionCompilerError(
      'The committed D&D rule action did not produce one exact hit-point proposal.'
    )
  if (
    trace.outputs.targetActorId !== input.targetActorId ||
    trace.outputs.amount !== outputs.amount ||
    trace.operation.contractVersion !== 1
  )
    throw new Dnd5eEffectActionCompilerError(
      'The committed D&D rule action proposal trace is invalid.'
    )
  const requestedAmount = outputs.amount
  if (trace.operation.key === DND5E_SCALAR_REDUCTION_PROPOSAL_OPERATION_KEY) {
    const valueDefinitionId = outputs.valueDefinitionId
    const recoveryTriggers = outputs.recoveryTriggers
    const terminalConsequence = outputs.terminalConsequence
    if (
      typeof valueDefinitionId !== 'string' ||
      !UUID.test(valueDefinitionId) ||
      typeof recoveryTriggers !== 'string' ||
      typeof terminalConsequence !== 'string' ||
      terminalConsequence !== 'TARGET_DIED'
    )
      throw new Dnd5eEffectActionCompilerError(
        'The committed D&D scalar reduction proposal is invalid.'
      )
    let parsedTriggers: unknown
    try {
      parsedTriggers = JSON.parse(recoveryTriggers)
    } catch {
      throw new Dnd5eEffectActionCompilerError(
        'The committed D&D scalar reduction recovery is invalid.'
      )
    }
    if (
      !Array.isArray(parsedTriggers) ||
      parsedTriggers.length < 1 ||
      parsedTriggers.length > 2 ||
      new Set(parsedTriggers).size !== parsedTriggers.length ||
      parsedTriggers.some((trigger) => trigger !== 'SHORT_REST' && trigger !== 'LONG_REST')
    )
      throw new Dnd5eEffectActionCompilerError(
        'The committed D&D scalar reduction recovery is invalid.'
      )
    return [
      {
        kind: 'SCALAR_REDUCTION',
        targetActorId: input.targetActorId,
        sourceNodeId: trace.nodeId,
        sourceOperationKey: trace.operation.key,
        authoredPath: null,
        resolvedPath: null,
        valueDefinitionId,
        reductionAmount: requestedAmount,
        stacking: 'ADDITIVE',
        floor: 0,
        recoveryTriggers: parsedTriggers,
        terminalConsequence: 'TARGET_DIED',
        sourceOutcomeId: input.execution.evidence.source.definitionId
      }
    ]
  }
  if (trace.operation.key === DND5E_HEAL_PROPOSAL_OPERATION_KEY) {
    const appliedAmount = Math.min(requestedAmount, input.maximumHitPoints - input.currentHitPoints)
    const afterCurrentHitPoints = input.currentHitPoints + appliedAmount
    return [
      {
        kind: 'HEAL',
        requestedAmount,
        resolvedAmount: requestedAmount,
        appliedAmount,
        beforeCurrentHitPoints: input.currentHitPoints,
        afterCurrentHitPoints,
        beforeTemporaryHitPoints: input.temporaryHitPoints,
        afterTemporaryHitPoints: input.temporaryHitPoints,
        maximumHitPoints: input.maximumHitPoints,
        targetActorId: input.targetActorId,
        sourceNodeId: trace.nodeId,
        sourceOperationKey: trace.operation.key,
        authoredPath: null,
        resolvedPath: null
      }
    ]
  }
  if (trace.operation.key === DND5E_TEMPORARY_HIT_POINTS_PROPOSAL_OPERATION_KEY) {
    const afterTemporaryHitPoints = Math.max(input.temporaryHitPoints, requestedAmount)
    return [
      {
        kind: 'TEMPORARY_HIT_POINTS',
        requestedAmount,
        resolvedAmount: requestedAmount,
        appliedAmount: afterTemporaryHitPoints - input.temporaryHitPoints,
        beforeCurrentHitPoints: input.currentHitPoints,
        afterCurrentHitPoints: input.currentHitPoints,
        beforeTemporaryHitPoints: input.temporaryHitPoints,
        afterTemporaryHitPoints,
        maximumHitPoints: input.maximumHitPoints,
        targetActorId: input.targetActorId,
        sourceNodeId: trace.nodeId,
        sourceOperationKey: trace.operation.key,
        authoredPath: null,
        resolvedPath: null
      }
    ]
  }
  if (
    trace.operation.key !== DND5E_DAMAGE_PROPOSAL_OPERATION_KEY ||
    typeof outputs.damageTypeId !== 'string' ||
    outputs.damageTypeId !== trace.outputs.damageTypeId
  )
    throw new Dnd5eEffectActionCompilerError('The committed D&D damage proposal trace is invalid.')
  uuid(outputs.damageTypeId, 'D&D damage type identity')
  const d = input.defenses.filter((x) => x.damageTypeId === outputs.damageTypeId)
  const immune = d.some((x) => x.kind === 'IMMUNITY')
  const resistant = d.some((x) => x.kind === 'RESISTANCE')
  const vulnerable = d.some((x) => x.kind === 'VULNERABILITY')
  const damageDisposition = immune
    ? 'IMMUNE'
    : resistant && vulnerable
      ? 'RESISTANT_AND_VULNERABLE'
      : resistant
        ? 'RESISTANT'
        : vulnerable
          ? 'VULNERABLE'
          : 'NORMAL'
  const resolvedAmount = resolveDispositionDamage(damageDisposition, requestedAmount)
  if (!Number.isSafeInteger(resolvedAmount))
    throw new Dnd5eEffectActionCompilerError(
      'D&D vulnerable damage exceeds the supported safe integer range.'
    )
  const temporaryLost = Math.min(input.temporaryHitPoints, resolvedAmount)
  const currentLost = Math.min(input.currentHitPoints, resolvedAmount - temporaryLost)
  return [
    {
      kind: 'DAMAGE',
      requestedAmount,
      resolvedAmount,
      appliedAmount: temporaryLost + currentLost,
      beforeCurrentHitPoints: input.currentHitPoints,
      afterCurrentHitPoints: input.currentHitPoints - currentLost,
      beforeTemporaryHitPoints: input.temporaryHitPoints,
      afterTemporaryHitPoints: input.temporaryHitPoints - temporaryLost,
      maximumHitPoints: input.maximumHitPoints,
      targetActorId: input.targetActorId,
      damageTypeId: outputs.damageTypeId,
      damageDisposition,
      critical: false,
      sourceNodeId: trace.nodeId,
      sourceOperationKey: trace.operation.key,
      authoredPath: null,
      resolvedPath: null
    }
  ]
}

function interpretDirect(
  input: DirectInterpretationInput,
  graph: Pick<CompiledRuleGraph, 'nodes' | 'source'>,
  options: { fullTrace?: boolean } = {}
): readonly CharacterRuleActionApplication[] {
  if (!options.fullTrace) return interpretDirectProposal(input, graph)
  const proposalKeys = new Set([
    DND5E_HEAL_PROPOSAL_OPERATION_KEY,
    DND5E_TEMPORARY_HIT_POINTS_PROPOSAL_OPERATION_KEY,
    DND5E_STABILIZE_PROPOSAL_OPERATION_KEY,
    DND5E_MODIFIER_GRANT_PROPOSAL_OPERATION_KEY,
    DND5E_MANUAL_ADJUDICATION_PROPOSAL_OPERATION_KEY,
    DND5E_CONCEAL_PROPOSAL_OPERATION_KEY,
    DND5E_DETECT_CONCEALED_PROPOSAL_OPERATION_KEY,
    DND5E_ADD_SPEED_TO_MOVEMENT_PROPOSAL_OPERATION_KEY,
    DND5E_DAMAGE_PROPOSAL_OPERATION_KEY,
    DND5E_SCALAR_REDUCTION_PROPOSAL_OPERATION_KEY,
    DND5E_CONDITION_APPLY_PROPOSAL_OPERATION_KEY,
    DND5E_TEST_CONDITION_PROPOSAL_OPERATION_KEY,
    DND5E_TEST_DAMAGE_PROPOSAL_OPERATION_KEY
  ])
  if (input.execution.evidence.trace.length !== graph.nodes.length)
    throw new Dnd5eEffectActionCompilerError(
      'The committed D&D rule action graph trace is incomplete.'
    )
  for (const [index, entry] of input.execution.evidence.trace.entries()) {
    const expected = graph.nodes[index]
    if (
      !expected ||
      entry.nodeId !== expected.id ||
      entry.operation.key !== expected.operation.key ||
      entry.operation.contractVersion !== expected.operation.contractVersion
    )
      throw new Dnd5eEffectActionCompilerError(
        'The committed D&D rule action graph topology is invalid.'
      )
  }
  const proposals = input.execution.evidence.trace.filter((entry) =>
    proposalKeys.has(entry.operation.key)
  )
  if (proposals.length === 0)
    throw new Dnd5eEffectActionCompilerError(
      'The committed D&D rule action must contain an application proposal.'
    )
  const applications: CharacterRuleActionApplication[] = []
  for (const originalProposal of proposals) {
    let proposal = originalProposal
    let nestedPaths: { authoredPath: string; resolvedPath: string } | null = null
    const proposalNode = graph.nodes.find((node) => node.id === proposal.nodeId)
    const nestedCondition = proposal.operation.key === DND5E_TEST_CONDITION_PROPOSAL_OPERATION_KEY
    if (nestedCondition || proposal.operation.key === DND5E_TEST_DAMAGE_PROPOSAL_OPERATION_KEY) {
      const saveNode = graph.nodes.find((node) => node.id === 'nested-save-test')
      const save = input.execution.evidence.trace.find((entry) => entry.nodeId === saveNode?.id)
      const die = input.execution.evidence.trace.find((entry) => entry.nodeId === 'nested-save-d20')
      const path = proposalNode?.inputs.resolvedPath
      const protection = proposalNode?.inputs.conditionImmune
      const conditionFacts = conditionImmunityFacts(graph, input.conditionImmunityIds)
      if (
        !proposalNode ||
        proposalNode.id !== (nestedCondition ? 'nested-save-condition' : 'nested-save-proposal') ||
        !saveNode ||
        saveNode.operation.key !== DND5E_SAVE_TEST_OPERATION_KEY ||
        !save ||
        die?.operation.key !== 'evidence.integer-range' ||
        die.evidence?.kind !== 'INTEGER_RANGE' ||
        die.inputs.min !== 1 ||
        die.inputs.max !== 20 ||
        die.outputs.value !== die.evidence.value ||
        path?.kind !== 'NODE_OUTPUT' ||
        path.nodeId !== saveNode.id ||
        path.port !== 'resultPath' ||
        (nestedCondition &&
          (protection?.kind !== 'FACT' ||
            input.execution.evidence.facts[protection.factKey] !==
              conditionFacts[protection.factKey])) ||
        input.execution.evidence.source.definitionId !== graph.source.definitionId ||
        input.execution.evidence.source.gameSystemId !== graph.source.gameSystemId ||
        input.execution.evidence.source.definitionFamilyKey !== graph.source.definitionFamilyKey ||
        input.execution.evidence.source.checksum !== graph.source.checksum
      )
        throw new Dnd5eEffectActionCompilerError(
          'The committed D&D nested condition binding is invalid.'
        )
      for (const [node, trace, operation] of [
        [saveNode, save, dnd5eSaveTestOperation],
        [
          proposalNode,
          proposal,
          nestedCondition ? dnd5eTestConditionProposalOperation : dnd5eTestDamageProposalOperation
        ]
      ] as const) {
        const expectedInputs: Record<string, RuleValue> = {}
        for (const [port, binding] of Object.entries(node.inputs)) {
          const value =
            binding.kind === 'LITERAL'
              ? binding.value
              : binding.kind === 'FACT'
                ? input.execution.evidence.facts[binding.factKey]
                : input.execution.evidence.trace.find((entry) => entry.nodeId === binding.nodeId)
                    ?.outputs[binding.port]
          if (value === undefined)
            throw new Dnd5eEffectActionCompilerError(
              'The committed D&D nested condition input is unavailable.'
            )
          expectedInputs[port] = value
        }
        if (
          checksumRuleDocument(trace.inputs) !== checksumRuleDocument(expectedInputs) ||
          checksumRuleDocument(trace.outputs) !==
            checksumRuleDocument(operation.execute(expectedInputs))
        )
          throw new Dnd5eEffectActionCompilerError(
            'The committed D&D nested condition evidence is invalid.'
          )
      }
      if (
        proposal.outputs.targetActorId !== input.targetActorId ||
        proposal.outputs.targetStateChecksum !==
          input.execution.evidence.facts[DND5E_TARGET_STATE_CHECKSUM_FACT_KEY] ||
        typeof proposal.outputs.authoredPath !== 'string' ||
        typeof proposal.outputs.resolvedPath !== 'string'
      )
        throw new Dnd5eEffectActionCompilerError(
          'The committed D&D nested condition target is invalid.'
        )
      if (!proposal.outputs.authorized) continue
      if (nestedCondition) {
        if (typeof proposal.outputs.conditionId !== 'string')
          throw new Dnd5eEffectActionCompilerError(
            'The committed D&D nested condition identity is invalid.'
          )
        applications.push({
          kind: 'CONDITION_APPLY',
          conditionId: proposal.outputs.conditionId,
          targetActorId: input.targetActorId,
          sourceNodeId: proposal.nodeId,
          sourceOperationKey: proposal.operation.key,
          authoredPath: proposal.outputs.authoredPath,
          resolvedPath: proposal.outputs.resolvedPath
        })
        continue
      }
      nestedPaths = {
        authoredPath: proposal.outputs.authoredPath,
        resolvedPath: proposal.outputs.resolvedPath
      }
      proposal = {
        ...proposal,
        operation: { key: DND5E_DAMAGE_PROPOSAL_OPERATION_KEY, contractVersion: 1 }
      }
    }
    const amountBinding = proposalNode?.inputs.amount
    const resolvedAmount =
      amountBinding?.kind === 'NODE_OUTPUT'
        ? input.execution.evidence.trace.find((entry) => entry.nodeId === amountBinding.nodeId)
            ?.outputs[amountBinding.port]
        : undefined
    const direct = interpretDirectProposal(
      {
        ...input,
        execution: {
          ...input.execution,
          outputs: {
            ...proposal.outputs,
            ...(resolvedAmount !== undefined ? { amount: resolvedAmount } : {})
          },
          evidence: {
            ...input.execution.evidence,
            trace: [
              resolvedAmount === undefined
                ? proposal
                : {
                    ...proposal,
                    outputs: { ...proposal.outputs, amount: resolvedAmount }
                  }
            ]
          }
        }
      },
      graph
    )
    applications.push(
      ...direct.map((application) =>
        nestedPaths
          ? { ...application, ...nestedPaths, sourceOperationKey: originalProposal.operation.key }
          : application
      )
    )
    for (const application of direct) {
      if (
        application.kind === 'CONDITION_APPLY' ||
        application.kind === 'CONDITION_REMOVE' ||
        application.kind === 'HIT_POINT_MAXIMUM_REDUCTION' ||
        application.kind === 'SCALAR_REDUCTION' ||
        application.kind === 'STABILIZE'
      )
        continue
      input = {
        ...input,
        currentHitPoints: application.afterCurrentHitPoints,
        temporaryHitPoints: application.afterTemporaryHitPoints
      }
    }
  }
  const reductions = input.execution.evidence.trace.filter(
    (entry) => entry.operation.key === DND5E_HIT_POINT_MAXIMUM_REDUCTION_PROPOSAL_OPERATION_KEY
  )
  if (reductions.length > 1)
    throw new Dnd5eEffectActionCompilerError(
      'The committed D&D rule action has duplicate hit point maximum reductions.'
    )
  const reduction = reductions[0]
  if (reduction) {
    const publishedNode = graph.nodes.find((node) => node.id === reduction.nodeId)
    const sourceDamageNodeId = reduction.outputs.sourceDamageNodeId
    const sourceDamageOperationKey = reduction.outputs.sourceDamageOperationKey
    const sourceDamageOutcomeId = reduction.outputs.sourceDamageOutcomeId
    const recoveryTags = reduction.outputs.recoveryTags
    const parsedRecoveryTags = parseRecoveryTags(recoveryTags)
    const resultPath = reduction.outputs.resultPath
    if (
      !publishedNode ||
      publishedNode.operation.key !== DND5E_HIT_POINT_MAXIMUM_REDUCTION_PROPOSAL_OPERATION_KEY ||
      publishedNode.operation.contractVersion !== 1 ||
      reduction.operation.contractVersion !== 1 ||
      reduction.outputs.applicationCandidate !== true ||
      reduction.outputs.targetActorId !== input.targetActorId ||
      reduction.inputs.targetActorId !== input.targetActorId ||
      reduction.outputs.targetStateChecksum !==
        input.execution.evidence.facts[DND5E_TARGET_STATE_CHECKSUM_FACT_KEY] ||
      reduction.inputs.targetStateChecksum !== reduction.outputs.targetStateChecksum ||
      typeof sourceDamageNodeId !== 'string' ||
      typeof sourceDamageOperationKey !== 'string' ||
      typeof sourceDamageOutcomeId !== 'string' ||
      !UUID.test(sourceDamageOutcomeId) ||
      !parsedRecoveryTags ||
      typeof resultPath !== 'string' ||
      reduction.inputs.resultPath !== resultPath ||
      reduction.inputs.sourceDamageNodeId !== sourceDamageNodeId ||
      reduction.inputs.sourceDamageOperationKey !== sourceDamageOperationKey ||
      reduction.inputs.sourceDamageOutcomeId !== sourceDamageOutcomeId ||
      reduction.inputs.recoveryTags !== recoveryTags ||
      publishedNode.inputs.sourceDamageNodeId?.kind !== 'LITERAL' ||
      publishedNode.inputs.sourceDamageNodeId.value !== sourceDamageNodeId ||
      publishedNode.inputs.sourceDamageOperationKey?.kind !== 'LITERAL' ||
      publishedNode.inputs.sourceDamageOperationKey.value !== sourceDamageOperationKey ||
      publishedNode.inputs.sourceDamageOutcomeId?.kind !== 'LITERAL' ||
      publishedNode.inputs.sourceDamageOutcomeId.value !== sourceDamageOutcomeId ||
      publishedNode.inputs.recoveryTags?.kind !== 'LITERAL' ||
      publishedNode.inputs.recoveryTags.value !== recoveryTags ||
      publishedNode.inputs.resultPath?.kind !== 'NODE_OUTPUT' ||
      publishedNode.inputs.resultPath.nodeId !== 'nested-save-test' ||
      publishedNode.inputs.resultPath.port !== 'resultPath' ||
      reduction.outputs.authorized !== (resultPath === 'ON_SAVE_FAIL')
    ) {
      throw new Dnd5eEffectActionCompilerError(
        'The committed D&D hit point maximum reduction trace is invalid.'
      )
    }
    if (reduction.outputs.authorized === true) {
      const sourceDamage = applications.filter(
        (application): application is Extract<CharacterRuleActionApplication, { kind: 'DAMAGE' }> =>
          application.kind === 'DAMAGE' &&
          application.sourceNodeId === sourceDamageNodeId &&
          application.sourceOperationKey === sourceDamageOperationKey
      )
      if (sourceDamage.length !== 1)
        throw new Dnd5eEffectActionCompilerError(
          'The committed D&D hit point maximum reduction source damage is invalid.'
        )
      const damage = sourceDamage[0]!
      if (damage.resolvedAmount > 0) {
        applications.push({
          kind: 'HIT_POINT_MAXIMUM_REDUCTION',
          targetActorId: input.targetActorId,
          sourceNodeId: reduction.nodeId,
          sourceOperationKey: reduction.operation.key,
          authoredPath: damage.authoredPath,
          resolvedPath: resultPath,
          sourceDamageNodeId,
          sourceDamageOperationKey,
          sourceDamageOutcomeId,
          reductionAmount: damage.resolvedAmount,
          recoveryTags: parsedRecoveryTags
        })
      }
    }
  }
  return applications
}

function interpret(
  input: Parameters<CharacterRuleActionSystemAdapter['interpret']>[0]
): readonly CharacterRuleActionApplication[] {
  const resolvedTest = testApplications(input)
  if (resolvedTest) return resolvedTest
  const result = interpretDirect(
    input,
    {
      nodes: input.published.definition.nodes,
      source: {
        definitionId: input.published.id,
        gameSystemId: input.published.gameSystemId,
        definitionFamilyKey: input.published.definitionFamilyKey,
        checksum: input.published.checksum
      }
    },
    { fullTrace: true }
  )
  return result
}

function interpretSpatial(
  input: Parameters<NonNullable<CharacterRuleActionSystemAdapter['interpretSpatial']>>[0]
): readonly CharacterRuleActionSpatialDirective[] {
  const traces = input.execution.evidence.trace.filter(
    (entry) => entry.operation.key === DND5E_FORCED_MOVEMENT_PROPOSAL_OPERATION_KEY
  )
  if (traces.length > 1)
    throw new Dnd5eEffectActionCompilerError(
      'The committed D&D rule action has duplicate movement proposals.'
    )
  const trace = traces[0]
  if (!trace) return []
  const node = input.published.definition.nodes.find((candidate) => candidate.id === trace.nodeId)
  const value = (key: string) => trace.outputs[key]
  const sourceEntryId = value('sourceEntryId')
  const bindings = input.published.definition.sourceEntryBindings?.filter(
    (binding) => binding.nodeId === trace.nodeId
  )
  if (
    !node ||
    node.id !== 'nested-save-forced-movement' ||
    node.operation.key !== DND5E_FORCED_MOVEMENT_PROPOSAL_OPERATION_KEY ||
    node.operation.contractVersion !== 1 ||
    trace.operation.contractVersion !== 1 ||
    value('targetActorId') !== input.targetActorId ||
    typeof sourceEntryId !== 'string' ||
    !UUID.test(sourceEntryId) ||
    bindings?.length !== 1 ||
    bindings[0]?.sourceEntryId !== sourceEntryId ||
    (value('resultPath') !== 'ON_SAVE_FAIL' && value('resultPath') !== 'ON_SAVE_SUCCESS') ||
    value('authoredPath') !== 'ON_HIT' ||
    value('direction') !== 'TOWARD_SOURCE' ||
    value('distanceMode') !== 'FIXED_DISTANCE' ||
    value('amount') !== 25 ||
    value('unit') !== 'FEET' ||
    value('actionEconomy') !== 'NONE' ||
    value('targetStateChecksum') !==
      input.execution.evidence.facts[DND5E_TARGET_STATE_CHECKSUM_FACT_KEY] ||
    trace.inputs.targetActorId !== input.targetActorId ||
    trace.inputs.sourceEntryId !== sourceEntryId ||
    trace.inputs.resultPath !== value('resultPath') ||
    trace.inputs.authoredPath !== 'ON_HIT' ||
    trace.inputs.direction !== 'TOWARD_SOURCE' ||
    trace.inputs.distanceMode !== 'FIXED_DISTANCE' ||
    trace.inputs.amount !== 25 ||
    trace.inputs.unit !== 'FEET' ||
    trace.inputs.actionEconomy !== 'NONE' ||
    trace.inputs.targetStateChecksum !== value('targetStateChecksum') ||
    node.inputs.resultPath?.kind !== 'NODE_OUTPUT' ||
    node.inputs.resultPath.nodeId !== 'nested-save-test' ||
    node.inputs.resultPath.port !== 'resultPath' ||
    node.inputs.authoredPath?.kind !== 'LITERAL' ||
    node.inputs.authoredPath.value !== 'ON_HIT' ||
    node.inputs.sourceEntryId?.kind !== 'LITERAL' ||
    node.inputs.sourceEntryId.value !== sourceEntryId ||
    value('authorized') !== (value('resultPath') === 'ON_SAVE_FAIL')
  ) {
    throw new Dnd5eEffectActionCompilerError(
      'The committed D&D forced movement proposal is invalid.'
    )
  }
  if (value('authorized') !== true) return []
  return [
    {
      kind: 'FORCED_MOVEMENT',
      targetActorId: input.targetActorId,
      sourceNodeId: trace.nodeId,
      sourceOperationKey: trace.operation.key,
      authoredPath: 'ON_HIT',
      resolvedPath: 'ON_SAVE_FAIL',
      direction: 'TOWARD_SOURCE',
      distanceMode: 'FIXED_DISTANCE',
      amount: 25,
      unit: 'FEET',
      actionEconomy: 'NONE',
      targetStateChecksum: String(value('targetStateChecksum'))
    }
  ]
}

type Dnd5eSaveContributor = {
  sourceId: string
  grantId: string
  domainKey: string
  influence: 'ADVANTAGE' | 'DISADVANTAGE'
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
  contributors: Dnd5eSaveContributor[]
} {
  type SaveDefinition = {
    conditionTypeId: unknown
    modifier: number
    rollMode: 'NORMAL' | 'ADVANTAGE' | 'DISADVANTAGE'
    contributors: Dnd5eSaveContributor[]
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
        ({ sourceId, grantId, domainKey, influence }: Dnd5eSaveContributor) => ({
          sourceId,
          grantId,
          domainKey,
          influence
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
    rollMode: resolveD20Contributors(contributors).rollMode,
    contributors
  }
}

function flankingContributor(input: {
  attackKind: unknown
  gameSystemId: string
  positionalFacts: CharacterRuleActionPositionalFacts | null | undefined
  sceneContext: Parameters<CharacterRuleActionSystemAdapter['bindFacts']>[0]['sceneContext']
}): {
  sourceId: string
  grantId: null
  domainKey: string
  influence: 'ADVANTAGE'
} | null {
  const facts = input.positionalFacts
  const scene = input.sceneContext
  if (!facts || !scene) return null
  const capabilityDefinitionIds = resolveDnd5eFlankingParticipantCapabilityDefinitionIds({
    automationMode: facts.automationMode,
    gameSystemId: input.gameSystemId,
    optionalCombatSnapshot: facts.optionalCombatSnapshot,
    optionalCombatSnapshotChecksum: facts.optionalCombatSnapshotChecksum
  })
  if (capabilityDefinitionIds.length !== 1) return null
  const capabilityDefinitionId = capabilityDefinitionIds[0]!
  const sourceCapability = facts.sourceCapabilityState.capabilities.find(
    (candidate) => candidate.capability.capabilityDefinitionId === capabilityDefinitionId
  )
  if (!sourceCapability) return null
  const contributor = resolveDnd5eFlankingContributor({
    attackClassification: isDnd5eMeleeAttackKind(input.attackKind) ? 'MELEE' : 'OTHER',
    automationMode: facts.automationMode,
    gameSystemId: input.gameSystemId,
    grid: scene.grid,
    optionalCombatSnapshot: facts.optionalCombatSnapshot,
    optionalCombatSnapshotChecksum: facts.optionalCombatSnapshotChecksum,
    attacker: {
      actorId: scene.sourceToken.actorId,
      token: {
        height: scene.sourceToken.height,
        id: scene.sourceToken.tokenId,
        position: scene.sourceToken.position,
        width: scene.sourceToken.width
      },
      canSeeTarget: facts.sourceCanSeeTarget,
      targetRelationship: facts.sourceTargetRelationship,
      participantCapability: {
        availability: sourceCapability,
        availabilityChecksum: checksumRuleDocument(sourceCapability)
      }
    },
    target: {
      actorId: scene.targetToken.actorId,
      token: {
        height: scene.targetToken.height,
        id: scene.targetToken.tokenId,
        position: scene.targetToken.position,
        width: scene.targetToken.width
      }
    },
    alliedCandidates: facts.candidates.flatMap((candidate) => {
      const capability = candidate.capabilityState.capabilities.find(
        (availability) => availability.capability.capabilityDefinitionId === capabilityDefinitionId
      )
      return capability
        ? [
            {
              actorId: candidate.actorId,
              token: {
                height: candidate.token.height,
                id: candidate.token.tokenId,
                position: candidate.token.position,
                width: candidate.token.width
              },
              attackerRelationship: candidate.sourceRelationship,
              canSeeTarget: candidate.canSeeTarget,
              targetRelationship: candidate.targetRelationship,
              participantCapability: {
                availability: capability,
                availabilityChecksum: checksumRuleDocument(capability)
              }
            }
          ]
        : []
    })
  }).contributor
  return contributor
    ? {
        sourceId: contributor.sourceId,
        grantId: contributor.grantId,
        domainKey: contributor.domainKey,
        influence: contributor.influence
      }
    : null
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

function dndSourceFromCompilerSource(
  source: CompiledActionCompilerSource
): Dnd5eCompiledEffectActionSource {
  return {
    gameSystemId: DND5E_SYSTEM_ID,
    entryPointDefinitionId: source.entryPointDefinitionId,
    effectId: source.effectId,
    conditionDefinitionIds: source.conditionDefinitionIds,
    savingThrowAbilityDefinitionId: source.savingThrowAbilityDefinitionId,
    compiledEffect: source.compiledEffect as Dnd5eCompiledEffectActionSource['compiledEffect']
  }
}

function testOutcomeTemplateIdentities(action: Dnd5eCompiledEffectActionSource) {
  const directRepeatConditionEntry = repeatingDirectFollowUpSaveConditionEntry(action)
  if (directRepeatConditionEntry) {
    return [
      {
        pathCode: 'ON_SAVE_FAIL',
        template: {
          definitionId: action.effectId,
          gameSystemId: DND5E_SYSTEM_ID,
          definitionFamilyKey: DND5E_EFFECT_ACTION_FAMILY_KEY,
          checksum: checksumRuleDocument([directRepeatConditionEntry])
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
    const groups = selectedOutcomeGroups(action, pathCode)
    if (groups.length === 0) continue
    if (
      (pathCode === 'ON_HIT' || pathCode === 'ON_CRIT') &&
      isExactImmediateFollowUpSaveAction(action)
    ) {
      outcomes.push({
        pathCode,
        template: {
          definitionId: action.effectId,
          gameSystemId: DND5E_SYSTEM_ID,
          definitionFamilyKey: DND5E_EFFECT_ACTION_FAMILY_KEY,
          checksum: checksumRuleDocument(action.compiledEffect.entries)
        }
      })
      continue
    }
    // Validate every reachable outcome at source compilation time. The
    // specialized graph itself is intentionally deferred until locked
    // runtime scaling facts are available.
    for (const entries of groups) {
      for (const entry of entries) specializedTestOutcome(entry)
    }
    outcomes.push({
      pathCode,
      template: {
        definitionId: action.effectId,
        gameSystemId: DND5E_SYSTEM_ID,
        definitionFamilyKey: DND5E_EFFECT_ACTION_FAMILY_KEY,
        checksum: checksumRuleDocument(groups)
      }
    })
  }
  if (outcomes.length === 0) unsupported('D&D test action has no specialized outcome path.')
  return outcomes
}

export const dnd5eCharacterRuleActionSystemAdapter: CharacterRuleActionSystemAdapter = {
  gameSystemId: DND5E_SYSTEM_ID,
  compile: compileDnd5eEffectAction,
  compileZonePlacement: ({ action }) => zonePlacementPlan(action),
  interpretSpatial,
  compileExecutionPlan: ({ action, compilerSource }) => {
    const source = dndSourceFromCompilerSource(compilerSource)
    if (
      !testPhaseKindOrNull(source) ||
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
    const testTemplate = compileDnd5eEffectActionTestTemplate({
      action: source
    })
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
  compileTestTemplate: ({ compilerSource }) => {
    const test = compileDnd5eEffectActionTestTemplate({
      action: dndSourceFromCompilerSource(compilerSource)
    })
    return { published: test.published, template: templateIdentity(test) }
  },
  specializeOutcomeTemplate: ({ compilerSource, testTemplate, selectedPath, facts }) => {
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
      facts: dndScalingFactsFromRuleValues(facts)
    })
    return outcome
      ? {
          published: outcome.published,
          templateChecksum: outcome.templateChecksum
        }
      : null
  },
  positionalCapabilityDefinitionIds: ({
    automationMode,
    optionalCombatSnapshot,
    optionalCombatSnapshotChecksum
  }) =>
    resolveDnd5eFlankingParticipantCapabilityDefinitionIds({
      automationMode,
      gameSystemId: DND5E_SYSTEM_ID,
      optionalCombatSnapshot,
      optionalCombatSnapshotChecksum
    }),
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
    const requirement =
      definition.adapterFacts[DND5E_ACTIVE_EFFECT_REPEAT_SAVE_PERCEPTION_REQUIREMENT_FACT_KEY]
    if (influence === undefined && requirement === undefined) return null
    if (
      (influence !== 'ADVANTAGE' && influence !== 'DISADVANTAGE') ||
      !['DETECT', 'LOCATE', 'PRECISE', 'SEE'].includes(String(requirement))
    ) {
      throw new Dnd5eEffectActionCompilerError(
        'D&D recurring perception influence is not fully pinned.'
      )
    }
    return {
      influence,
      requirement: requirement as 'DETECT' | 'LOCATE' | 'PRECISE' | 'SEE'
    }
  },
  activeEffectPlans: ({ action, published }) => {
    if (published.id !== action.effectId || published.checksum.length !== 64)
      throw new Dnd5eEffectActionCompilerError('The D&D active effect plan source is invalid.')
    const repeatPlan =
      repeatingDirectFollowUpSavePlan(action) ?? repeatingImmediateFollowUpSavePlan(action)
    const timedPlan = repeatPlan
      ? null
      : (timedImmediateConditionPlan(action) ?? modifierGrantPlan(action))
    const relationship = relationshipPlan(action)
    const plan =
      repeatPlan ??
      timedPlan ??
      relationship ??
      supportedRecurringPlan(action) ??
      concealmentPlan(action)
    if (!plan) return []
    const frozenGraph = repeatPlan
      ? repeatFollowUpSavePublishedGraph({ action, plan: repeatPlan })
      : timedPlan
        ? durationPublishedGraph({ action, plan: timedPlan })
        : relationship
          ? relationship.frozenGraph
          : published
    const test = repeatPlan || timedPlan || relationship ? null : testPlan(action)
    const outcome = repeatPlan || timedPlan || relationship || test ? null : supported(action)
    const firstEntry = action.compiledEffect.entries[0]
    const recurringOutcome = firstEntry && 'outcome' in firstEntry ? firstEntry.outcome : null
    const expectedOperation = relationship
      ? relationship.recurrenceStage === 'START_OF_TURN'
        ? DND5E_DAMAGE_PROPOSAL_OPERATION_KEY
        : DND5E_ACTOR_RELATIONSHIP_STATE_OPERATION_KEY
      : repeatPlan
        ? DND5E_SAVE_TEST_OPERATION_KEY
        : timedPlan
          ? DND5E_CONDITION_DURATION_OPERATION_KEY
          : test && recurringOutcome
            ? testProposalOperationKey(boundedTestOutcome(action.compiledEffect.entries[0]!))
            : outcome?.kind === 'DICE_HEAL'
              ? outcome.temporary
                ? DND5E_TEMPORARY_HIT_POINTS_PROPOSAL_OPERATION_KEY
                : DND5E_HEAL_PROPOSAL_OPERATION_KEY
              : outcome?.kind === 'HEAL'
                ? DND5E_HEAL_PROPOSAL_OPERATION_KEY
                : outcome?.kind === 'TEMPORARY_HIT_POINTS'
                  ? DND5E_TEMPORARY_HIT_POINTS_PROPOSAL_OPERATION_KEY
                  : outcome?.kind === 'DAMAGE'
                    ? DND5E_DAMAGE_PROPOSAL_OPERATION_KEY
                    : outcome?.kind === 'CONCEAL'
                      ? DND5E_CONCEAL_PROPOSAL_OPERATION_KEY
                      : DND5E_CONDITION_APPLY_PROPOSAL_OPERATION_KEY
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
          binding.sourceEntryId === plan.compiledEntryId &&
          binding.nodeId === plan.frozenGraphNodeId
      ).length !== 1
    )
      throw new Dnd5eEffectActionCompilerError(
        'The D&D active effect plan does not bind one exact authored result block.'
      )
    return [{ ...plan, frozenGraph }]
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
    conditionOutcomeRules,
    conditionImmunityIds,
    sceneContext,
    positionalFacts
  }) => {
    const resolvedDamageExpressionFacts: Record<string, string> = {}
    const resolvedDamageOutcomeExpressions: Record<string, string> = {}
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
    let resolvedHealModifierFacts: Record<string, number> = {}
    if (requiresHealModifier) {
      const healingOutcomes = Array.isArray(actionOutcomes)
        ? actionOutcomes.filter(
            (outcome): outcome is Record<string, unknown> =>
              !!outcome &&
              typeof outcome === 'object' &&
              !Array.isArray(outcome) &&
              (outcome as Record<string, unknown>).kind === 'HEAL' &&
              typeof (outcome as Record<string, unknown>).expression === 'string'
          )
        : []
      if (healingOutcomes.length !== 1)
        throw new Dnd5eEffectActionCompilerError(
          'D&D dice healing requires one exact resolved healing expression.'
        )
      const parsed = parseBoundedDiceConfiguration(healingOutcomes[0]!.expression)
      const authoredTerm = authoredHealingDiceTerm(published)
      const resolvedTerm = parsed.terms[0]
      if (
        !resolvedTerm ||
        resolvedTerm.count !== authoredTerm.count ||
        resolvedTerm.die !== authoredTerm.die
      )
        throw new Dnd5eEffectActionCompilerError(
          'D&D resolved healing expression does not match the authored dice.'
        )
      resolvedHealModifierFacts = {
        [DND5E_RESOLVED_HEAL_MODIFIER_FACT_KEY]: parsed.modifier
      }
    }
    const { spellCastLevel, classLevels, selectedOptionalRiderIds } = actionMechanic
    const baseFacts = {
      [DND5E_TARGET_ACTOR_FACT_KEY]: targetActorId,
      [DND5E_TARGET_STATE_CHECKSUM_FACT_KEY]: checksumRuleDocument({
        targetActorId,
        currentHitPoints,
        temporaryHitPoints,
        maximumHitPoints,
        scalarValues: targetScalarValues,
        conditionIds: targetConditionIds
      }),
      ...conditionImmunityFacts(published.definition, conditionImmunityIds),
      ...resolvedDamageExpressionFacts,
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
          })
    }
    const action = actionMechanic as {
      attackBonus?: unknown
      attackRollMode?: unknown
      attackKind?: unknown
      save?: { abilityDefinitionId?: unknown; dc?: unknown } | null
    }
    const derivedStats = targetDerivedFacts.derivedStats as
      | { armorClass?: { effective?: unknown }; savingThrows?: unknown }
      | undefined
    const statBlock = targetDerivedFacts.statBlock as { armorClass?: unknown } | undefined
    const armorClass = derivedStats?.armorClass?.effective ?? statBlock?.armorClass
    const sourceContributorEvidence = sourceDerivedFacts.rollContributorEvidence as
      | {
          attacks?: Record<
            string,
            readonly {
              sourceId: string
              grantId: string
              domainKey: string
              influence: 'ADVANTAGE' | 'DISADVANTAGE'
            }[]
          >
        }
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
      const dc =
        dcBinding?.kind === 'LITERAL' &&
        typeof dcBinding.value === 'number' &&
        Number.isSafeInteger(dcBinding.value)
          ? dcBinding.value
          : null
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
          contributors: readonly {
            sourceId: string
            grantId: string | null
            domainKey: string | null
            influence: 'ADVANTAGE' | 'DISADVANTAGE'
          }[]
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
        .map(({ sourceId, grantId, domainKey, influence }) => ({
          sourceId,
          grantId,
          domainKey,
          influence
        }))
        .sort(compareCanonicalD20Contributors)
      const contributorChecksum = checksumRuleDocument(contributors)
      return {
        facts: {
          ...baseFacts,
          [DND5E_SAVE_MODIFIER_FACT_KEY]: matches[0]!.modifier,
          [DND5E_SAVE_DC_FACT_KEY]: dc,
          [DND5E_ROLL_CONTRIBUTOR_CHECKSUM_FACT_KEY]: contributorChecksum,
          [DND5E_TEST_OUTCOME_RULE_FACT_KEY]: dnd5eSaveOutcomeRule(
            conditionOutcomeRules,
            nestedSaveAbilityDefinitionId
          )
        },
        d20RollMode: matches[0]!.rollMode,
        d20Roller: 'TARGET',
        d20Audit: {
          contributors,
          contributorChecksum,
          modifier: matches[0]!.modifier,
          defenseOrDc: dc
        }
      }
    }
    if (typeof action.attackBonus === 'number' && Number.isSafeInteger(action.attackBonus)) {
      if (typeof armorClass !== 'number' || !Number.isSafeInteger(armorClass))
        throw new Dnd5eEffectActionCompilerError('D&D attack target defense is unavailable.')
      if (
        action.attackRollMode !== 'NORMAL' &&
        action.attackRollMode !== 'ADVANTAGE' &&
        action.attackRollMode !== 'DISADVANTAGE'
      )
        throw new Dnd5eEffectActionCompilerError('D&D attack roll mode is unavailable.')
      // Roll-mode evidence is keyed by the modifier domain the attack reads.
      const attackKind = attackKindSchema.safeParse(action.attackKind)
      const contributors = (
        sourceContributorEvidence?.attacks?.[
          attackKind.success ? dnd5eAttackModifierDomain(attackKind.data) : 'MELEE'
        ] ?? []
      ).map(({ sourceId, grantId, domainKey, influence }) => ({
        sourceId,
        grantId,
        domainKey,
        influence
      }))
      const flanking = flankingContributor({
        attackKind: action.attackKind,
        gameSystemId: DND5E_SYSTEM_ID,
        positionalFacts,
        sceneContext
      })
      const allContributors = flanking ? [...contributors, flanking] : contributors
      allContributors.sort(compareCanonicalD20Contributors)
      const hasAdvantage = allContributors.some(
        (contributor) => contributor.influence === 'ADVANTAGE'
      )
      const hasDisadvantage = allContributors.some(
        (contributor) => contributor.influence === 'DISADVANTAGE'
      )
      const rollMode = hasAdvantage
        ? hasDisadvantage
          ? 'NORMAL'
          : 'ADVANTAGE'
        : hasDisadvantage
          ? 'DISADVANTAGE'
          : 'NORMAL'
      const contributorChecksum = checksumRuleDocument(allContributors)
      return {
        facts: {
          ...baseFacts,
          [DND5E_ATTACK_MODIFIER_FACT_KEY]: action.attackBonus,
          [DND5E_TARGET_DEFENSE_FACT_KEY]: armorClass,
          [DND5E_ROLL_CONTRIBUTOR_CHECKSUM_FACT_KEY]: contributorChecksum,
          [DND5E_TEST_OUTCOME_RULE_FACT_KEY]: conditionOutcomeRules?.hitIsCritical
            ? 'HIT_IS_CRITICAL'
            : 'NONE'
        },
        d20RollMode: rollMode,
        d20Roller: 'SOURCE',
        d20Audit: {
          contributors: allContributors,
          contributorChecksum,
          modifier: action.attackBonus,
          defenseOrDc: armorClass
        }
      }
    }
    const save = action.save
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
      return {
        facts: {
          ...baseFacts,
          [DND5E_SAVE_MODIFIER_FACT_KEY]: modifier,
          [DND5E_SAVE_DC_FACT_KEY]: save.dc,
          [DND5E_ROLL_CONTRIBUTOR_CHECKSUM_FACT_KEY]: contributorChecksum,
          [DND5E_TEST_OUTCOME_RULE_FACT_KEY]: dnd5eSaveOutcomeRule(
            conditionOutcomeRules,
            save.abilityDefinitionId
          )
        },
        d20RollMode: rollMode,
        d20Roller: 'TARGET',
        d20Audit: {
          contributors,
          contributorChecksum,
          modifier,
          defenseOrDc: save.dc
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
    conditionImmunityIds,
    perception
  }) => {
    if (definition.frozenGraph.source.gameSystemId !== DND5E_SYSTEM_ID)
      throw new Dnd5eEffectActionCompilerError(
        'D&D active-effect graph belongs to another Game System.'
      )
    const baseFacts = {
      ...definition.adapterFacts,
      [DND5E_TARGET_ACTOR_FACT_KEY]: targetActorId,
      [DND5E_TARGET_STATE_CHECKSUM_FACT_KEY]: checksumRuleDocument({
        targetActorId,
        currentHitPoints,
        temporaryHitPoints,
        maximumHitPoints,
        scalarValues: targetScalarValues,
        conditionIds: targetConditionIds
      }),
      ...conditionImmunityFacts(definition.frozenGraph, conditionImmunityIds)
    }
    const abilityDefinitionId =
      definition.adapterFacts[DND5E_ACTIVE_EFFECT_SAVE_ABILITY_DEFINITION_FACT_KEY]
    const requestNodeId = definition.adapterFacts[DND5E_ACTIVE_EFFECT_SAVE_REQUEST_NODE_FACT_KEY]
    const dc = definition.adapterFacts[DND5E_SAVE_DC_FACT_KEY]
    const saveDc = typeof dc === 'number' && Number.isSafeInteger(dc) ? dc : null
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
        contributors: readonly {
          sourceId: string
          grantId: string | null
          domainKey: string | null
          influence: 'ADVANTAGE' | 'DISADVANTAGE'
        }[]
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
      .map(({ sourceId, grantId, domainKey, influence }) => ({
        sourceId,
        grantId,
        domainKey,
        influence
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
      if (perception.satisfied) {
        contributors.push({
          sourceId: `active-effect-perception:${activeEffectId}`,
          grantId: null,
          domainKey: `perception:${perception.checksum}`,
          influence: perceptionRequirement.influence
        })
        contributors.sort(compareCanonicalD20Contributors)
      }
    } else if (perception !== null && perception !== undefined) {
      throw new Dnd5eEffectActionCompilerError(
        'D&D active effect received an unbound perception result.'
      )
    }
    const resolvedContributors = resolveD20Contributors(contributors)
    const contributorChecksum = checksumRuleDocument(resolvedContributors.contributors)
    if (
      definition.frozenGraph.nodes.filter(
        (node) =>
          node.id === requestNodeId &&
          node.operation.key === 'evidence.integer-range' &&
          node.operation.contractVersion === 1
      ).length !== 1
    ) {
      throw new Dnd5eEffectActionCompilerError('D&D recurring save request binding is invalid.')
    }
    return {
      facts: {
        ...baseFacts,
        [DND5E_SAVE_MODIFIER_FACT_KEY]: matches[0]!.modifier,
        [DND5E_ROLL_CONTRIBUTOR_CHECKSUM_FACT_KEY]: contributorChecksum,
        [DND5E_TEST_OUTCOME_RULE_FACT_KEY]: dnd5eSaveOutcomeRule(
          conditionOutcomeRules,
          abilityDefinitionId
        )
      },
      evidencePolicy: {
        requestNodeId,
        rollMode: resolvedContributors.rollMode,
        contributors: [...resolvedContributors.contributors],
        contributorChecksum,
        modifier: matches[0]!.modifier,
        dc: saveDc
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
    const timedConditionId = definition.adapterFacts[DND5E_ACTIVE_EFFECT_TIMED_CONDITION_FACT_KEY]
    if (timedConditionId !== undefined) {
      if (typeof timedConditionId !== 'string' || !UUID.test(timedConditionId))
        throw new Dnd5eEffectActionCompilerError('D&D timed condition identity is unavailable.')
      return lifecycle.remainingTicks === 1
        ? {
            applications: [
              {
                kind: 'CONDITION_REMOVE' as const,
                conditionId: timedConditionId,
                sourceActiveEffectId: activeEffectId,
                targetActorId: target.targetActorId,
                sourceNodeId: definition.frozenGraphNodeId,
                sourceOperationKey: DND5E_CONDITION_DURATION_OPERATION_KEY,
                authoredPath: null,
                resolvedPath: null
              }
            ],
            terminal: true
          }
        : { applications: [], terminal: false, emptyApplicationAllowed: true }
    }
    const published = publishedDefinitionForFrozenGraph(graph)
    const repeatedSavePath = repeatedFollowUpSaveResultPath({
      execution,
      occurrenceId: target.occurrenceId,
      definition,
      graph,
      targetActorId: target.targetActorId
    })
    if (repeatedSavePath !== null) {
      const conditionId =
        definition.adapterFacts[DND5E_ACTIVE_EFFECT_REPEAT_SAVE_CONDITION_FACT_KEY]
      if (typeof conditionId !== 'string' || !UUID.test(conditionId)) {
        throw new Dnd5eEffectActionCompilerError(
          'D&D repeat-save condition identity is unavailable.'
        )
      }
      const terminal =
        repeatedSavePath === 'ON_SAVE_SUCCESS' ||
        (repeatedSavePath === 'ON_SAVE_FAIL' && lifecycle.remainingTicks === 1)
      return terminal
        ? {
            applications: [
              {
                kind: 'CONDITION_REMOVE' as const,
                conditionId,
                sourceActiveEffectId: activeEffectId,
                targetActorId: target.targetActorId,
                sourceNodeId: definition.frozenGraphNodeId,
                sourceOperationKey: DND5E_SAVE_TEST_OPERATION_KEY,
                authoredPath: repeatedSavePath,
                resolvedPath: repeatedSavePath
              }
            ],
            terminal: true
          }
        : {
            applications: [],
            terminal: false,
            emptyApplicationAllowed: true
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
    return { applications, terminal: false }
  }
}
