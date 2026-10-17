import type { CharacterGrantFoldOutput } from '@artificer-toolkit/schema/api/characterGrantFoldRules'
import type {
  CharacterRulePolicyInput,
  CharacterRulePolicyOutput
} from '@artificer-toolkit/schema/api/characterRules'

import {
  DND5E_CHARACTER_WIDE_TARGET,
  dnd5eAcceptedModifierApplicability,
  dnd5eModifierApplies
} from './modifierApplicability.js'

export function evaluateDnd5eCharacterDefenses(
  input: CharacterRulePolicyInput,
  grantFold: CharacterGrantFoldOutput
): Pick<CharacterRulePolicyOutput, 'defenses' | 'conditionImmunityIds'> {
  const defenses = new Map<string, CharacterRulePolicyOutput['defenses'][number]>()
  const conditionImmunityIds = new Set<string>()
  for (const modifier of grantFold.modifiers) {
    if (
      (modifier.modifierKind !== 'ADD_OPTION' && modifier.modifierKind !== 'REMOVE_OPTION') ||
      !dnd5eModifierApplies(
        dnd5eAcceptedModifierApplicability(modifier),
        DND5E_CHARACTER_WIDE_TARGET
      )
    )
      continue
    const { payload } = modifier
    const adding = modifier.modifierKind === 'ADD_OPTION'
    if (modifier.valueDomainCode === 'CONDITION_IMMUNITY') {
      if (payload === undefined || !('conditionTypeId' in payload)) continue
      const conditionId = payload.conditionTypeId
      if (conditionId.trim() === '') continue
      if (adding) conditionImmunityIds.add(conditionId)
      else conditionImmunityIds.delete(conditionId)
      continue
    }
    const kind =
      modifier.valueDomainCode === 'DAMAGE_RESISTANCE'
        ? 'RESISTANCE'
        : modifier.valueDomainCode === 'DAMAGE_IMMUNITY'
          ? 'IMMUNITY'
          : modifier.valueDomainCode === 'DAMAGE_VULNERABILITY'
            ? 'VULNERABILITY'
            : null
    if (kind === null || payload === undefined || !('damageTypeId' in payload)) continue
    const { damageTypeId } = payload
    if (damageTypeId.trim() === '') continue
    const key = `${kind}:${damageTypeId}`
    if (adding) defenses.set(key, { kind, damageTypeId, source: modifier.source })
    else defenses.delete(key)
  }
  for (const addition of input.defenseFacts.manualAdditions) {
    defenses.set(`${addition.kind}:${addition.damageTypeId}`, {
      kind: addition.kind,
      damageTypeId: addition.damageTypeId,
      source: addition.source
    })
  }
  return { defenses: [...defenses.values()], conditionImmunityIds: [...conditionImmunityIds] }
}
