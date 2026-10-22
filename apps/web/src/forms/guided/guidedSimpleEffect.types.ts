export type GuidedSpellIntent = 'DAMAGE' | 'CONDITION' | 'HEALING' | 'MOVEMENT'
type GuidedSpellTarget = 'SELF' | 'CREATURE'
type GuidedConditionDuration = 'INSTANTANEOUS' | 'ROUND' | 'MINUTE' | 'UNTIL_DISPELLED'

export type GuidedSpellDraft = {
  intent: GuidedSpellIntent
  target: GuidedSpellTarget
  targetDistance: number
  saveAbilityDefinitionId: string
  damageDice: string
  damageTypeId: string
  conditionTypeId: string
  conditionDuration: GuidedConditionDuration
  healingDice: string
  temporaryHealing: boolean
  movementDirection: 'AWAY_FROM_SOURCE' | 'TOWARD_SOURCE'
  movementAmount: number
}

export type GuidedEffectIds = {
  outcomeId: string
  savingThrowId: string
  durationId: string
}

export const GUIDED_DURATION_OPTIONS: readonly {
  value: GuidedConditionDuration
  label: string
}[] = [
  { value: 'ROUND', label: '1 round' },
  { value: 'MINUTE', label: '1 minute' },
  { value: 'INSTANTANEOUS', label: 'Instantaneous' },
  { value: 'UNTIL_DISPELLED', label: 'Until dispelled' }
]

export function createGuidedSpellDraft(
  intent: GuidedSpellIntent,
  options: { damageTypeId?: string; conditionTypeId?: string }
): GuidedSpellDraft {
  return {
    intent,
    target: 'CREATURE',
    targetDistance: 60,
    saveAbilityDefinitionId: '',
    damageDice: '1d6',
    damageTypeId: options.damageTypeId ?? '',
    conditionTypeId: options.conditionTypeId ?? '',
    conditionDuration: 'ROUND',
    healingDice: '1d6',
    temporaryHealing: false,
    movementDirection: 'AWAY_FROM_SOURCE',
    movementAmount: 5
  }
}

export function createGuidedEffectIds(): GuidedEffectIds {
  return {
    outcomeId: crypto.randomUUID(),
    savingThrowId: crypto.randomUUID(),
    durationId: crypto.randomUUID()
  }
}
