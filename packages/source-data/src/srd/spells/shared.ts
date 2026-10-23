import {
  AUTHORING_SELECTION_KIND,
  DAMAGE_DEFENSE_BYPASS_CODE,
  GRANT_KIND,
  MODIFIER_KIND,
  MODIFIER_SCOPE_KIND,
  VALUE_DOMAIN_CODE
} from '@artificer-toolkit/shared/core'
import type { ModifierGrantAuthored } from '@artificer-toolkit/shared/authored'
import {
  SRD_CONDITION_TYPES,
  SRD_CREATURE_TYPES,
  SRD_DAMAGE_TYPES,
  SRD_MAGIC_SCHOOLS,
  SRD_SYSTEM_ID,
  SRD_USER_ID
} from '../vocabulary.js'

export function schoolId(code: string): string {
  const entry = SRD_MAGIC_SCHOOLS.find((s) => s.code === code)
  if (!entry) {
    throw new Error(`SRD magic school vocabulary entry for ${code} required for spell source data.`)
  }

  return entry.id
}

export function damageTypeId(code: string): string {
  const entry = SRD_DAMAGE_TYPES.find((damageType) => damageType.code === code)
  if (!entry) {
    throw new Error(`SRD damage type vocabulary entry for ${code} required for spell source data.`)
  }

  return entry.id
}

export function conditionTypeId(code: string): string {
  const entry = SRD_CONDITION_TYPES.find((conditionType) => conditionType.code === code)
  if (!entry) {
    throw new Error(
      `SRD condition type vocabulary entry for ${code} required for spell source data.`
    )
  }

  return entry.id
}

export function creatureTypeId(code: string): string {
  const entry = SRD_CREATURE_TYPES.find((creatureType) => creatureType.code === code)
  if (!entry) {
    throw new Error(
      `SRD creature type vocabulary entry for ${code} required for spell source data.`
    )
  }

  return entry.id
}

export function spellChildId(spellId: string, bucket: number, index: number): string {
  const parts = spellId.split('-')
  const spellDomain = parts[3]
  const spellSuffix = parts[4]
  const bucketHex = bucket.toString(16).padStart(4, '0')
  const indexHex = index.toString(16).padStart(12, '0')

  return `${spellDomain.padStart(8, '0')}-0000-${bucketHex}-${spellSuffix.slice(0, 4)}-${indexHex}`
}

export { SRD_SYSTEM_ID, SRD_USER_ID }

/**
 * Resistance to bludgeoning, piercing and slashing damage from nonmagical attacks (Stoneskin, Wind
 * Walk's "nonmagical weapons"); a magical attack's damage is not resisted.
 */
export function nonmagicalWeaponResistanceGrants(
  idFor: (entry: number) => string
): ModifierGrantAuthored[] {
  return (['BLUDGEONING', 'PIERCING', 'SLASHING'] as const).map((code, index) => ({
    id: idFor(index + 1),
    order: index + 1,
    grantKind: GRANT_KIND.MODIFIER_GRANT,
    valueDomainCode: VALUE_DOMAIN_CODE.DAMAGE_RESISTANCE,
    domain: {},
    modifierKind: MODIFIER_KIND.ADD_OPTION,
    scope: MODIFIER_SCOPE_KIND.GLOBAL,
    selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
    payload: { damageTypeId: damageTypeId(code), bypassedBy: [DAMAGE_DEFENSE_BYPASS_CODE.MAGICAL] }
  }))
}
