import {
  serverPublishedRuleDefinitionDtoSchema,
  type ServerPublishedRuleDefinitionDto
} from '@artificer-toolkit/schema/shared/rulesExecution'
import type { CompiledDamageEffect, CompiledEffectGroup } from '@artificer-toolkit/shared/compilers'
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
  CharacterRuleActionPositionalFacts
} from '../../characterRuleActionSystemAdapter.js'
import { CharacterRuleActionUnsupportedCompilationError } from '../../characterRuleActionSystemAdapter.js'
import {
  CONDITION_RULE_STATE_DEFINITION_FAMILY_KEY,
  RULE_CAPABILITY_DEFINITION_FAMILY_KEY
} from '../../reusableDefinitionService.js'
import {
  MOVEMENT_REACTION_CHOICE_MAX_FACT_KEY,
  MOVEMENT_REACTION_CHOICE_MIN_FACT_KEY,
  MOVEMENT_REACTION_CHOICE_OPERATION_KEY
} from '../../movementReactionChoice.js'
import { DND5E_SYSTEM_ID } from './characterActionCapabilityDiscovery.js'
import { dnd5eConcentrationCapabilityContribution } from './concentrationPolicy.js'
import { dnd5eEncounterLifecycleCapabilityContribution } from './encounterLifecyclePolicy.js'
import { dnd5eReactionEligibilityCapabilityContribution } from './reactionEligibilityPolicy.js'
import {
  resolveDnd5eFlankingContributor,
  resolveDnd5eFlankingParticipantCapabilityDefinitionIds
} from './flankingPolicy.js'
import {
  DND5E_ATTACK_TEST_OPERATION_KEY,
  DND5E_SAVE_TEST_OPERATION_KEY
} from './dnd5eTestOperationKeys.js'

export const DND5E_EFFECT_ACTION_FAMILY_KEY = 'effect-action'
export const DND5E_HEAL_PROPOSAL_OPERATION_KEY = 'dnd5e.heal-proposal'
export const DND5E_TEMPORARY_HIT_POINTS_PROPOSAL_OPERATION_KEY =
  'dnd5e.temporary-hit-points-proposal'
export const DND5E_DAMAGE_PROPOSAL_OPERATION_KEY = 'dnd5e.damage-proposal'
export const DND5E_DAMAGE_TOTAL_OPERATION_KEY = 'dnd5e.damage-total'
export const DND5E_CONDITION_APPLY_PROPOSAL_OPERATION_KEY = 'dnd5e.condition-apply-proposal'
export const DND5E_TARGET_ACTOR_FACT_KEY = 'encounter.target-actor-id'
export const DND5E_ATTACK_MODIFIER_FACT_KEY = 'dnd5e.attack-modifier'
export const DND5E_TARGET_DEFENSE_FACT_KEY = 'dnd5e.target-defense'
export const DND5E_SAVE_MODIFIER_FACT_KEY = 'dnd5e.save-modifier'
export const DND5E_SAVE_DC_FACT_KEY = 'dnd5e.save-dc'
export const DND5E_ROLL_CONTRIBUTOR_CHECKSUM_FACT_KEY = 'dnd5e.roll-contributor-checksum'
export const DND5E_TARGET_STATE_CHECKSUM_FACT_KEY = 'dnd5e.target-state-checksum'
export const DND5E_TARGET_CONDITION_IMMUNE_FACT_KEY = 'dnd5e.target-condition-immune'
export const DND5E_CONDITION_IMMUNE_FACT_KEYS = {
  ON_USE: 'dnd5e.target-condition-immune.on-use',
  ON_HIT: 'dnd5e.target-condition-immune.on-hit',
  ON_MISS: 'dnd5e.target-condition-immune.on-miss',
  ON_CRIT: 'dnd5e.target-condition-immune.on-crit',
  ON_SAVE_FAIL: 'dnd5e.target-condition-immune.on-save-fail',
  ON_SAVE_SUCCESS: 'dnd5e.target-condition-immune.on-save-success'
} as const
export const DND5E_RESOLVED_DAMAGE_EXPRESSION_FACT_KEYS = {
  ON_USE: 'dnd5e.resolved-damage-expression.on-use',
  ON_HIT: 'dnd5e.resolved-damage-expression.on-hit',
  ON_MISS: 'dnd5e.resolved-damage-expression.on-miss',
  ON_CRIT: 'dnd5e.resolved-damage-expression.on-crit',
  ON_SAVE_FAIL: 'dnd5e.resolved-damage-expression.on-save-fail',
  ON_SAVE_SUCCESS: 'dnd5e.resolved-damage-expression.on-save-success'
} as const satisfies Record<SpecializedPath, string>
export const DND5E_ACTIVE_EFFECT_SAVE_ABILITY_DEFINITION_FACT_KEY =
  'dnd5e.active-effect-save-ability-definition-id'
export const DND5E_ACTIVE_EFFECT_SAVE_REQUEST_NODE_FACT_KEY =
  'dnd5e.active-effect-save-request-node-id'
export { DND5E_ATTACK_TEST_OPERATION_KEY, DND5E_SAVE_TEST_OPERATION_KEY }
export const DND5E_TEST_HEAL_PROPOSAL_OPERATION_KEY = 'dnd5e.test-heal-proposal'
export const DND5E_TEST_TEMPORARY_HIT_POINTS_PROPOSAL_OPERATION_KEY =
  'dnd5e.test-temporary-hit-points-proposal'
export const DND5E_TEST_DAMAGE_PROPOSAL_OPERATION_KEY = 'dnd5e.test-damage-proposal'
export const DND5E_TEST_CONDITION_PROPOSAL_OPERATION_KEY = 'dnd5e.test-condition-proposal'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
function activeEffectGraphNodeId(compiledEntryId: string): string {
  return `active_effect_${compiledEntryId}`
}
export class Dnd5eEffectActionCompilerError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'Dnd5eEffectActionCompilerError'
  }
}
type Outcome =
  | { kind: 'HEAL' | 'TEMPORARY_HIT_POINTS'; amount: number }
  | { kind: 'DAMAGE'; amount: number; damageTypeId: string }
  | { kind: 'CONDITION_APPLY'; conditionId: string }
type SpecializedOutcome = Outcome | { kind: 'DICE_DAMAGE'; damageTypeId: string }
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
export type Dnd5eEffectScalingFacts = Readonly<{
  characterLevel?: number
  parentClassLevel?: number
  spellCastLevel?: number
  classLevels?: Readonly<Record<string, number>>
  resolvedDamageExpressions?: Readonly<Partial<Record<SpecializedPath, string>>>
}>

