import type { ImportIssueDto } from '@artificer-toolkit/schema/api/imports'
import {
  meleeReachWeaponEffects,
  meleeVersatileWeaponEffects,
  meleeWeaponEffects,
  rangedWeaponEffects,
  thrownVersatileWeaponEffects,
  thrownWeaponEffects,
  type EquipmentChildId,
  type EquipmentEffectAuthored
} from '@artificer-toolkit/shared/authored'

import type { ExternalCustomContent, ImportedWeaponAttack } from './importParsers.js'

export interface ImportedVocabularyEntry {
  id: string
  code: string
  label: string
}

/** Finds the System vocabulary entry a source names by code or label, ignoring case. */
export function resolveImportedVocabularyEntry(
  vocabulary: readonly ImportedVocabularyEntry[],
  name: string
): ImportedVocabularyEntry | undefined {
  const wanted = name.trim().toLowerCase()
  return vocabulary.find(
    ({ code, label }) => code.toLowerCase() === wanted || label.toLowerCase() === wanted
  )
}

/**
 * The attack effects the seeded SRD weapon with the same shape carries. A weapon that is both
 * versatile and reach, or a thrown weapon with reach, takes the standard 5 ft melee range.
 */
function weaponAttackEffects(
  attack: ImportedWeaponAttack,
  damageTypeId: string,
  childId: EquipmentChildId
): EquipmentEffectAuthored[] {
  const { dice, versatileDice, grip, ranged, meleeReachFeet } = attack
  const range = ranged && {
    normalFeet: ranged.normalFeet,
    longFeet: ranged.longFeet ?? ranged.normalFeet
  }
  if (meleeReachFeet === undefined)
    return range
      ? rangedWeaponEffects(childId, damageTypeId, dice, range.normalFeet, range.longFeet, grip)
      : []
  if (range)
    return versatileDice
      ? thrownVersatileWeaponEffects(
          childId,
          damageTypeId,
          dice,
          versatileDice,
          range.normalFeet,
          range.longFeet
        )
      : thrownWeaponEffects(childId, damageTypeId, dice, range.normalFeet, range.longFeet, grip)
  if (versatileDice) return meleeVersatileWeaponEffects(childId, damageTypeId, dice, versatileDice)
  return meleeReachFeet > 5
    ? meleeReachWeaponEffects(childId, damageTypeId, dice, grip)
    : meleeWeaponEffects(childId, damageTypeId, dice, grip)
}

/**
 * Turns a parsed custom weapon's named attack into the same effects the seeded SRD weapons carry.
 * The damage type name must name an entry of the target System's vocabulary; an unknown name is
 * never guessed, so the weapon is imported without an attack and the issue asks for a correction.
 * Every id comes from `createId` in a fixed order so a replayed plan reproduces the same ids.
 */
export function applyImportedWeaponAttack(
  custom: Pick<ExternalCustomContent, 'label' | 'path' | 'payload' | 'weaponAttack'>,
  damageTypes: readonly ImportedVocabularyEntry[],
  createId: () => string
): { payload: Record<string, unknown>; issues: ImportIssueDto[] } {
  const attack = custom.weaponAttack
  if (!attack) return { payload: custom.payload, issues: [] }

  const damageType = resolveImportedVocabularyEntry(damageTypes, attack.damageTypeName)
  if (!damageType) {
    return {
      payload: custom.payload,
      issues: [
        {
          severity: 'WARNING',
          code: 'UNKNOWN_DAMAGE_TYPE',
          message: `Custom weapon "${custom.label}" deals "${attack.damageTypeName}" damage, which is not a damage type of the selected System. It was imported without an attack.`,
          path: custom.path,
          correctionRequired: true
        }
      ]
    }
  }
  return {
    payload: {
      ...custom.payload,
      effects: weaponAttackEffects(attack, damageType.id, () => createId())
    },
    issues: []
  }
}
