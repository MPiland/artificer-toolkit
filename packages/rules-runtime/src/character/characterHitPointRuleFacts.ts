import type { CharacterRulePolicyInput } from '@artificer-toolkit/schema/api/characterRules'
import type { CharacterBuildSnapshot } from '@artificer-toolkit/shared/core'
import { resolveAbilityAlias } from '@artificer-toolkit/shared/character'

type HitPointFacts = NonNullable<CharacterRulePolicyInput['hitPointFacts']>
type HitPointAdjustment = Extract<
  NonNullable<CharacterBuildSnapshot['adjustments']>[number],
  { family: 'HIT_POINTS' }
>

function isConstitution(abilityId: string): boolean {
  return (resolveAbilityAlias(abilityId) ?? abilityId) === 'CONSTITUTION'
}

function manualSource(adjustmentId: string) {
  return { kind: 'MANUAL_ADJUSTMENT' as const, adjustmentId }
}

export function buildCharacterHitPointRuleFacts(
  snapshot: CharacterBuildSnapshot,
  progression: HitPointFacts['progression'] = null
): Pick<CharacterRulePolicyInput, 'hitPointFacts'> {
  const abilityIds = Object.keys(snapshot.abilities)
  const constitutionAbilityIndex = abilityIds.findIndex(isConstitution)
  const adjustments = snapshot.adjustments ?? []
  const maximumModifier = adjustments.find(
    (adjustment): adjustment is HitPointAdjustment & { field: 'MAXIMUM_MODIFIER'; value: number } =>
      adjustment.family === 'HIT_POINTS' &&
      adjustment.field === 'MAXIMUM_MODIFIER' &&
      typeof adjustment.value === 'number'
  )
  const maximumOverride = adjustments.find(
    (adjustment): adjustment is HitPointAdjustment & { field: 'MAXIMUM_OVERRIDE'; value: number } =>
      adjustment.family === 'HIT_POINTS' &&
      adjustment.field === 'MAXIMUM_OVERRIDE' &&
      typeof adjustment.value === 'number'
  )
  const toManualFact = (
    adjustment: HitPointAdjustment | undefined
  ): HitPointFacts['manualMaximumModifier'] =>
    adjustment
      ? { sourceId: adjustment.id, source: manualSource(adjustment.id), value: adjustment.value }
      : null

  return {
    hitPointFacts: {
      rows: snapshot.hitpoints.map((row) => ({ ...row })),
      constitutionAbilityId: abilityIds[constitutionAbilityIndex] ?? 'CONSTITUTION',
      constitutionAbilityIndex: constitutionAbilityIndex < 0 ? null : constitutionAbilityIndex,
      progression,
      manualMaximumModifier: toManualFact(maximumModifier),
      manualMaximumOverride: toManualFact(maximumOverride)
    }
  }
}