export type Dnd5eEffectActionTemplate = Readonly<{
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
    spellCastLevel: positiveInteger(facts.spellCastLevel),
    resolvedDamageExpressions: Object.fromEntries(
      Object.entries(DND5E_RESOLVED_DAMAGE_EXPRESSION_FACT_KEYS).flatMap(([path, key]) => {
        const expression = facts[key]
        return typeof expression === 'string' ? [[path, expression]] : []
      })
    )
  }
}
/** Exact compiled-effect input shared by runtime publication and source manifest admission. */
export type Dnd5eCompiledEffectActionSource = Pick<
  EffectActionCapabilityDescriptor,
  | 'gameSystemId'
  | 'entryPointDefinitionId'
  | 'effectId'
  | 'conditionDefinitionIds'
  | 'savingThrowAbilityDefinitionId'
  | 'compiledEffect'
>
interface TestPlan {
  kind: TestKind
  branches: ReadonlyMap<string, Outcome>
}

function testPhaseKindOrNull(action: Dnd5eCompiledEffectActionSource): TestKind | null {
  const trigger = action.compiledEffect.invocation.triggerCode
  const attack = [
    'MELEE_WEAPON_ATTACK',
    'RANGED_WEAPON_ATTACK',
    'UNARMED_ATTACK',
    'SPELL_ATTACK'
  ].includes(trigger)
  if (attack) return 'ATTACK'
  return trigger === 'SAVING_THROW' ? 'SAVE' : null
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
    'reactionMovementTrigger' in invocation &&
    invocation.reactionMovementTrigger?.kind === 'MOVEMENT'
  )
}

function isSupportedTestTargetPolicy(
  invocation: Dnd5eCompiledEffectActionSource['compiledEffect']['invocation']
): boolean {
  if (invocation.kind !== 'ACTION') return false
  if (
    invocation.targeting?.selectionKind !== 'SINGLE_TARGET' ||
    invocation.targeting.dispositionKind !== 'ANY' ||
    invocation.targeting.excludedCreatureTypeIds?.length
  ) {
    return false
  }
  if (invocation.activation.code === 'ACTION') {
    return (
      invocation.range.rangeKind === 'UNLIMITED' ||
      (invocation.range.rangeKind === 'DISTANCE' &&
        Number.isSafeInteger(invocation.range.amount) &&
        invocation.range.amount > 0)
    )
  }
  return (
    invocation.activation.code === 'REACTION' &&
    invocation.range.rangeKind === 'DISTANCE' &&
    Number.isSafeInteger(invocation.range.amount) &&
    invocation.range.amount > 0
  )
}
function uuid(value: string, label: string) {
  if (!UUID.test(value))
    throw new Dnd5eEffectActionCompilerError(`${label} must be a canonical UUID.`)
}

function unsupported(message: string): never {
  throw new CharacterRuleActionUnsupportedCompilationError(message)
}

function supportedRecurringPlan(
  action: Dnd5eCompiledEffectActionSource
): CharacterRuleActionActiveEffectPlan | null {
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
    !lifecycle.consumeOnFirstEvent &&
    (lifecycle.endOnEvents?.length ?? 0) === 0
  if (
    invocation.kind === 'ACTION' &&
    invocation.triggerCode === 'SAVING_THROW' &&
    invocation.activation.code === 'ACTION' &&
    invocation.activation.amount === 1 &&
    entries.length === 1 &&
    entry.resolutionKind === 'DIRECT' &&
    entry.groupKind === 'SINGLE' &&
    entry.pathCode === 'ON_SAVE_FAIL' &&
    !entry.rangeOverride &&
    !entry.targetingOverride &&
    recurringLifecycleIsSupported
  ) {
    if (recurringStage === null || recurringAmount === null) return null
    const savingThrow = invocation.savingThrow
    const pinnedSaveDc =
      savingThrow?.dcMethod === 'FIXED_DC' &&
      typeof savingThrow.baseDc === 'number' &&
      Number.isSafeInteger(savingThrow.baseDc)
        ? savingThrow.baseDc
        : null
    if (
      !action.savingThrowAbilityDefinitionId ||
      !UUID.test(action.savingThrowAbilityDefinitionId) ||
      pinnedSaveDc === null
    ) {
      unsupported(
        'D&D recurring saving throws require one pinned ability definition and exact fixed DC.'
      )
    }
    if (!UUID.test(entry.resultBlockId))
      unsupported('D&D recurring active-effect result blocks require a UUID-backed identity.')
    return {
      authoredEffectId: action.effectId,
      compiledEntryId: entry.resultBlockId,
      frozenGraphNodeId: 'proposal-on_save_fail',
      recurrenceStage: recurringStage,
      initialRemaining: recurringAmount,
      adapterFacts: {
        [DND5E_ACTIVE_EFFECT_SAVE_ABILITY_DEFINITION_FACT_KEY]:
          action.savingThrowAbilityDefinitionId,
        [DND5E_SAVE_DC_FACT_KEY]: pinnedSaveDc,
        [DND5E_ACTIVE_EFFECT_SAVE_REQUEST_NODE_FACT_KEY]: 'd20'
      },
      perceptionContributions: [],
      maintenance: null
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
    recurrenceStage: recurringStage,
    initialRemaining: recurringAmount,
    adapterFacts: {},
    perceptionContributions: [],
    maintenance: entry.maintenanceDefinitionId
      ? {
          definitionId: (() => {
            uuid(entry.maintenanceDefinitionId!, 'D&D maintenance definition identity')
            return entry.maintenanceDefinitionId!
          })(),
          definitionChecksum: null,
          owner: 'SOURCE_ACTOR',
          replacementPolicy: 'REPLACE_SAME_DEFINITION',
          emptyDependentPolicy: 'TERMINATE_WHEN_EMPTY'
        }
      : null
  }
}

function boundedTestOutcome(entry: CompiledEffectGroup['entries'][number]): Outcome {
  if (!('outcome' in entry)) unsupported('D&D test actions require direct authored outcomes.')
  const outcome = entry.outcome
  if (outcome.effectKind === 'CONDITION') {
    uuid(outcome.conditionId, 'D&D condition definition identity')
    return { kind: 'CONDITION_APPLY', conditionId: outcome.conditionId }
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
    amount: outcome.amount,
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
      return { kind: 'DAMAGE', amount, damageTypeId: outcome.damageTypeId }
    }
    validateDiceOutcomeRow(outcome)
    uuid(outcome.damageTypeId, 'D&D damage type identity')
    return { kind: 'DICE_DAMAGE', damageTypeId: outcome.damageTypeId }
  }
  return boundedTestOutcome(entry)
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
    invocation.shape ||
    entries.length < 1 ||
    entries.length > allowedPaths.length
  )
    unsupported(
      'D&D test actions must use one bounded single-target action or movement-reaction shape.'
    )
  const branches = new Map<string, Outcome>()
  const recurringPlan = supportedRecurringPlan(action)
  for (const entry of entries) {
    if (
      entry.resolutionKind !== 'DIRECT' ||
      entry.groupKind !== 'SINGLE' ||
      ((entry.duration || entry.lifecycle) &&
        (recurringPlan?.compiledEntryId !== entry.resultBlockId || kind !== 'SAVE')) ||
      entry.rangeOverride ||
      entry.targetingOverride ||
      !allowedPaths.includes(entry.pathCode) ||
      branches.has(entry.pathCode)
    )
      unsupported('D&D test action branches must be unique fixed direct authored paths.')
    const outcome = boundedTestOutcome(entry)
    if (
      outcome.kind === 'CONDITION_APPLY' &&
      !(action.conditionDefinitionIds ?? []).includes(outcome.conditionId)
    )
      unsupported('D&D test action condition is not in the pinned System vocabulary.')
    branches.set(entry.pathCode, outcome)
  }
  return { kind, branches }
}

