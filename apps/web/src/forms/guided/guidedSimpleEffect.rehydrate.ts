import type {
  DurationAuthored,
  EffectAuthored,
  OutcomeAuthored
} from '@artificer-toolkit/shared/authored'
import { effectDtoSchema } from '@artificer-toolkit/schema/effects'
import type {
  GuidedEffectIds,
  GuidedSpellDraft,
  GuidedSpellIntent
} from './guidedSimpleEffect.types'

type RehydratedGuidedSpell = {
  effect: EffectAuthored
  draft: GuidedSpellDraft
  ids: GuidedEffectIds
}

export function rehydrateGuidedSpell(
  effects: readonly unknown[] | undefined,
  fallbackIds: GuidedEffectIds
): RehydratedGuidedSpell | null {
  const effect = readGuidedSpellEffect(effects)
  if (!effect) return null

  const path = effect.paths[0]
  if (!path || path.selectionKind !== 'FIXED') return null

  const outcome = path.resultBlock.outcomes[0]
  if (!outcome) return null

  const intent = toIntent(outcome.effectKind)
  if (!intent) return null

  const target =
    effect.invocation.targeting?.selectionKind === 'SELF' ||
    effect.invocation.range.rangeKind === 'SELF'
      ? 'SELF'
      : 'CREATURE'
  const saveAbilityDefinitionId =
    effect.invocation.triggerCode === 'SAVING_THROW'
      ? effect.invocation.savingThrow.abilityDefinitionId
      : ''
  const damageDice =
    outcome.effectKind === 'DAMAGE' &&
    outcome.valueKind === 'DICE' &&
    outcome.scalingKind === 'NONE'
      ? outcome.diceConfig
      : '1d6'
  const conditionTypeId = outcome.effectKind === 'CONDITION' ? outcome.conditionId : ''
  const conditionDuration =
    path.resultBlock.duration?.durationKind === 'INSTANTANEOUS' ||
    path.resultBlock.duration?.durationKind === 'MINUTE' ||
    path.resultBlock.duration?.durationKind === 'UNTIL_DISPELLED'
      ? path.resultBlock.duration.durationKind
      : 'ROUND'
  const healingDice =
    outcome.effectKind === 'HEAL' && outcome.valueKind === 'DICE' && outcome.scalingKind === 'NONE'
      ? outcome.diceConfig
      : '1d6'
  const temporaryHealing = outcome.effectKind === 'HEAL' ? (outcome.temporary ?? false) : false
  const movementDirection =
    outcome.effectKind === 'FORCED_MOVEMENT'
      ? outcome.direction === 'TOWARD_SOURCE'
        ? 'TOWARD_SOURCE'
        : 'AWAY_FROM_SOURCE'
      : 'AWAY_FROM_SOURCE'
  const movementAmount =
    outcome.effectKind === 'FORCED_MOVEMENT' && outcome.distanceMode === 'EXACT'
      ? outcome.amount
      : 5
  const ids = {
    outcomeId: outcome.id,
    savingThrowId:
      effect.invocation.triggerCode === 'SAVING_THROW'
        ? effect.invocation.savingThrow.id
        : fallbackIds.savingThrowId,
    durationId: path.resultBlock.duration?.id ?? fallbackIds.durationId
  }

  return {
    effect,
    draft: {
      intent,
      target,
      targetDistance:
        effect.invocation.range.rangeKind === 'DISTANCE' ? effect.invocation.range.amount : 60,
      saveAbilityDefinitionId,
      damageDice,
      damageTypeId: outcome.effectKind === 'DAMAGE' ? (outcome.damageTypeId ?? '') : '',
      conditionTypeId,
      conditionDuration,
      healingDice,
      temporaryHealing,
      movementDirection,
      movementAmount
    },
    ids
  }
}

function readGuidedSpellEffect(effects: readonly unknown[] | undefined): EffectAuthored | null {
  if (!effects || effects.length !== 1) return null

  const parsed = effectDtoSchema.safeParse(effects[0])
  if (!parsed.success) return null

  return isGuidedSpellEffect(parsed.data) ? parsed.data : null
}

