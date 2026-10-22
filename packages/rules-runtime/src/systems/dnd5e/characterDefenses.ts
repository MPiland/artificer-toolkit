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

/** The sorted, non-empty authored content ids a defense is limited to; undefined for any source. */
function defenseSourceEffectIds(value: string[] | undefined): string[] | undefined {
  const ids = (value ?? []).filter((id) => id.trim() !== '')
  return ids.length > 0 ? [...new Set(ids)].sort() : undefined
}

export function evaluateDnd5eCharacterDefenses(
  input: CharacterRulePolicyInput,
  grantFold: CharacterGrantFoldOutput
): Pick<
  CharacterRulePolicyOutput,
  'defenses' | 'qualifiedDefenses' | 'conditionImmunityIds' | 'spellSchoolImmunityIds'
> {
  const defenses = new Map<string, CharacterRulePolicyOutput['defenses'][number]>()
  const qualifiedDefenses = new Map<
    string,
    CharacterRulePolicyOutput['qualifiedDefenses'][number]
  >()
  const conditionImmunityIds = new Set<string>()
  const spellSchoolImmunityIds = new Set<string>()
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
    if (modifier.valueDomainCode === 'SPELL_SCHOOL_IMMUNITY') {
      if (payload === undefined || !('magicSchoolId' in payload)) continue
      const schoolId = payload.magicSchoolId
      if (schoolId.trim() === '') continue
      if (adding) spellSchoolImmunityIds.add(schoolId)
      else spellSchoolImmunityIds.delete(schoolId)
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
    const bypassedBy = 'bypassedBy' in payload ? payload.bypassedBy : undefined
    if (bypassedBy?.length) {
      if (kind === 'VULNERABILITY') continue
      const key = `${kind}:${damageTypeId}:${[...bypassedBy].sort().join(',')}`
      if (adding) qualifiedDefenses.set(key, { kind, damageTypeId, bypassedBy })
      else qualifiedDefenses.delete(key)
      continue
    }
    const sourceEffectIds = defenseSourceEffectIds(
      'sourceEffectIds' in payload ? payload.sourceEffectIds : undefined
    )
    const key = `${kind}:${damageTypeId}:${(sourceEffectIds ?? []).join(',')}`
    if (adding)
      defenses.set(key, {
        kind,
        damageTypeId,
        ...(sourceEffectIds && { sourceEffectIds }),
        source: modifier.source
      })
    else defenses.delete(key)
  }
  for (const addition of input.defenseFacts.manualAdditions) {
    defenses.set(`${addition.kind}:${addition.damageTypeId}:`, {
      kind: addition.kind,
      damageTypeId: addition.damageTypeId,
      source: addition.source
    })
  }
  return {
    defenses: [...defenses.values()],
    qualifiedDefenses: [...qualifiedDefenses.values()],
    conditionImmunityIds: [...conditionImmunityIds],
    spellSchoolImmunityIds: [...spellSchoolImmunityIds]
  }
}
