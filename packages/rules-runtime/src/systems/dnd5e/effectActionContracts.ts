import type { CharacterRuleActionForcedMovementDirection as ForcedMovementDirection } from '../../characterRuleActionSystemAdapter.js'
import {
  type CharacterRuleActionForcedMovementCollision,
  CharacterRuleActionUnsupportedCompilationError
} from '../../characterRuleActionSystemAdapter.js'
import { type TeleportAllowanceDestinationKind } from '@artificer-toolkit/shared/vtt/teleportAllowanceDestinationKind'

export const DND5E_EFFECT_ACTION_FAMILY_KEY = 'effect-action'
export const DND5E_HEAL_PROPOSAL_OPERATION_KEY = 'dnd5e.heal-proposal'
export const DND5E_TEMPORARY_HIT_POINTS_PROPOSAL_OPERATION_KEY =
  'dnd5e.temporary-hit-points-proposal'
export const DND5E_STABILIZE_PROPOSAL_OPERATION_KEY = 'dnd5e.stabilize-proposal'
export const DND5E_KILL_PROPOSAL_OPERATION_KEY = 'dnd5e.kill-proposal'
export const DND5E_DEPART_PROPOSAL_OPERATION_KEY = 'dnd5e.depart-proposal'
export const DND5E_MODIFIER_GRANT_PROPOSAL_OPERATION_KEY = 'dnd5e.modifier-grant-proposal'
export const DND5E_ACTOR_LINK_PROPOSAL_OPERATION_KEY = 'dnd5e.actor-link-proposal'
export const DND5E_CREATURE_FORM_PROPOSAL_OPERATION_KEY = 'dnd5e.creature-form-proposal'
export const DND5E_MANUAL_ADJUDICATION_PROPOSAL_OPERATION_KEY = 'dnd5e.manual-adjudication-proposal'
export const DND5E_CONCEAL_PROPOSAL_OPERATION_KEY = 'dnd5e.conceal-proposal'
export const DND5E_DETECT_CONCEALED_PROPOSAL_OPERATION_KEY = 'dnd5e.detect-concealed-proposal'
export const DND5E_DAMAGE_PROPOSAL_OPERATION_KEY = 'dnd5e.damage-proposal'
export const DND5E_HIT_POINT_MAXIMUM_REDUCTION_PROPOSAL_OPERATION_KEY =
  'dnd5e.hit-point-maximum-reduction-proposal'
export const DND5E_SCALAR_REDUCTION_PROPOSAL_OPERATION_KEY = 'dnd5e.scalar-reduction-proposal'
export const DND5E_FORCED_MOVEMENT_PROPOSAL_OPERATION_KEY = 'dnd5e.forced-movement-proposal'
export const DND5E_DAMAGE_TOTAL_OPERATION_KEY = 'dnd5e.damage-total'
export const DND5E_DAMAGE_REDUCTION_OPERATION_KEY = 'dnd5e.damage-reduction'
export const DND5E_DAMAGE_MULTIPLIER_OPERATION_KEY = 'dnd5e.damage-multiplier'
export const DND5E_HEAL_TOTAL_OPERATION_KEY = 'dnd5e.heal-total'
export const DND5E_CONDITION_APPLY_PROPOSAL_OPERATION_KEY = 'dnd5e.condition-apply-proposal'
export const DND5E_MOVEMENT_INTERRUPTION_AUTHORIZATION_OPERATION_KEY =
  'dnd5e.movement-interruption-authorization'
