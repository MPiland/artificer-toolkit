import type { SavingThrowDcFacts } from '../../savingThrowCapability.js'

type SavingThrowDcBonus =
  | { bonusKind: 'STATIC_BONUS'; amount: number }
  | { bonusKind: 'PROFICIENCY_BONUS' }
  | { bonusKind: 'ABILITY_MODIFIER'; abilityDefinitionId: string }

/**
 * The DC of an authored saving throw: the owner's spell save DC, a fixed DC, or `baseDc` plus its bonuses.
 * Null when the owner lacks something the DC reads.
 */
export function resolveSavingThrowDc(
  savingThrow: {
    dcMethod: string
    baseDc?: number | null
    bonuses?: readonly SavingThrowDcBonus[]
  },
  facts: SavingThrowDcFacts
): number | null {
  if (savingThrow.dcMethod === 'SOURCE_SAVE_DC') return facts.spellSaveDc
  if (savingThrow.dcMethod === 'FIXED_DC') return savingThrow.baseDc ?? null
  let dc = savingThrow.baseDc ?? 0
  for (const bonus of savingThrow.bonuses ?? []) {
    const amount =
      bonus.bonusKind === 'STATIC_BONUS'
        ? bonus.amount
        : bonus.bonusKind === 'PROFICIENCY_BONUS'
          ? facts.proficiencyBonus
          : facts.abilityModifier(bonus.abilityDefinitionId)
    if (amount === null) return null
    dc += amount
  }
  return dc
}
