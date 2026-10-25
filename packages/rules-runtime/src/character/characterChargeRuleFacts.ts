import type { CharacterRulePolicyInput } from '@artificer-toolkit/schema/api/characterRules'
import type { CharacterChargeSourceLevel } from '@artificer-toolkit/schema/api/characterResourceRules'
import type { CompiledCharge } from '@artificer-toolkit/shared/compilers'

type ChargeCalculation = CharacterRulePolicyInput['chargeCalculations'][number]
type ChargeBase = ChargeCalculation['base']

function baseFacts(charge: CompiledCharge, context: CharacterChargeRuleFactContext): ChargeBase {
  if (charge.scalingKind === 'PER_LEVEL') {
    return {
      kind: 'PER_LEVEL',
      sourceLevel: context.sourceLevel ?? { kind: 'CHARACTER_LEVEL' },
      levels: charge.levels.map(({ id, level, amount }) => ({
        sourceId: id,
        level,
        amount
      }))
    }
  }

  const common = {
    multiplier: charge.limitKind === 'FIXED_AMOUNT' ? null : (charge.multiplier ?? null),
    minimum: charge.limitKind === 'FIXED_AMOUNT' ? null : (charge.min ?? null),
    maximum: charge.limitKind === 'FIXED_AMOUNT' ? null : (charge.max ?? null)
  }

  switch (charge.limitKind) {
    case 'ABILITY_MODIFIER': {
      const abilityCharge = charge as CompiledCharge & { ability: string }
      return {
        ...common,
        kind: charge.limitKind,
        abilityId: abilityCharge.ability
      }
    }
    case 'CHARACTER_LEVEL':
      return {
        ...common,
        kind: charge.limitKind
      }
    case 'CLASS_LEVEL': {
      const classCharge = charge as CompiledCharge & { classId: string }
      return {
        ...common,
        kind: charge.limitKind,
        classId: classCharge.classId
      }
    }
    case 'PARENT_CLASS_LEVEL':
      return {
        ...common,
        kind: charge.limitKind,
        sourceLevel: context.sourceLevel ?? { kind: 'CHARACTER_LEVEL' }
      }
    case 'SPELL_CAST_LEVEL':
      return {
        ...common,
        kind: charge.limitKind,
        spellCastLevel: context.spellCastLevel ?? null
      }
    case 'FIXED_AMOUNT':
      return { kind: charge.limitKind, amount: charge.amount }
  }
}

type CharacterChargeRuleFactContext = {
  sourceLevel?: CharacterChargeSourceLevel
  spellCastLevel?: number | null
}

function bonusFacts(charge: CompiledCharge): ChargeCalculation['bonuses'] {
  return (charge.bonuses ?? []).map((bonus, index) => {
    const common = {
      sourceId: `${charge.id}:bonus:${bonus.order}:${index}`,
      multiplier: bonus.multiplier ?? null,
      minimum: bonus.min ?? null,
      maximum: bonus.max ?? null
    }

    switch (bonus.bonusKind) {
      case 'ABILITY_MODIFIER':
        return { ...common, kind: bonus.bonusKind, abilityId: bonus.ability }
      case 'SKILL_BONUS':
        return { ...common, kind: bonus.bonusKind, skillId: bonus.skillId }
      case 'PROFICIENCY_BONUS':
        return { ...common, kind: bonus.bonusKind }
    }
  })
}

export function buildCharacterChargeRuleFact(
  charge: CompiledCharge,
  calculationId: string,
  context: CharacterChargeRuleFactContext = {}
): ChargeCalculation {
  return {
    calculationId,
    sourceId: charge.id,
    base: baseFacts(charge, context),
    bonuses: bonusFacts(charge)
  }
}