export const DND5E_ACTOR_RELATIONSHIP_STATE_OPERATION_KEY = 'dnd5e.actor-relationship-state'
export const DND5E_CONDITION_DURATION_OPERATION_KEY = 'dnd5e.condition-duration'
export const DND5E_EFFECT_ACTION_CAPABILITY_CONTRACT_VERSION = 1
export const DND5E_TARGET_ACTOR_FACT_KEY = 'encounter.target-actor-id'
export const DND5E_ATTACK_MODIFIER_FACT_KEY = 'dnd5e.attack-modifier'
export const DND5E_TARGET_DEFENSE_FACT_KEY = 'dnd5e.target-defense'
export const DND5E_SAVE_MODIFIER_FACT_KEY = 'dnd5e.save-modifier'
export const DND5E_SAVE_DC_FACT_KEY = 'dnd5e.save-dc'
export const DND5E_ROLL_CONTRIBUTOR_CHECKSUM_FACT_KEY = 'dnd5e.roll-contributor-checksum'
/** The target's condition test-outcome rule (D94): `NONE`, `SAVE_AUTO_FAIL` or `HIT_IS_CRITICAL`. */
export const DND5E_TEST_OUTCOME_RULE_FACT_KEY = 'dnd5e.test-outcome-rule'
/** The lowest natural d20 that scores a critical hit with this attack: 20 unless a grant lowers it. */
export const DND5E_ATTACK_CRITICAL_THRESHOLD_FACT_KEY = 'dnd5e.attack-critical-threshold'
/** The extra rolls of the attack's own damage die a critical hit adds (Brutal Critical); absent for none. */
export const DND5E_CRITICAL_EXTRA_DICE_FACT_KEY = 'dnd5e.critical-extra-dice'
export const DND5E_TARGET_STATE_CHECKSUM_FACT_KEY = 'dnd5e.target-state-checksum'
export const DND5E_TARGET_CONDITION_IMMUNE_FACT_KEY = 'dnd5e.target-condition-immune'
/**
 * The target's current hit points when the action resolves. A hit-point gate reads it; the gated
 * proposal checks it against the gate's band (`hitPointsAbove` and `hitPointsAtMost` literals), and
 * a tiered save selects its tier by it when the outcome is specialized.
 */
export const DND5E_TARGET_CURRENT_HIT_POINTS_FACT_KEY = 'dnd5e.target-current-hit-points'
/**
 * The ids of the damage types the target took since its last turn began, as sorted JSON text. A
 * damage-type suppression gate reads it, and only a graph that binds it carries it in its facts.
 */
export const DND5E_TARGET_DAMAGE_TYPES_TAKEN_FACT_KEY = 'dnd5e.target-damage-types-taken'
export const DND5E_CONDITION_IMMUNE_FACT_KEYS = {
  ON_USE: 'dnd5e.target-condition-immune.on-use',
  ON_HIT: 'dnd5e.target-condition-immune.on-hit',
  ON_MISS: 'dnd5e.target-condition-immune.on-miss',
  ON_CRIT: 'dnd5e.target-condition-immune.on-crit',
  ON_SAVE_FAIL: 'dnd5e.target-condition-immune.on-save-fail',
  ON_SAVE_SUCCESS: 'dnd5e.target-condition-immune.on-save-success',
  ON_CHECK_SUCCESS: 'dnd5e.target-condition-immune.on-check-success'
} as const
/**
 * A result path may apply several conditions ("grappled, and restrained until the grapple ends"),
 * each with its own immunity fact: the path's key for the first, `<key>.<n>` for the n-th.
 */
export const MAX_CONDITIONS_PER_PATH = 4
export function conditionImmuneFactKey(pathCode: string, ordinal: number): string | undefined {
  const key =
    DND5E_CONDITION_IMMUNE_FACT_KEYS[pathCode as keyof typeof DND5E_CONDITION_IMMUNE_FACT_KEYS]
  if (!key || !Number.isSafeInteger(ordinal) || ordinal < 1 || ordinal > MAX_CONDITIONS_PER_PATH)
    return undefined
  return ordinal === 1 ? key : `${key}.${ordinal}`
}
/** Whether a condition node's immunity fact is one of its result path's keys. */
export function isPathConditionImmuneFactKey(factKey: string, pathCode: string): boolean {
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
  ON_SAVE_SUCCESS: 'dnd5e.resolved-damage-expression.on-save-success',
  ON_CHECK_SUCCESS: 'dnd5e.resolved-damage-expression.on-check-success'
} as const satisfies Record<SpecializedPath, string>
export const DND5E_RESOLVED_DAMAGE_OUTCOME_EXPRESSIONS_FACT_KEY =
  'dnd5e.resolved-damage-outcome-expressions'
