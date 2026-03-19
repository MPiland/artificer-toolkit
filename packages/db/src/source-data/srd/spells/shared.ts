import {
  SRD_CONDITION_TYPES,
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
    throw new Error(`SRD condition type vocabulary entry for ${code} required for spell source data.`)
  }

  return entry.id
}

export function spellChildId(spellId: string, bucket: number, index: number): string {
  const [, , , , spellSuffix] = spellId.split('-')
  const bucketHex = bucket.toString(16).padStart(4, '0')
  const indexHex = index.toString(16).padStart(12, '0')

  return `00000000-0000-${bucketHex}-${spellSuffix.slice(0, 4)}-${indexHex}`
}

export { SRD_SYSTEM_ID, SRD_USER_ID }
