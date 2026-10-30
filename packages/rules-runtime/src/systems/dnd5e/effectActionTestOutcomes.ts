import { unsupported, uuid, multipliedDamageAmount, type Outcome } from './effectActionContracts.js'
import type {
  HealDamageDealtPayload,
  HitPointMaximumReductionAuthored
} from '@artificer-toolkit/shared/authored'
import type { CompiledEffectGroup, CompiledDamageEffect } from '@artificer-toolkit/shared/compilers'
import {
  boundedOutcome,
  damageMultiplier,
  validateDamageBonuses
} from './effectActionOutcomeNodes.js'
import type { Dnd5eAuthoredOutcome } from './effectActionOutcomes.js'
import {
  parseBoundedDiceConfiguration,
  type Dnd5eEffectScalingFacts
} from './effectActionScalingFacts.js'
import { hitPointMaximumReductionRecoveryTagsSchema } from '@artificer-toolkit/schema/effects/hitPointMaximumReduction'

export type SpecializedOutcome =
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
  | ({ kind: 'HIT_POINT_MAXIMUM_REDUCTION' } & Pick<
      HitPointMaximumReductionAuthored,
      'amountSource' | 'recoveryTags'
    >)
  | ({ kind: 'DAMAGE_DERIVED_HEAL' } & Pick<
      HealDamageDealtPayload,
      'damageOutcomeId' | 'fraction' | 'recipient'
    >)

/** An entry that outlasts its use: a lifecycle, or a duration other than instantaneous. */
export function hasLifecycleOverride(entry: {
  lifecycle?: unknown
  duration?: { durationKind: string }
}): boolean {
  return Boolean(
    entry.lifecycle || (entry.duration && entry.duration.durationKind !== 'INSTANTANEOUS')
  )
}

export function boundedTestOutcome(entry: CompiledEffectGroup['entries'][number]): Outcome {
  if (!('outcome' in entry)) unsupported('D&D test actions require direct authored outcomes.')
  // An instant kill is admitted as a hit-point tier's result, behind a reduced-to-0 gate, or on the
  // action's own failed save ("succeed on a saving throw or die"); never on a hit alone.
  const killAdmitted = Boolean(
    ('hitPointTier' in entry && entry.hitPointTier) ||
    ('gate' in entry && entry.gate?.kind === 'REDUCED_TO_ZERO_BY') ||
    entry.pathCode === 'ON_SAVE_FAIL'
  )
  return boundedOutcome(entry.outcome, killAdmitted)
}

/**
 * The TEST phase's view of an outcome: a fixed amount its bonuses size is known only by kind, since
 * the source's resolved expression that states it is bound in the outcome phase.
 */
export type TestPhaseOutcome =
  | SpecializedOutcome
  | { kind: 'RESOLVED_DAMAGE'; damageTypeId: string }

/** The sibling damage outcome an outcome sized by the damage dealt reads, if it is one. */
export function damageSourceOutcomeId(outcome: TestPhaseOutcome) {
  if (outcome.kind === 'HIT_POINT_MAXIMUM_REDUCTION') return outcome.amountSource.damageOutcomeId
  return outcome.kind === 'DAMAGE_DERIVED_HEAL' ? outcome.damageOutcomeId : undefined
}

/**
 * TEST/OUTCOME actions select exactly one authored result group.  The TEST
 * phase must therefore reject every reachable result that the bounded
 * OUTCOME compiler cannot construct, rather than quietly retaining the old
 * all-branches graph.
 */
export function specializedTestOutcome(
  entry: CompiledEffectGroup['entries'][number],
  /** The source's bound facts, which only the outcome phase has. */
  facts: Pick<Dnd5eEffectScalingFacts, 'resolvedDamageOutcomeExpressions'>
): SpecializedOutcome
export function specializedTestOutcome(
  entry: CompiledEffectGroup['entries'][number]
): TestPhaseOutcome
export function specializedTestOutcome(
  entry: CompiledEffectGroup['entries'][number],
  facts?: Pick<Dnd5eEffectScalingFacts, 'resolvedDamageOutcomeExpressions'>
): TestPhaseOutcome {
  if (!('outcome' in entry)) unsupported('D&D test actions require direct authored outcomes.')
  const outcome = entry.outcome
  if (outcome.effectKind === 'DAMAGE' && outcome.valueKind === 'FIXED' && outcome.bonuses?.length) {
    // "Damage equal to your Charisma modifier": the bonuses read the source, so the amount waits
    // for its resolved expression.
    validateDamageBonuses(outcome.bonuses)
    if (
      outcome.scalingKind !== 'NONE' ||
      !Number.isSafeInteger(outcome.amount) ||
      outcome.amount < 0
    )
      unsupported('D&D fixed damage with bonuses must be one unscaled whole amount.')
    uuid(outcome.damageTypeId, 'D&D damage type identity')
    if (!facts) return { kind: 'RESOLVED_DAMAGE', damageTypeId: outcome.damageTypeId }
    // The source states the amount already floored at 0, as a dice total is; 0 deals no damage.
    const resolved = facts.resolvedDamageOutcomeExpressions[entry.entryId]
    const amount = resolved !== undefined && /^\d+$/.test(resolved) ? Number(resolved) : -1
    if (!Number.isSafeInteger(amount) || amount < 0)
      unsupported('D&D resolved fixed damage must be a whole amount of at least 0.')
    return {
      kind: 'DAMAGE',
      amount: multipliedDamageAmount(amount, damageMultiplier(outcome)),
      damageTypeId: outcome.damageTypeId
    }
  }
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
  if (outcome.effectKind === 'HIT_POINT_MAXIMUM_REDUCTION') {
    uuid(outcome.amountSource.damageOutcomeId, 'D&D hit point maximum reduction damage identity')
    if (!hitPointMaximumReductionRecoveryTagsSchema.safeParse(outcome.recoveryTags).success)
      unsupported('D&D hit point maximum reduction recovery is not supported.')
    return {
      kind: 'HIT_POINT_MAXIMUM_REDUCTION',
      amountSource: outcome.amountSource,
      recoveryTags: outcome.recoveryTags
    }
  }
  if (outcome.effectKind === 'HEAL' && outcome.valueKind === 'DAMAGE_DEALT') {
    uuid(outcome.damageOutcomeId, 'D&D damage-derived heal damage identity')
    const { numerator, denominator } = outcome.fraction
    if (
      !Number.isSafeInteger(numerator) ||
      !Number.isSafeInteger(denominator) ||
      numerator < 1 ||
      denominator < 1 ||
      outcome.bonuses?.length ||
      outcome.temporary
    )
      unsupported('D&D damage-derived healing takes only a whole positive fraction of the damage.')
    return {
      kind: 'DAMAGE_DERIVED_HEAL',
      damageOutcomeId: outcome.damageOutcomeId,
      fraction: outcome.fraction,
      recipient: outcome.recipient
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

export function positiveFixedAmount(
  outcome: Extract<Dnd5eAuthoredOutcome, { effectKind: 'HEAL' | 'DAMAGE' }>
): number {
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
  return outcome.amount
}

export function validateHealBonuses(value: unknown): void {
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