export const DND5E_RESOLVED_HEAL_MODIFIER_FACT_KEY = 'dnd5e.resolved-heal-modifier'
/** The amount a recurring heal with an ability bonus gives each turn, settled at cast (D156). */
export const DND5E_RECURRING_HEAL_AMOUNT_FACT_KEY = 'dnd5e.recurring-heal-amount'
/** The level a spell is cast at, which selects its authored per-level scaling. */
export const DND5E_SPELL_CAST_LEVEL_FACT_KEY = 'dnd5e.spell-cast-level'
/**
 * The optional on-hit riders the player chose for this attack (a JSON array of sorted rider effect
 * ids): an optional rider's merged entries resolve only when their rider is listed (D123).
 */
export const DND5E_SELECTED_OPTIONAL_RIDERS_FACT_KEY = 'dnd5e.selected-optional-riders'
/** The actor's level in each class (a JSON object by class id), which selects CLASS_LEVEL rows. */
export const DND5E_CLASS_LEVELS_FACT_KEY = 'dnd5e.class-levels'
/** The die faces a grant set for the weapon's damage; its authored dice roll that die instead. */
export const DND5E_WEAPON_DAMAGE_DIE_FACT_KEY = 'dnd5e.weapon-damage-die'
/** The attacked creature's type, which a path restriction reads when its outcome specializes. */
export const DND5E_TARGET_CREATURE_TYPE_FACT_KEY = 'dnd5e.target-creature-type'
/** The nearest able enemy of the attack's target (a JSON object); absent when no Scene measured it. */
export const DND5E_ATTACK_ENEMY_PROXIMITY_FACT_KEY = 'dnd5e.attack-enemy-proximity'
/** How far the attacker's latest move closed on the target (a JSON object); absent when no Scene measured it. */
export const DND5E_ATTACK_MOVE_TOWARD_FACT_KEY = 'dnd5e.attack-move-toward'
/** The once-per-turn uses already spent this turn (a JSON array of usage keys); absent when no record was read. */
export const DND5E_ATTACK_TURN_USES_FACT_KEY = 'dnd5e.attack-turn-uses'
/** The dice active grants add to, or take from, this source's damage to this target (D156). */
export const DND5E_DAMAGE_ADDED_DICE_FACT_KEY = 'dnd5e.damage-added-dice'
export const DND5E_ACTIVE_EFFECT_SAVE_ABILITY_DEFINITION_FACT_KEY =
  'dnd5e.active-effect-save-ability-definition-id'
export const DND5E_ACTIVE_EFFECT_SAVE_REQUEST_NODE_FACT_KEY =
  'dnd5e.active-effect-save-request-node-id'
/**
 * The conditions a repeat save holds, as one comma-separated list (adapter facts are scalar). The ids
 * are authored identifiers (UUIDs), which cannot contain a comma.
 */
export const DND5E_ACTIVE_EFFECT_REPEAT_SAVE_CONDITION_FACT_KEY =
  'dnd5e.active-effect-repeat-save-condition-ids'
/** The condition a failed repeat save leaves in place of the held one ("restrained, then petrified"). */
export const DND5E_ACTIVE_EFFECT_REPEAT_SAVE_ESCALATION_CONDITION_FACT_KEY =
  'dnd5e.active-effect-repeat-save-escalation-condition-id'
export const DND5E_ACTIVE_EFFECT_TIMED_CONDITION_FACT_KEY = 'dnd5e.active-effect-timed-condition'
export const DND5E_ACTIVE_EFFECT_REPEAT_SAVE_ROLL_INFLUENCE_FACT_KEY =
  'dnd5e.active-effect-repeat-save-roll-influence'
export const DND5E_ACTIVE_EFFECT_REPEAT_SAVE_PERCEPTION_REQUIREMENT_FACT_KEY =
  'dnd5e.active-effect-repeat-save-perception-requirement'
/** The damage type whose immunity makes the target succeed on this effect's save unrolled. */
export const DND5E_ACTIVE_EFFECT_SAVE_SUCCESS_IMMUNITY_FACT_KEY =
  'dnd5e.active-effect-save-success-immunity-damage-type-id'