function isGuidedSpellEffect(effect: EffectAuthored): boolean {
  if (!hasOnlyKeys(effect, ['id', 'order', 'invocation', 'paths'])) return false

  const invocation = effect.invocation
  if (
    !hasOnlyKeys(invocation, [
      'kind',
      'triggerCode',
      'activation',
      'range',
      'targeting',
      'savingThrow'
    ])
  ) {
    return false
  }
  if (invocation.kind !== 'ACTION') return false
  if (!hasActionActivation(invocation.activation)) return false
  if ('shape' in invocation) return false

  const rangeKind = invocation.range.rangeKind
  if (rangeKind === 'SELF') {
    if (
      !hasOnlyKeys(invocation.range, ['id', 'rangeKind']) ||
      !invocation.targeting ||
      !hasOnlyKeys(invocation.targeting, ['selectionKind']) ||
      invocation.targeting.selectionKind !== 'SELF'
    ) {
      return false
    }
  } else if (
    rangeKind !== 'DISTANCE' ||
    !hasOnlyKeys(invocation.range, ['id', 'rangeKind', 'amount', 'unit']) ||
    !Number.isFinite(invocation.range.amount) ||
    invocation.range.amount <= 0 ||
    invocation.range.unit !== 'FEET' ||
    !invocation.targeting ||
    !hasOnlyKeys(invocation.targeting, ['selectionKind', 'dispositionKind', 'maxTargets']) ||
    invocation.targeting.selectionKind !== 'CHOSEN_CREATURES' ||
    invocation.targeting.dispositionKind !== 'ANY' ||
    invocation.targeting.maxTargets !== 1
  ) {
    return false
  }

  if (invocation.triggerCode === 'SAVING_THROW') {
    if (
      !invocation.savingThrow ||
      !hasOnlyKeys(invocation.savingThrow, ['id', 'dcMethod', 'ability']) ||
      invocation.savingThrow.dcMethod !== 'SOURCE_SAVE_DC'
    ) {
      return false
    }
  } else if (invocation.triggerCode !== 'ACTIVATED' || 'savingThrow' in invocation) {
    return false
  }

  if (effect.paths.length !== 1) return false
  const path = effect.paths[0]
  if (
    !path ||
    !hasOnlyKeys(path, ['id', 'order', 'pathCode', 'groupType', 'selectionKind', 'resultBlock']) ||
    path.pathCode !== 'ON_USE' ||
    path.groupType !== 'SINGLE' ||
    path.selectionKind !== 'FIXED' ||
    path.resultBlock.resultKind !== 'SINGLE' ||
    !hasOnlyKeys(path.resultBlock, ['id', 'resultKind', 'duration', 'lifecycle', 'outcomes']) ||
    'lifecycle' in path.resultBlock ||
    path.resultBlock.outcomes.length !== 1
  ) {
    return false
  }

  const outcome = path.resultBlock.outcomes[0]
  if (!outcome || !hasSupportedGuidedOutcome(outcome)) return false
  if (outcome.effectKind === 'HEAL' && invocation.triggerCode === 'SAVING_THROW') return false
  if (outcome.effectKind === 'CONDITION') {
    return Boolean(path.resultBlock.duration && isGuidedDuration(path.resultBlock.duration))
  }

  return !path.resultBlock.duration
}

function toIntent(effectKind: string): GuidedSpellIntent | null {
  switch (effectKind) {
    case 'DAMAGE':
      return 'DAMAGE'
    case 'CONDITION':
      return 'CONDITION'
    case 'HEAL':
      return 'HEALING'
    case 'FORCED_MOVEMENT':
      return 'MOVEMENT'
    default:
      return null
  }
}

function hasSupportedGuidedOutcome(outcome: OutcomeAuthored): boolean {
  switch (outcome.effectKind) {
    case 'DAMAGE':
      return (
        hasOnlyKeys(outcome, [
          'id',
          'effectKind',
          'damageTypeId',
          'diceConfig',
          'valueKind',
          'scalingKind'
        ]) &&
        isNonEmptyString(outcome.damageTypeId) &&
        outcome.valueKind === 'DICE' &&
        outcome.scalingKind === 'NONE' &&
        isNonEmptyString(outcome.diceConfig)
      )
    case 'CONDITION':
      return (
        hasOnlyKeys(outcome, ['id', 'effectKind', 'conditionId']) &&
        isNonEmptyString(outcome.conditionId)
      )
    case 'HEAL':
      return (
        hasOnlyKeys(outcome, [
          'id',
          'effectKind',
          'diceConfig',
          'valueKind',
          'scalingKind',
          'temporary'
        ]) &&
        outcome.valueKind === 'DICE' &&
        outcome.scalingKind === 'NONE' &&
        isNonEmptyString(outcome.diceConfig) &&
        typeof outcome.temporary === 'boolean'
      )
    case 'FORCED_MOVEMENT':
      return (
        hasOnlyKeys(outcome, [
          'id',
          'effectKind',
          'direction',
          'actionEconomy',
          'distanceMode',
          'amount',
          'unit'
        ]) &&
        (outcome.direction === 'AWAY_FROM_SOURCE' || outcome.direction === 'TOWARD_SOURCE') &&
        outcome.actionEconomy === 'NONE' &&
        outcome.distanceMode === 'EXACT' &&
        outcome.unit === 'FEET' &&
        Number.isFinite(outcome.amount) &&
        outcome.amount > 0
      )
    default:
      return false
  }
}

function isGuidedDuration(duration: DurationAuthored) {
  if (!hasOnlyKeys(duration, ['id', 'durationKind', 'amount'])) return false

  if (duration.durationKind === 'INSTANTANEOUS' || duration.durationKind === 'UNTIL_DISPELLED') {
    return !('amount' in duration)
  }

  return (
    (duration.durationKind === 'ROUND' || duration.durationKind === 'MINUTE') &&
    duration.amount === 1 &&
    !('scaling' in duration)
  )
}

function hasActionActivation(value: unknown): value is { code: 'ACTION'; amount: number } {
  return (
    typeof value === 'object' &&
    value !== null &&
    hasOnlyKeys(value, ['code', 'amount']) &&
    'code' in value &&
    value.code === 'ACTION' &&
    'amount' in value &&
    value.amount === 1
  )
}

function hasOnlyKeys(value: object, allowed: readonly string[]): boolean {
  return Object.keys(value).every((key) => allowed.includes(key))
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}