function supported(action: Dnd5eCompiledEffectActionSource): Outcome {
  const effect = action.compiledEffect
  const invocation = effect.invocation
  const supportsSelf =
    invocation.range.rangeKind === 'SELF' && invocation.targeting?.selectionKind === 'SELF'
  const supportsUnlimitedSingleTarget =
    invocation.range.rangeKind === 'UNLIMITED' &&
    invocation.targeting?.selectionKind === 'SINGLE_TARGET' &&
    invocation.targeting.dispositionKind === 'ANY' &&
    !invocation.targeting.excludedCreatureTypeIds?.length
  if (
    invocation.kind !== 'ACTION' ||
    invocation.triggerCode !== 'ACTIVATED' ||
    invocation.activation.code !== 'ACTION' ||
    invocation.activation.amount !== 1 ||
    (!supportsSelf && !supportsUnlimitedSingleTarget) ||
    invocation.shape
  )
    unsupported('D&D Effect action is not the supported activated self action shape.')
  const entry = effect.entries[0]
  if (
    effect.entries.length !== 1 ||
    !entry ||
    entry.resolutionKind !== 'DIRECT' ||
    entry.groupKind !== 'SINGLE' ||
    entry.pathCode !== 'ON_USE' ||
    (entry.maintenanceDefinitionId && !supportedRecurringPlan(action)) ||
    ((entry.duration || entry.lifecycle) && !supportedRecurringPlan(action)) ||
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
  if (outcome.effectKind === 'CONDITION') {
    uuid(outcome.conditionId, 'D&D condition definition identity')
    if (!(action.conditionDefinitionIds ?? []).includes(outcome.conditionId))
      unsupported('D&D Effect action condition is not in the pinned System vocabulary.')
    return { kind: 'CONDITION_APPLY', conditionId: outcome.conditionId }
  }
  if (outcome.effectKind !== 'HEAL' && outcome.effectKind !== 'DAMAGE')
    unsupported('D&D Effect action outcome is not a supported hit-point or condition outcome.')
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
    amount: outcome.amount,
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
export const dnd5eDamageTotalOperation: PureRuleOperationContract = {
  key: DND5E_DAMAGE_TOTAL_OPERATION_KEY,
  contractVersion: 1,
  executionKind: 'PURE',
  inputs: { subtotal: RULE_VALUE_KIND.NUMBER, modifier: RULE_VALUE_KIND.NUMBER },
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

function testOperation(key: string, kind: TestKind): PureRuleOperationContract {
  return {
    key,
    contractVersion: 1,
    executionKind: 'PURE',
    inputs: {
      targetActorId: RULE_VALUE_KIND.TEXT,
      naturalD20: RULE_VALUE_KIND.NUMBER,
      modifier: RULE_VALUE_KIND.NUMBER,
      threshold: RULE_VALUE_KIND.NUMBER,
      contributorChecksum: RULE_VALUE_KIND.TEXT
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
      if (
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
      const resultPath =
        kind === 'ATTACK'
          ? naturalD20 === 20
            ? 'ON_CRIT'
            : naturalD20 === 1 || total < threshold
              ? 'ON_MISS'
              : 'ON_HIT'
          : total >= threshold
            ? 'ON_SAVE_SUCCESS'
            : 'ON_SAVE_FAIL'
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
export const dnd5eEffectActionCapability: GameSystemRuleCapabilityContract = {
  gameSystemId: DND5E_SYSTEM_ID,
  contractVersion: 1,
  authoredRootKinds: ['effect'],
  definitionFamilyKeys: [
    DND5E_EFFECT_ACTION_FAMILY_KEY,
    'dnd5e-optional-combat',
    RULE_CAPABILITY_DEFINITION_FAMILY_KEY,
    CONDITION_RULE_STATE_DEFINITION_FAMILY_KEY,
    ...new Set([
      ...dnd5eConcentrationCapabilityContribution.definitionFamilyKeys,
      ...dnd5eEncounterLifecycleCapabilityContribution.definitionFamilyKeys,
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
    {
      key: DND5E_TARGET_STATE_CHECKSUM_FACT_KEY,
      valueKind: RULE_VALUE_KIND.TEXT
    },
    {
      key: DND5E_TARGET_CONDITION_IMMUNE_FACT_KEY,
      valueKind: RULE_VALUE_KIND.BOOLEAN
    },
    ...Object.values(DND5E_CONDITION_IMMUNE_FACT_KEYS).map((key) => ({
      key,
      valueKind: RULE_VALUE_KIND.BOOLEAN
    })),
    ...Object.values(DND5E_RESOLVED_DAMAGE_EXPRESSION_FACT_KEYS).map((key) => ({
      key,
      valueKind: RULE_VALUE_KIND.TEXT
    })),
    {
      key: MOVEMENT_REACTION_CHOICE_MIN_FACT_KEY,
      valueKind: RULE_VALUE_KIND.NUMBER
    },
    {
      key: MOVEMENT_REACTION_CHOICE_MAX_FACT_KEY,
      valueKind: RULE_VALUE_KIND.NUMBER
    },
    ...dnd5eConcentrationCapabilityContribution.factContracts,
    ...dnd5eEncounterLifecycleCapabilityContribution.factContracts,
    ...dnd5eReactionEligibilityCapabilityContribution.factContracts
  ],
  operationContracts: [
    'evidence.integer-range',
    addNumbersRuleOperation.key,
    MOVEMENT_REACTION_CHOICE_OPERATION_KEY,
    DND5E_HEAL_PROPOSAL_OPERATION_KEY,
    DND5E_TEMPORARY_HIT_POINTS_PROPOSAL_OPERATION_KEY,
    DND5E_DAMAGE_PROPOSAL_OPERATION_KEY,
    DND5E_DAMAGE_TOTAL_OPERATION_KEY,
    DND5E_CONDITION_APPLY_PROPOSAL_OPERATION_KEY,
    DND5E_ATTACK_TEST_OPERATION_KEY,
    DND5E_SAVE_TEST_OPERATION_KEY,
    DND5E_TEST_HEAL_PROPOSAL_OPERATION_KEY,
    DND5E_TEST_TEMPORARY_HIT_POINTS_PROPOSAL_OPERATION_KEY,
    DND5E_TEST_DAMAGE_PROPOSAL_OPERATION_KEY,
    DND5E_TEST_CONDITION_PROPOSAL_OPERATION_KEY,
    ...dnd5eConcentrationCapabilityContribution.operationContracts.map(({ key }) => key),
    ...dnd5eEncounterLifecycleCapabilityContribution.operationContracts.map(({ key }) => key),
    ...dnd5eReactionEligibilityCapabilityContribution.operationContracts.map(({ key }) => key)
  ]
    .filter((key, index, keys) => keys.indexOf(key) === index)
    .map((key) => ({ key, contractVersion: 1 }))
}

function testProposalOperationKey(outcome: Outcome): string {
  return outcome.kind === 'HEAL'
    ? DND5E_TEST_HEAL_PROPOSAL_OPERATION_KEY
    : outcome.kind === 'TEMPORARY_HIT_POINTS'
      ? DND5E_TEST_TEMPORARY_HIT_POINTS_PROPOSAL_OPERATION_KEY
      : outcome.kind === 'DAMAGE'
        ? DND5E_TEST_DAMAGE_PROPOSAL_OPERATION_KEY
        : DND5E_TEST_CONDITION_PROPOSAL_OPERATION_KEY
}

function proposalNode(pathCode: string, outcome: Outcome) {
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
  recurringPlan: CharacterRuleActionActiveEffectPlan | null
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
        operation: { key: testOperation, contractVersion: 1 },
        inputs: {
          targetActorId: { kind: 'FACT', factKey: DND5E_TARGET_ACTOR_FACT_KEY },
          naturalD20: { kind: 'NODE_OUTPUT', nodeId: 'd20', port: 'value' },
          modifier: { kind: 'FACT', factKey: modifierFact },
          threshold: { kind: 'FACT', factKey: thresholdFact },
          contributorChecksum: {
            kind: 'FACT',
            factKey: DND5E_ROLL_CONTRIBUTOR_CHECKSUM_FACT_KEY
          }
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
    invocation.shape ||
    action.compiledEffect.entries.length < 1
  ) {
    unsupported('D&D test action has an unsupported bounded shape.')
  }
  const paths = new Set<string>()
  for (const entry of action.compiledEffect.entries) {
    if (
      entry.resolutionKind !== 'DIRECT' ||
      entry.groupKind !== 'SINGLE' ||
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
    if (
      outcome.kind === 'CONDITION_APPLY' &&
      !(action.conditionDefinitionIds ?? []).includes(outcome.conditionId)
    ) {
      unsupported('D&D test action condition is not in the pinned System vocabulary.')
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
export function compileDnd5eEffectActionTestTemplate({
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
        inputs: { min: { kind: 'LITERAL', value: 1 }, max: { kind: 'LITERAL', value: 20 } }
      },
      {
        id: 'test',
        operation: { key: testOperation, contractVersion: 1 },
        inputs: {
          targetActorId: { kind: 'FACT', factKey: DND5E_TARGET_ACTOR_FACT_KEY },
          naturalD20: { kind: 'NODE_OUTPUT', nodeId: 'd20', port: 'value' },
          modifier: { kind: 'FACT', factKey: modifierFact },
          threshold: { kind: 'FACT', factKey: thresholdFact },
          contributorChecksum: { kind: 'FACT', factKey: DND5E_ROLL_CONTRIBUTOR_CHECKSUM_FACT_KEY }
        }
      }
    ],
    outputs: {
      targetActorId: { kind: 'NODE_OUTPUT', nodeId: 'test', port: 'targetActorId' },
      naturalD20: { kind: 'NODE_OUTPUT', nodeId: 'test', port: 'naturalD20' },
      total: { kind: 'NODE_OUTPUT', nodeId: 'test', port: 'total' },
      resultPath: { kind: 'NODE_OUTPUT', nodeId: 'test', port: 'resultPath' },
      contributorChecksum: { kind: 'NODE_OUTPUT', nodeId: 'test', port: 'contributorChecksum' }
    }
  }
  const published = serverPublishedRuleDefinitionDtoSchema.parse({
    id: definition.id,
    gameSystemId: definition.gameSystemId,
    definitionFamilyKey: definition.definitionFamilyKey,
    checksum: checksumRuleDocument(definition),
    definition
  })
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

function exactDiceConfiguration(
  outcomes: readonly Record<string, unknown>[],
  facts: Dnd5eEffectScalingFacts,
  selectedPath: SpecializedPath
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
    const candidates = outcomes
      .filter(
        (candidate) =>
          typeof candidate.level === 'number' &&
          Number.isSafeInteger(candidate.level) &&
          candidate.level <= level &&
          typeof candidate.dice === 'string'
      )
      .sort(
        (left, right) =>
          Number(right.level) - Number(left.level) || Number(left.order) - Number(right.order)
      )
    const selected = candidates[0]
    if (!selected || typeof selected.dice !== 'string')
      unsupported('D&D dice scaling does not select an authored value.')
    authored = selected.dice
  }
  const resolved = facts.resolvedDamageExpressions?.[selectedPath]
  if (!resolved) {
    if (Array.isArray(outcome.bonuses) && outcome.bonuses.length > 0)
      unsupported('D&D resolved damage expression is unavailable.')
    return authored
  }
  const authoredDice = parseBoundedDiceConfiguration(authored)
  const resolvedDice = parseBoundedDiceConfiguration(resolved)
  const authoredTerm = authoredDice.terms[0]!
  const resolvedTerm = resolvedDice.terms[0]!
  if (authoredTerm.count !== resolvedTerm.count || authoredTerm.die !== resolvedTerm.die)
    unsupported('D&D resolved damage expression does not match the authored dice.')
  return resolved
}

function diceGraphDefinition(input: {
  action: Dnd5eCompiledEffectActionSource
  entry: CompiledEffectGroup['entries'][number]
  diceConfig: string
  nodePrefix?: string
}): RuleGraphDefinition {
  if (!('outcome' in input.entry) || input.entry.outcome.effectKind !== 'DAMAGE')
    unsupported('Only direct D&D damage dice outcomes are currently specialized.')
  const outcome = input.entry.outcome
  if (outcome.valueKind !== 'DICE') unsupported('D&D outcome is not dice-backed.')
  uuid(outcome.damageTypeId, 'D&D damage type identity')
  const parsed = parseBoundedDiceConfiguration(input.diceConfig)
  const term = parsed.terms[0]
  if (
    !term ||
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
          ? { kind: 'NODE_OUTPUT' as const, nodeId: dieNodeId(0), port: 'value' }
          : { kind: 'NODE_OUTPUT' as const, nodeId: sumNodeId(index - 1), port: 'value' },
      right: { kind: 'NODE_OUTPUT' as const, nodeId: dieNodeId(index + 1), port: 'value' }
    }
  }))
  const rolledSubtotal =
    term.count === 1
      ? { kind: 'NODE_OUTPUT' as const, nodeId: dieNodeId(0), port: 'value' }
      : { kind: 'NODE_OUTPUT' as const, nodeId: sumNodeId(term.count - 2), port: 'value' }
  const totalNode =
    parsed.modifier === 0
      ? []
      : [
          {
            id: `${prefix}damage-total`,
            operation: { key: DND5E_DAMAGE_TOTAL_OPERATION_KEY, contractVersion: 1 },
            inputs: {
              subtotal: rolledSubtotal,
              modifier: { kind: 'LITERAL' as const, value: parsed.modifier }
            }
          }
        ]
  const amount =
    parsed.modifier === 0
      ? rolledSubtotal
      : { kind: 'NODE_OUTPUT' as const, nodeId: `${prefix}damage-total`, port: 'value' }
  const proposalId = `proposal-${input.entry.pathCode.toLowerCase()}`
  return {
    schemaVersion: 1,
    id: input.action.effectId,
    gameSystemId: DND5E_SYSTEM_ID,
    definitionFamilyKey: DND5E_EFFECT_ACTION_FAMILY_KEY,
    nodes: [
      ...diceNodes,
      ...sumNodes,
      ...totalNode,
      {
        id: proposalId,
        operation: { key: DND5E_DAMAGE_PROPOSAL_OPERATION_KEY, contractVersion: 1 },
        inputs: {
          targetActorId: { kind: 'FACT', factKey: DND5E_TARGET_ACTOR_FACT_KEY },
          targetStateChecksum: { kind: 'FACT', factKey: DND5E_TARGET_STATE_CHECKSUM_FACT_KEY },
          amount,
          damageTypeId: { kind: 'LITERAL', value: outcome.damageTypeId }
        }
      }
    ],
    outputs: {
      targetActorId: { kind: 'NODE_OUTPUT', nodeId: proposalId, port: 'targetActorId' },
      amount: { kind: 'NODE_OUTPUT', nodeId: proposalId, port: 'amount' },
      damageTypeId: { kind: 'NODE_OUTPUT', nodeId: proposalId, port: 'damageTypeId' }
    },
    ...(UUID.test(input.entry.resultBlockId)
      ? { sourceEntryBindings: [{ sourceEntryId: input.entry.resultBlockId, nodeId: proposalId }] }
      : {})
  }
}

function fixedOutcomeGraphDefinition(input: {
  action: Dnd5eCompiledEffectActionSource
  entry: CompiledEffectGroup['entries'][number]
  outcome: Outcome
}): RuleGraphDefinition {
  const proposalId = `proposal-${input.entry.pathCode.toLowerCase()}`
  const operation =
    input.outcome.kind === 'HEAL'
      ? DND5E_HEAL_PROPOSAL_OPERATION_KEY
      : input.outcome.kind === 'TEMPORARY_HIT_POINTS'
        ? DND5E_TEMPORARY_HIT_POINTS_PROPOSAL_OPERATION_KEY
        : input.outcome.kind === 'DAMAGE'
          ? DND5E_DAMAGE_PROPOSAL_OPERATION_KEY
          : DND5E_CONDITION_APPLY_PROPOSAL_OPERATION_KEY
  const inputs = {
    targetActorId: { kind: 'FACT' as const, factKey: DND5E_TARGET_ACTOR_FACT_KEY },
    targetStateChecksum: {
      kind: 'FACT' as const,
      factKey: DND5E_TARGET_STATE_CHECKSUM_FACT_KEY
    },
    ...(input.outcome.kind === 'CONDITION_APPLY'
      ? {
          conditionId: { kind: 'LITERAL' as const, value: input.outcome.conditionId },
          conditionImmune: {
            kind: 'FACT' as const,
            factKey:
              DND5E_CONDITION_IMMUNE_FACT_KEYS[
                input.entry.pathCode as keyof typeof DND5E_CONDITION_IMMUNE_FACT_KEYS
              ]
          }
        }
      : {
          amount: { kind: 'LITERAL' as const, value: input.outcome.amount },
          ...(input.outcome.kind === 'DAMAGE'
            ? { damageTypeId: { kind: 'LITERAL' as const, value: input.outcome.damageTypeId } }
            : {})
        })
  }
  const outputs = {
    targetActorId: { kind: 'NODE_OUTPUT' as const, nodeId: proposalId, port: 'targetActorId' },
    ...(input.outcome.kind === 'CONDITION_APPLY'
      ? { conditionId: { kind: 'NODE_OUTPUT' as const, nodeId: proposalId, port: 'conditionId' } }
      : {
          amount: { kind: 'NODE_OUTPUT' as const, nodeId: proposalId, port: 'amount' },
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
    ...('resultBlockId' in input.entry && UUID.test(input.entry.resultBlockId)
      ? { sourceEntryBindings: [{ sourceEntryId: input.entry.resultBlockId, nodeId: proposalId }] }
      : {})
  }
}

function authoredOutcomeGroups(
  action: Dnd5eCompiledEffectActionSource,
  pathCode: SpecializedPath
): readonly (readonly CompiledEffectGroup['entries'][number][])[] {
  const entries = action.compiledEffect.entries.filter((entry) => entry.pathCode === pathCode)
  if (entries.length === 0) return []
  if (entries.some((entry) => !('outcome' in entry)))
    unsupported('D&D selected outcome path must retain exact authored outcomes.')
  const groups = new Map<string, CompiledEffectGroup['entries'][number][]>()
  for (const entry of entries) {
    if (!('resultBlockId' in entry) || typeof entry.resultBlockId !== 'string')
      unsupported('D&D selected outcome path must retain an exact authored result block.')
    const group = groups.get(entry.resultBlockId)
    if (group) group.push(entry)
    else groups.set(entry.resultBlockId, [entry])
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

/** Build the selected OUTCOME phase from exact locked facts after TEST completes. */
export function specializeDnd5eEffectActionOutcome(input: {
  action: Dnd5eCompiledEffectActionSource
  testTemplate: Dnd5eEffectActionTemplate
  selectedPath: SpecializedPath
  facts: Dnd5eEffectScalingFacts
}): Dnd5eEffectActionTemplate | null {
  const expectedTest = compileDnd5eEffectActionTestTemplate({ action: input.action })
  if (
    input.testTemplate.phase !== 'TEST' ||
    input.testTemplate.published.id !== input.action.effectId ||
    input.testTemplate.templateChecksum !== input.testTemplate.published.checksum ||
    input.testTemplate.templateChecksum !== expectedTest.templateChecksum
  ) {
    throw new Dnd5eEffectActionCompilerError(
      'D&D outcome specialization must bind its exact TEST template.'
    )
  }
  supportedTestPhaseKind(input.action)
  assertKnownTestResultPath(input.action, input.selectedPath)
  const groups = selectedOutcomeGroups(input.action, input.selectedPath)
  if (groups.length === 0) return null
  const definitions = groups.map((entries, groupIndex) => {
    const entry = entries[0]
    if (!entry) unsupported('D&D selected outcome path is unavailable.')
    const outcome = specializedTestOutcome(entry)
    return outcome.kind === 'DICE_DAMAGE'
      ? diceGraphDefinition({
          action: input.action,
          entry,
          diceConfig: exactDiceConfiguration(
            entries.map(
              (candidate) =>
                (candidate as Extract<typeof candidate, { outcome: unknown }>)
                  .outcome as unknown as Record<string, unknown>
            ),
            input.facts,
            input.selectedPath
          ),
          ...(groups.length > 1 ? { nodePrefix: `outcome${groupIndex + 1}-` } : {})
        })
      : entries.length === 1
        ? fixedOutcomeGraphDefinition({ action: input.action, entry, outcome })
        : unsupported('D&D fixed outcome path must compile to one direct result.')
  })
  const definition = mergedOutcomeGraphDefinition({ action: input.action, definitions })
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
    // The selected authored result groups are the immutable OUTCOME template;
    // the published checksum above identifies its locked dice specialization.
    templateChecksum: checksumRuleDocument(groups)
  }
}

/**
 * A movement interruption is an explicit authored reaction binding.  The
 * compiler projects it into the graph so execution never infers it from an
 * action label, outcome, or system-specific branch.
 */
function bindMovementInterruptionOutput(input: {
  action: Dnd5eCompiledEffectActionSource
  published: ServerPublishedRuleDefinitionDto
}): ServerPublishedRuleDefinitionDto {
  const binding =
    'reactionMovementTrigger' in input.action.compiledEffect.invocation
      ? input.action.compiledEffect.invocation.reactionMovementTrigger?.movementInterruption
      : null
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
      movementInterruption: { kind: 'NODE_OUTPUT', nodeId: proposalNodeId, port: 'authorized' }
    }
  }
  return serverPublishedRuleDefinitionDtoSchema.parse({
    ...input.published,
    checksum: checksumRuleDocument(definition),
    definition
  })
}

export function compileDnd5eEffectAction({
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
  const recurringPlan = supportedRecurringPlan(action)
  const plan = testPlan(action)
  if (plan) {
    return bindMovementInterruptionOutput({
      action,
      published: compileTestDefinition(action, plan, recurringPlan)
    })
  }
  const outcome = supported(action)
  const operation =
    outcome.kind === 'HEAL'
      ? DND5E_HEAL_PROPOSAL_OPERATION_KEY
      : outcome.kind === 'TEMPORARY_HIT_POINTS'
        ? DND5E_TEMPORARY_HIT_POINTS_PROPOSAL_OPERATION_KEY
        : outcome.kind === 'DAMAGE'
          ? DND5E_DAMAGE_PROPOSAL_OPERATION_KEY
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
          ...(outcome.kind === 'CONDITION_APPLY'
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
      ...(outcome.kind === 'CONDITION_APPLY'
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

/**
 * Uses the exact publication compiler as the source-capability predicate.
 * Expected unsupported authored shapes are a closed classification; malformed
 * source/pin failures still throw and abort generation.
 */
export function classifyDnd5eCompiledEffectAction(
  action: Dnd5eCompiledEffectActionSource
): 'AUTOMATIC' | 'JUDGMENT_REQUIRED' {
  try {
    compileDnd5eEffectAction({ action })
    return 'AUTOMATIC'
  } catch (error) {
    if (error instanceof CharacterRuleActionUnsupportedCompilationError) return 'JUDGMENT_REQUIRED'
    throw error
  }
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
  const [d20Trace, testTrace, ...proposalTraces] = execution.evidence.trace
  const testKeys = new Set([
    DND5E_ATTACK_TEST_OPERATION_KEY,
    DND5E_SAVE_TEST_OPERATION_KEY,
    DND5E_TEST_HEAL_PROPOSAL_OPERATION_KEY,
    DND5E_TEST_TEMPORARY_HIT_POINTS_PROPOSAL_OPERATION_KEY,
    DND5E_TEST_DAMAGE_PROPOSAL_OPERATION_KEY,
    DND5E_TEST_CONDITION_PROPOSAL_OPERATION_KEY
  ])
  const containsTestTrace = input.execution.evidence.trace.some(
    (trace) =>
      testKeys.has(trace.operation.key) || trace.nodeId === 'd20' || trace.nodeId === 'test'
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
    if (containsTestTrace)
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
  const expectedPath = attack
    ? naturalD20 === 20
      ? 'ON_CRIT'
      : naturalD20 === 1 || naturalD20 + modifier < threshold
        ? 'ON_MISS'
        : 'ON_HIT'
    : naturalD20 + modifier >= threshold
      ? 'ON_SAVE_SUCCESS'
      : 'ON_SAVE_FAIL'
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
      sourceNodeId: replacementProposal.nodeId,
      sourceOperationKey: replacementProposal.operation.key,
      authoredPath: replacementProposal.outputs.authoredPath as string,
      resolvedPath: replacementProposal.outputs.resolvedPath as string
    }))
    applications.push(...traced)
    for (const application of traced) {
      if (application.kind === 'CONDITION_APPLY') continue
      input = {
        ...input,
        currentHitPoints: application.afterCurrentHitPoints,
        temporaryHitPoints: application.afterTemporaryHitPoints
      }
    }
  }
  return applications
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
        : node.id.startsWith('proposal-')
          ? node.id.slice('proposal-'.length).toUpperCase()
          : null
    const factKey = legacySingleCondition
      ? DND5E_TARGET_CONDITION_IMMUNE_FACT_KEY
      : pathCode
        ? DND5E_CONDITION_IMMUNE_FACT_KEYS[
            pathCode as keyof typeof DND5E_CONDITION_IMMUNE_FACT_KEYS
          ]
        : undefined
    if (!factKey || !binding || binding.kind !== 'FACT' || binding.factKey !== factKey)
      throw new Dnd5eEffectActionCompilerError(
        'The D&D condition action immunity binding is invalid.'
      )
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
        : publishedNode.id.startsWith('proposal-')
          ? publishedNode.id.slice('proposal-'.length).toUpperCase()
          : null
    const conditionFactKey = legacySingleCondition
      ? DND5E_TARGET_CONDITION_IMMUNE_FACT_KEY
      : authoredPath
        ? DND5E_CONDITION_IMMUNE_FACT_KEYS[
            authoredPath as keyof typeof DND5E_CONDITION_IMMUNE_FACT_KEYS
          ]
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
  if (
    vulnerable &&
    !immune &&
    resistant !== vulnerable &&
    !Number.isSafeInteger(requestedAmount * 2)
  )
    throw new Dnd5eEffectActionCompilerError(
      'D&D vulnerable damage exceeds the supported safe integer range.'
    )
  const resolvedAmount = immune
    ? 0
    : resistant === vulnerable
      ? requestedAmount
      : resistant
        ? Math.floor(requestedAmount / 2)
        : vulnerable
          ? requestedAmount * 2
          : requestedAmount
  const damageDisposition = immune
    ? 'IMMUNE'
    : resistant && vulnerable
      ? 'CANCELLED'
      : resistant
        ? 'RESISTANT'
        : vulnerable
          ? 'VULNERABLE'
          : 'NORMAL'
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
    DND5E_DAMAGE_PROPOSAL_OPERATION_KEY,
    DND5E_CONDITION_APPLY_PROPOSAL_OPERATION_KEY
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
  for (const proposal of proposals) {
    const proposalNode = graph.nodes.find((node) => node.id === proposal.nodeId)
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
                : { ...proposal, outputs: { ...proposal.outputs, amount: resolvedAmount } }
            ]
          }
        }
      },
      graph
    )
    applications.push(...direct)
    for (const application of direct) {
      if (application.kind === 'CONDITION_APPLY') continue
      input = {
        ...input,
        currentHitPoints: application.afterCurrentHitPoints,
        temporaryHitPoints: application.afterTemporaryHitPoints
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
    attackClassification: input.attackKind === 'MELEE' ? 'MELEE' : 'OTHER',
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
  compileExecutionPlan: ({ action, compilerSource }) => {
    const source = dndSourceFromCompilerSource(compilerSource)
    if (!testPhaseKindOrNull(source)) {
      return { kind: 'SINGLE_GRAPH', published: compileDnd5eEffectAction({ action }) }
    }
    const testTemplate = compileDnd5eEffectActionTestTemplate({ action: source })
    return {
      kind: 'TEST_OUTCOME',
      compilerSource,
      test: { published: testTemplate.published, template: templateIdentity(testTemplate) },
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
    const outcome = specializeDnd5eEffectActionOutcome({
      action,
      testTemplate: expectedTest,
      selectedPath,
      facts: dndScalingFactsFromRuleValues(facts)
    })
    return outcome
      ? { published: outcome.published, templateChecksum: outcome.templateChecksum }
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
  activeEffectPlans: ({ action, published }) => {
    if (published.id !== action.effectId || published.checksum.length !== 64)
      throw new Dnd5eEffectActionCompilerError('The D&D active effect plan source is invalid.')
    const plan = supportedRecurringPlan(action)
    if (!plan) return []
    const test = testPlan(action)
    const outcome = test ? null : supported(action)
    const firstEntry = action.compiledEffect.entries[0]
    const recurringOutcome = firstEntry && 'outcome' in firstEntry ? firstEntry.outcome : null
    const expectedOperation =
      test && recurringOutcome
        ? testProposalOperationKey(boundedTestOutcome(action.compiledEffect.entries[0]!))
        : outcome?.kind === 'HEAL'
          ? DND5E_HEAL_PROPOSAL_OPERATION_KEY
          : outcome?.kind === 'TEMPORARY_HIT_POINTS'
            ? DND5E_TEMPORARY_HIT_POINTS_PROPOSAL_OPERATION_KEY
            : outcome?.kind === 'DAMAGE'
              ? DND5E_DAMAGE_PROPOSAL_OPERATION_KEY
              : DND5E_CONDITION_APPLY_PROPOSAL_OPERATION_KEY
    if (
      published.definition.nodes.filter(
        (node) => node.id === plan.frozenGraphNodeId && node.operation.key === expectedOperation
      ).length !== 1
    )
      throw new Dnd5eEffectActionCompilerError(
        'The D&D active effect plan does not bind one exact frozen graph node.'
      )
    if (
      published.definition.sourceEntryBindings?.filter(
        (binding) =>
          binding.sourceEntryId === plan.compiledEntryId &&
          binding.nodeId === plan.frozenGraphNodeId
      ).length !== 1
    )
      throw new Dnd5eEffectActionCompilerError(
        'The D&D active effect plan does not bind one exact authored result block.'
      )
    return [plan]
  },
  bindFacts: ({
    actionMechanic,
    published,
    sourceDerivedFacts,
    targetActorId,
    targetDerivedFacts,
    currentHitPoints,
    temporaryHitPoints,
    maximumHitPoints,
    targetConditionIds,
    conditionImmunityIds,
    sceneContext,
    positionalFacts
  }) => {
    const resolvedDamageExpressionFacts: Record<string, string> = {}
    const actionOutcomes = (actionMechanic as { outcomes?: unknown }).outcomes
    if (Array.isArray(actionOutcomes)) {
      for (const outcome of actionOutcomes) {
        if (!outcome || typeof outcome !== 'object' || Array.isArray(outcome)) continue
        const row = outcome as Record<string, unknown>
        if (
          row.kind !== 'DAMAGE' ||
          typeof row.pathCode !== 'string' ||
          !isSpecializedPath(row.pathCode) ||
          typeof row.expression !== 'string'
        )
          continue
        const key = DND5E_RESOLVED_DAMAGE_EXPRESSION_FACT_KEYS[row.pathCode]
        if (resolvedDamageExpressionFacts[key] !== undefined)
          throw new Dnd5eEffectActionCompilerError(
            'D&D action has multiple resolved damage expressions for one path.'
          )
        resolvedDamageExpressionFacts[key] = row.expression
      }
    }
    const baseFacts = {
      [DND5E_TARGET_ACTOR_FACT_KEY]: targetActorId,
      [DND5E_TARGET_STATE_CHECKSUM_FACT_KEY]: checksumRuleDocument({
        targetActorId,
        currentHitPoints,
        temporaryHitPoints,
        maximumHitPoints,
        conditionIds: targetConditionIds
      }),
      ...conditionImmunityFacts(published.definition, conditionImmunityIds),
      ...resolvedDamageExpressionFacts
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
    if (typeof action.attackBonus === 'number' && Number.isSafeInteger(action.attackBonus)) {
      if (typeof armorClass !== 'number' || !Number.isSafeInteger(armorClass))
        throw new Dnd5eEffectActionCompilerError('D&D attack target defense is unavailable.')
      if (
        action.attackRollMode !== 'NORMAL' &&
        action.attackRollMode !== 'ADVANTAGE' &&
        action.attackRollMode !== 'DISADVANTAGE'
      )
        throw new Dnd5eEffectActionCompilerError('D&D attack roll mode is unavailable.')
      const contributors = (
        sourceContributorEvidence?.attacks?.[String(action.attackKind ?? 'MELEE')] ?? []
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
          [DND5E_ROLL_CONTRIBUTOR_CHECKSUM_FACT_KEY]: contributorChecksum
        },
        d20RollMode: rollMode,
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
      const savingThrowDefinitions = targetDerivedFacts.savingThrowDefinitions
      if (!Array.isArray(savingThrowDefinitions))
        throw new Dnd5eEffectActionCompilerError('D&D target saving throws are unavailable.')
      const targetSave = savingThrowDefinitions.find(
        (
          candidate
        ): candidate is {
          abilityDefinitionId?: unknown
          modifier?: unknown
          rollMode?: unknown
          contributors?: unknown
        } =>
          typeof candidate === 'object' &&
          candidate !== null &&
          (candidate as { abilityDefinitionId?: unknown }).abilityDefinitionId ===
            save.abilityDefinitionId
      )
      const modifier = targetSave?.modifier
      if (typeof modifier !== 'number' || !Number.isSafeInteger(modifier))
        throw new Dnd5eEffectActionCompilerError('D&D target save modifier is unavailable.')
      const rollMode = targetSave?.rollMode
      if (rollMode !== 'NORMAL' && rollMode !== 'ADVANTAGE' && rollMode !== 'DISADVANTAGE')
        throw new Dnd5eEffectActionCompilerError('D&D target save roll mode is invalid.')
      const contributors = (
        Array.isArray(targetSave?.contributors) ? targetSave.contributors : []
      ).map(
        ({
          sourceId,
          grantId,
          domainKey,
          influence
        }: {
          sourceId: string
          grantId: string
          domainKey: string
          influence: 'ADVANTAGE' | 'DISADVANTAGE'
        }) => ({
          sourceId,
          grantId,
          domainKey,
          influence
        })
      )
      const contributorChecksum = checksumRuleDocument(contributors)
      return {
        facts: {
          ...baseFacts,
          [DND5E_SAVE_MODIFIER_FACT_KEY]: modifier,
          [DND5E_SAVE_DC_FACT_KEY]: save.dc,
          [DND5E_ROLL_CONTRIBUTOR_CHECKSUM_FACT_KEY]: contributorChecksum
        },
        d20RollMode: rollMode,
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
    definition,
    targetActorId,
    targetDerivedFacts,
    targetConditionIds,
    currentHitPoints,
    temporaryHitPoints,
    maximumHitPoints,
    conditionImmunityIds
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
        (candidate as { abilityDefinitionId?: unknown }).abilityDefinitionId === abilityDefinitionId
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
    const contributorChecksum = checksumRuleDocument(contributors)
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
        [DND5E_ROLL_CONTRIBUTOR_CHECKSUM_FACT_KEY]: contributorChecksum
      },
      evidencePolicy: {
        requestNodeId,
        rollMode: matches[0]!.rollMode,
        contributors,
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
  interpretActiveEffect: ({ execution, definition, graph, ...target }) => {
    if (
      definition.authoredEffectId !== graph.source.definitionId ||
      definition.frozenGraph.source.checksum !== graph.source.checksum ||
      graph.source.gameSystemId !== DND5E_SYSTEM_ID
    )
      throw new Dnd5eEffectActionCompilerError('D&D active-effect execution source is invalid.')
    const published = publishedDefinitionForFrozenGraph(graph)
    const resolvedTest = testApplications({
      execution,
      published,
      ...target
    })
    if (resolvedTest) return resolvedTest
    return interpretDirect({ execution, ...target }, graph, { fullTrace: true })
  }
}