/** Whether a repeat save is attempted when its perception requirement is met or unmet. */
export const DND5E_ACTIVE_EFFECT_REPEAT_SAVE_ATTEMPT_GATE_FACT_KEY =
  'dnd5e.active-effect-repeat-save-attempt-gate'
/** Whether this turn's repeat save is attempted; false settles the gated d20 without a request. */
export const DND5E_REPEAT_SAVE_ATTEMPT_ALLOWED_FACT_KEY = 'dnd5e.repeat-save-attempt-allowed'
export const DND5E_TEST_HEAL_PROPOSAL_OPERATION_KEY = 'dnd5e.test-heal-proposal'
export const DND5E_TEST_TEMPORARY_HIT_POINTS_PROPOSAL_OPERATION_KEY =
  'dnd5e.test-temporary-hit-points-proposal'
export const DND5E_TEST_DAMAGE_PROPOSAL_OPERATION_KEY = 'dnd5e.test-damage-proposal'
export const DND5E_TEST_CONDITION_PROPOSAL_OPERATION_KEY = 'dnd5e.test-condition-proposal'
export const DND5E_TEST_SCALAR_REDUCTION_PROPOSAL_OPERATION_KEY =
  'dnd5e.test-scalar-reduction-proposal'
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
export class Dnd5eEffectActionCompilerError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'Dnd5eEffectActionCompilerError'
  }
}
export type Outcome =
  | { kind: 'HEAL' | 'TEMPORARY_HIT_POINTS'; amount: number }
  | { kind: 'DAMAGE'; amount: number; damageTypeId: string }
  | { kind: 'CONDITION_APPLY'; conditionId: string }
  | { kind: 'STABILIZE' }
  | { kind: 'KILL' }
  | { kind: 'DEPART' }
  | { kind: 'MODIFIER_GRANT' }
  | { kind: 'ACTOR_LINK' }
  | { kind: 'CREATURE_FORM' }
  | { kind: 'MANUAL_ADJUDICATION' }
  | { kind: 'CONCEAL' }
  | { kind: 'DETECT_CONCEALED' }
  | { kind: 'ADD_SPEED_TO_MOVEMENT' }
  | {
      kind: 'TELEPORT_ALLOWANCE'
      maxFeet: number
      destinationKind: TeleportAllowanceDestinationKind
    }
  | { kind: 'CANCEL_TRIGGERING_EVENT' }
  | {
      kind: 'FORCED_MOVEMENT'
      direction: ForcedMovementDirection
      feet: number
      upTo: boolean
      collision: CharacterRuleActionForcedMovementCollision | null
    }
  | {
      kind: 'SCALAR_REDUCTION'
      amount: number
      valueDefinitionId: string
      recoveryTriggers: readonly ('SHORT_REST' | 'LONG_REST')[]
      terminalConsequence: 'TARGET_DIED'
    }
/**
 * Damage whose dice the test graph itself rolls, only when the test resolves to the authored path
 * (a placed zone's failed entry save). The dice are evidence requests of the one frozen graph.
 */
export type EntryDiceDamageOutcome = {
  kind: 'ENTRY_DICE_DAMAGE'
  diceConfig: string
  damageTypeId: string
  /** The compiled entry this result's proposal node is bound to. */
  entryId: string
  /** The share of the roll this result deals: 1 for the failed save, one half for the made save. */
  multiplier: number
}
/** The ids of the entry dice damage nodes: the executor reads the dice as these graph nodes. */
export const ENTRY_DAMAGE_NODE_PREFIX = 'damage-'
/** The node id suffix of a condition a zone's result path applies beside its damage (D142). */
export const CONDITION_PROPOSAL_SUFFIX = '-condition'

