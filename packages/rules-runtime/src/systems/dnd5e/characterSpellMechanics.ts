import type {
  CharacterRulePolicyInput,
  CharacterRulePolicyOutput
} from '@artificer-toolkit/schema/api/characterRules'

type DerivedStats = Omit<CharacterRulePolicyOutput['derivedStats'], 'armorClass' | 'maxHitPoints'>
type SpellMechanics = CharacterRulePolicyOutput['spellMechanics']
type Source = SpellMechanics[number]['source']
type NumericCalculation = NonNullable<SpellMechanics[number]['calculations']['attackBonus']>
type NumericContribution = NumericCalculation['contributions'][number]

function sameSource(left: Source, right: Source): boolean {
  return (
    left.spellId === right.spellId &&
    left.sourceKind === right.sourceKind &&
    left.sourceInstanceId === right.sourceInstanceId
  )
}

function numericCalculation(
  base: number,
  contributions: readonly NumericContribution[],
  override: NumericCalculation['override']
): NumericCalculation {
  return {
    base,
    effective:
      override === null
        ? base +
          contributions
            .filter((contribution) => contribution.state === 'APPLIED')
            .reduce((sum, contribution) => sum + contribution.value, 0)
        : override.value,
    contributions: contributions.map((contribution) => ({
      ...contribution,
      state: override === null ? contribution.state : 'SUPPRESSED',
      reasonCode: override === null ? contribution.reasonCode : 'SUPPRESSED_BY_OVERRIDE'
    })),
    override
  }
}

function manualContribution(
  adjustment: CharacterRulePolicyInput['spellMechanicsFacts']['adjustments'][number]
): NumericContribution {
  return {
    sourceId: adjustment.id,
    source: { kind: 'MANUAL_ADJUSTMENT', adjustmentId: adjustment.id },
    value: adjustment.value,
    state: 'APPLIED',
    reasonCode: 'APPLIED'
  }
}

export function evaluateDnd5eCharacterSpellMechanics(
  input: CharacterRulePolicyInput,
  spellAccess: CharacterRulePolicyOutput['spellAccess'],
  derivedStats: DerivedStats
): SpellMechanics {
  const sourceCandidates: Array<{ readonly source: Source; readonly sequence: number }> = [
    ...input.spellMechanicsFacts.snapshotSources.map((source) => ({
      source: {
        spellId: source.spellId,
        sourceKind: source.sourceKind,
        sourceInstanceId: source.sourceInstanceId
      },
      sequence: source.sequence
    })),
    ...spellAccess.map((access) => ({
      source: {
        spellId: access.spellId,
        sourceKind: 'FEATURE' as const,
        sourceInstanceId: access.sourceInstanceId
      },
      sequence: 1000 + access.sequence
    })),
    ...input.spellMechanicsFacts.adjustments.map((adjustment) => ({
      source: adjustment.source,
      sequence: 2000 + adjustment.sequence
    }))
  ]
  const sources = sourceCandidates.filter(
    (source) =>
      !sourceCandidates.some(
        (earlier) => sameSource(earlier.source, source.source) && earlier.sequence < source.sequence
      )
  )
  return sources.map(({ source }) => {
    const access = spellAccess.find(
      (entry) =>
        entry.spellId === source.spellId &&
        source.sourceKind === 'FEATURE' &&
        entry.sourceInstanceId === source.sourceInstanceId
    )
    const adjustments = input.spellMechanicsFacts.adjustments.filter((adjustment) =>
      sameSource(adjustment.source, source)
    )
    const attackBonusAdjustment = adjustments.find(
      (adjustment) => adjustment.field === 'ATTACK_BONUS'
    )
    const attackOverrideAdjustment = adjustments.find(
      (adjustment) => adjustment.field === 'ATTACK_OVERRIDE'
    )
    const saveBonusAdjustment = adjustments.find((adjustment) => adjustment.field === 'DC_BONUS')
    const saveOverrideAdjustment = adjustments.find(
      (adjustment) => adjustment.field === 'DC_OVERRIDE'
    )
    const damageAdjustment = adjustments.find((adjustment) => adjustment.field === 'DAMAGE_BONUS')
    const ability =
      access?.castingAbility === null || access?.castingAbility === undefined
        ? undefined
        : derivedStats.abilities.find((entry) => entry.abilityId === access.castingAbility)
    const attackBase =
      ability === undefined
        ? (derivedStats.spellcasting?.attackBonus.base ?? null)
        : derivedStats.proficiencyBonus.effective + ability.modifier.effective
    const saveBase =
      ability === undefined
        ? (derivedStats.spellcasting?.saveDc.base ?? null)
        : 8 + derivedStats.proficiencyBonus.effective + ability.modifier.effective
    const attackOverride =
      attackOverrideAdjustment === undefined
        ? null
        : {
            sourceId: attackOverrideAdjustment.id,
            source: {
              kind: 'MANUAL_ADJUSTMENT' as const,
              adjustmentId: attackOverrideAdjustment.id
            },
            value: attackOverrideAdjustment.value
          }
    const saveOverride =
      saveOverrideAdjustment === undefined
        ? null
        : {
            sourceId: saveOverrideAdjustment.id,
            source: { kind: 'MANUAL_ADJUSTMENT' as const, adjustmentId: saveOverrideAdjustment.id },
            value: saveOverrideAdjustment.value
          }
    const attackBonus =
      attackBase === null
        ? null
        : numericCalculation(
            attackBase,
            [
              ...(derivedStats.spellcasting?.attackBonus.contributions ?? []),
              ...(attackBonusAdjustment === undefined
                ? []
                : [manualContribution(attackBonusAdjustment)])
            ],
            attackOverride
          )
    const saveDC =
      saveBase === null
        ? null
        : numericCalculation(
            saveBase,
            [
              ...(derivedStats.spellcasting?.saveDc.contributions ?? []),
              ...(saveBonusAdjustment === undefined
                ? []
                : [manualContribution(saveBonusAdjustment)])
            ],
            saveOverride
          )
    const damageBonus = damageAdjustment === undefined ? null : manualContribution(damageAdjustment)
    const damageCalculation = {
      base: 0,
      effective: damageAdjustment?.value ?? 0,
      contributions: damageBonus === null ? [] : [damageBonus],
      override: null
    }
    return {
      source,
      ...(attackBonus === null ? {} : { attackBonus: attackBonus.effective }),
      ...(saveDC === null ? {} : { saveDC: saveDC.effective }),
      damageBonus: damageCalculation.effective,
      calculations: {
        ...(attackBonus === null ? {} : { attackBonus }),
        ...(saveDC === null ? {} : { saveDC }),
        damageBonus: damageCalculation
      }
    }
  })
}