/** The failed save keeps the plain prefix; the made save rolls dice of its own, asked for only when it is the result. */
export function entryDamagePrefix(pathCode: string): string {
  return pathCode === 'ON_SAVE_SUCCESS'
    ? `${ENTRY_DAMAGE_NODE_PREFIX}success-`
    : ENTRY_DAMAGE_NODE_PREFIX
}
export type TestKind = 'ATTACK' | 'SAVE'
export type SpecializedPath =
  | 'ON_USE'
  | 'ON_HIT'
  | 'ON_MISS'
  | 'ON_CRIT'
  | 'ON_SAVE_FAIL'
  | 'ON_SAVE_SUCCESS'
  | 'ON_CHECK_SUCCESS'

export function isSpecializedPath(value: string): value is SpecializedPath {
  return [
    'ON_USE',
    'ON_HIT',
    'ON_MISS',
    'ON_CRIT',
    'ON_SAVE_FAIL',
    'ON_SAVE_SUCCESS',
    'ON_CHECK_SUCCESS'
  ].includes(value)
}
/** A damage type left unresolved (the triggering weapon's, never merged) is not a UUID. */
export function isUuid(value: string | undefined): value is string {
  return value !== undefined && UUID.test(value)
}

export function uuid(value: string | undefined, label: string): asserts value is string {
  if (!isUuid(value)) throw new Dnd5eEffectActionCompilerError(`${label} must be a canonical UUID.`)
}
export function unsupported(message: string): never {
  throw new CharacterRuleActionUnsupportedCompilationError(message)
}
/** An authored damage multiplier (for example half on a successful save), rounded down. */
export function multipliedDamageAmount(amount: number, multiplier: number): number {
  const value = Math.floor(amount * multiplier)
  if (!Number.isFinite(multiplier) || multiplier < 0 || !Number.isSafeInteger(value))
    throw new Dnd5eEffectActionCompilerError(
      'D&D damage multiplier must be a finite nonnegative number.'
    )
  return value
}
/** One die size per damage roll, as a single dice term such as `1d6`. */
export const COLLISION_DICE_CONFIG = /^[1-9]\d?d[1-9]\d{0,2}$/
/** The collision as the proposal carries it: canonical JSON, or empty when the move has none. */
export function encodeForcedMovementCollision(
  collision: CharacterRuleActionForcedMovementCollision | null
) {
  return collision ? JSON.stringify(collision) : ''
}

/** The collision a proposal carries; null when it carries none, and a rejection for text that is not one. */
export function decodeForcedMovementCollision(
  encoded: unknown
): CharacterRuleActionForcedMovementCollision | null {
  if (encoded === '') return null
  const invalid = () =>
    new Dnd5eEffectActionCompilerError('D&D forced movement collision is invalid.')
  if (typeof encoded !== 'string') throw invalid()
  let parsed: Partial<CharacterRuleActionForcedMovementCollision>
  try {
    parsed = JSON.parse(encoded)
  } catch {
    throw invalid()
  }
  const { diceConfig, damageTypeId, abilityDefinitionId, dc, conditionId } = parsed
  if (
    typeof diceConfig !== 'string' ||
    !COLLISION_DICE_CONFIG.test(diceConfig) ||
    typeof damageTypeId !== 'string' ||
    !UUID.test(damageTypeId) ||
    typeof abilityDefinitionId !== 'string' ||
    !UUID.test(abilityDefinitionId) ||
    typeof dc !== 'number' ||
    !Number.isSafeInteger(dc) ||
    typeof conditionId !== 'string' ||
    !UUID.test(conditionId)
  )
    throw invalid()
  const collision = { diceConfig, damageTypeId, abilityDefinitionId, dc, conditionId }
  if (encodeForcedMovementCollision(collision) !== encoded) throw invalid()
  return collision
}
export const NESTED_SAVE_MARGIN_NODE_ID = 'nested-save-margin'
export const nestedSaveRiderConditionNodeId = (index: number) =>
  index === 0 ? 'nested-save-rider-condition' : `nested-save-rider-condition-${index + 1}`
/** The authored result path in a direct proposal node id: `[prefix]proposal-<path>[-condition]`. */
export function proposalNodePathCode(nodeId: string): string | null {
  return /(?:^|-)proposal-([a-z_]+)(?:-condition)?$/.exec(nodeId)?.[1]?.toUpperCase() ?? null
}
export function positive(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0
}
