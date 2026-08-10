import {
  DURATION_KIND,
  EQUIPMENT_CATEGORY_CODE,
  EQUIPMENT_PROPERTY_CODE,
  PATH_CODES_BY_TRIGGER,
  PROFICIENCY_KIND
} from '@artificer-toolkit/shared/core'
import { srdBaselineContent } from '../../source-data/srd/index.js'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const RESULT_BLOCK_ID_SUFFIX = '__result'
function isUuidKey(key: string): boolean {
  return (
    key === 'id' ||
    key === 'userId' ||
    key === 'systemId' ||
    key.endsWith('Id') ||
    key.endsWith('Ids')
  )
}

function isValidUuidValue(path: string, key: string, value: string): boolean {
  if (UUID_PATTERN.test(value)) {
    return true
  }

  if (key === 'id' && path.endsWith('.resultBlock.id') && value.endsWith(RESULT_BLOCK_ID_SUFFIX)) {
    return UUID_PATTERN.test(value.slice(0, -RESULT_BLOCK_ID_SUFFIX.length))
  }

  return false
}

function collectInvalidUuidValues(value: unknown, path: string, invalidValues: string[]) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      collectInvalidUuidValues(item, `${path}[${index}]`, invalidValues)
    })

    return
  }

  if (!value || typeof value !== 'object') {
    return
  }

  for (const [key, entry] of Object.entries(value)) {
    const entryPath = path ? `${path}.${key}` : key

    if (isUuidKey(key)) {
      if (Array.isArray(entry)) {
        entry.forEach((item, index) => {
          if (typeof item === 'string' && !isValidUuidValue(`${entryPath}[${index}]`, key, item)) {
            invalidValues.push(`${entryPath}[${index}]: ${item}`)
          }
        })
      } else if (typeof entry === 'string' && !isValidUuidValue(entryPath, key, entry)) {
        invalidValues.push(`${entryPath}: ${entry}`)
      }
    }

    collectInvalidUuidValues(entry, entryPath, invalidValues)
  }
}

function collectEquipmentReferences(value: unknown, references: string[]) {
  if (Array.isArray(value)) {
    value.forEach((item) => {
      collectEquipmentReferences(item, references)
    })

    return
  }

  if (!value || typeof value !== 'object') {
    return
  }

  for (const [key, entry] of Object.entries(value)) {
    if (key === 'equipmentId' && typeof entry === 'string') {
      references.push(entry)
    }

    if (key === 'equipmentIds' && Array.isArray(entry)) {
      entry.forEach((item) => {
        if (typeof item === 'string') {
          references.push(item)
        }
      })
    }

    collectEquipmentReferences(entry, references)
  }
}

function collectOptionReferences(value: unknown, references: string[]) {
  if (Array.isArray(value)) {
    value.forEach((item) => {
      collectOptionReferences(item, references)
    })

    return
  }

  if (!value || typeof value !== 'object') {
    return
  }

  for (const [key, entry] of Object.entries(value)) {
    if (key === 'optionId' && typeof entry === 'string') {
      references.push(entry)
    }

    if (key === 'optionIds' && Array.isArray(entry)) {
      entry.forEach((item) => {
        if (typeof item === 'string') {
          references.push(item)
        }
      })
    }

    collectOptionReferences(entry, references)
  }
}

function collectStringReferencesByKey(value: unknown, referenceKey: string, references: string[]) {
  if (Array.isArray(value)) {
    value.forEach((item) => {
      collectStringReferencesByKey(item, referenceKey, references)
    })

    return
  }

  if (!value || typeof value !== 'object') {
    return
  }

  for (const [key, entry] of Object.entries(value)) {
    if (key === referenceKey && typeof entry === 'string') {
      references.push(entry)
    }

    collectStringReferencesByKey(entry, referenceKey, references)
  }
}

function collectDuplicateValues(values: string[]): string[] {
  const seen = new Set<string>()
  const duplicates = new Set<string>()

  values.forEach((value) => {
    if (seen.has(value)) {
      duplicates.add(value)
      return
    }

    seen.add(value)
  })

  return [...duplicates].sort()
}

export interface NestedFeatureReference {
  id: string
  path: string
}

export interface DurationReference {
  id: string
  path: string
}

function collectDurationReferences(value: unknown, path: string, references: DurationReference[]) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      collectDurationReferences(item, `${path}[${index}]`, references)
    })

    return
  }

  if (!isRecord(value)) {
    return
  }

  if (typeof value.durationKind === 'string' && typeof value.id === 'string') {
    references.push({ id: value.id, path })
  }

  for (const [key, entry] of Object.entries(value)) {
    collectDurationReferences(entry, path ? `${path}.${key}` : key, references)
  }
}

function collectNestedFeatureReferences(
  value: unknown,
  path: string,
  references: NestedFeatureReference[]
) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      collectNestedFeatureReferences(item, `${path}[${index}]`, references)
    })

    return
  }

  if (!isRecord(value)) {
    return
  }

  if (Array.isArray(value.features)) {
    value.features.forEach((feature, index) => {
      if (isRecord(feature) && typeof feature.id === 'string') {
        references.push({
          id: feature.id,
          path: `${path}.features[${index}]`
        })
      }
    })
  }

  for (const [key, entry] of Object.entries(value)) {
    collectNestedFeatureReferences(entry, path ? `${path}.${key}` : key, references)
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function collectGrantedRecordsWithCounts(value: unknown, path: string, invalidValues: string[]) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      collectGrantedRecordsWithCounts(item, `${path}[${index}]`, invalidValues)
    })

    return
  }

  if (!isRecord(value)) {
    return
  }

  if (value.selectionKind === 'GRANTED' && 'count' in value) {
    invalidValues.push(`${path}.count`)
  }

  for (const [key, entry] of Object.entries(value)) {
    collectGrantedRecordsWithCounts(entry, path ? `${path}.${key}` : key, invalidValues)
  }
}

function collectInvalidEquipmentProficiencySelectors(
  value: unknown,
  path: string,
  invalidValues: string[]
) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      collectInvalidEquipmentProficiencySelectors(item, `${path}[${index}]`, invalidValues)
    })

    return
  }

  if (!isRecord(value)) {
    return
  }

  if (value.grantKind === 'PROFICIENCY_GRANT') {
    if (typeof value.category === 'string' && !(value.category in EQUIPMENT_CATEGORY_CODE)) {
      invalidValues.push(`${path}.category: ${value.category}`)
    }

    if (Array.isArray(value.properties)) {
      value.properties.forEach((property, index) => {
        if (typeof property === 'string' && !(property in EQUIPMENT_PROPERTY_CODE)) {
          invalidValues.push(`${path}.properties[${index}]: ${property}`)
        }
      })
    }

    if (
      value.proficiencyKind === PROFICIENCY_KIND.EQUIPMENT &&
      value.authoringModeKind === 'SELECTED' &&
      (!Array.isArray(value.equipmentIds) || value.equipmentIds.length === 0)
    ) {
      invalidValues.push(
        `${path}.equipmentIds: SELECTED equipment proficiency requires equipment IDs`
      )
    }
  }

  for (const [key, entry] of Object.entries(value)) {
    collectInvalidEquipmentProficiencySelectors(entry, path ? `${path}.${key}` : key, invalidValues)
  }
}

function collectDurationKinds(value: unknown, path: string, invalidValues: string[]) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      collectDurationKinds(item, `${path}[${index}]`, invalidValues)
    })

    return
  }

  if (!isRecord(value)) {
    return
  }

  if (typeof value.durationKind === 'string' && !(value.durationKind in DURATION_KIND)) {
    invalidValues.push(`${path}.durationKind: ${value.durationKind}`)
  }

  for (const [key, entry] of Object.entries(value)) {
    collectDurationKinds(entry, path ? `${path}.${key}` : key, invalidValues)
  }
}

function collectInvalidEffectPathCodes(value: unknown, path: string, invalidValues: string[]) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      collectInvalidEffectPathCodes(item, `${path}[${index}]`, invalidValues)
    })

    return
  }

  if (!isRecord(value)) {
    return
  }

  const invocation = value.invocation

  if (
    isRecord(invocation) &&
    Array.isArray(value.paths) &&
    typeof invocation.triggerCode === 'string'
  ) {
    const triggerCode = invocation.triggerCode
    const allowedPathCodes: ReadonlySet<string> = new Set(
      PATH_CODES_BY_TRIGGER[triggerCode as keyof typeof PATH_CODES_BY_TRIGGER] ?? []
    )

    value.paths.forEach((effectPath, index) => {
      if (
        isRecord(effectPath) &&
        typeof effectPath.pathCode === 'string' &&
        !allowedPathCodes.has(effectPath.pathCode)
      ) {
        invalidValues.push(`${path}.paths[${index}]: ${triggerCode}/${effectPath.pathCode}`)
      }
    })
  }

  for (const [key, entry] of Object.entries(value)) {
    collectInvalidEffectPathCodes(entry, path ? `${path}.${key}` : key, invalidValues)
  }
}

function collectNonIntegerShapeDimensionAmounts(
  value: unknown,
  path: string,
  invalidValues: string[]
) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      collectNonIntegerShapeDimensionAmounts(item, `${path}[${index}]`, invalidValues)
    })

    return
  }

  if (!isRecord(value)) {
    return
  }

  for (const key of ['edgeLength', 'height', 'length', 'radius', 'thickness']) {
    const dimension = value[key]

    if (
      isRecord(dimension) &&
      typeof dimension.amount === 'number' &&
      !Number.isInteger(dimension.amount)
    ) {
      invalidValues.push(`${path}.${key}.amount: ${dimension.amount}`)
    }
  }

  for (const [key, entry] of Object.entries(value)) {
    collectNonIntegerShapeDimensionAmounts(entry, path ? `${path}.${key}` : key, invalidValues)
  }
}

function collectOptionIds(value: unknown, optionIds: Set<string>) {
  if (Array.isArray(value)) {
    value.forEach((item) => {
      collectOptionIds(item, optionIds)
    })

    return
  }

  if (!isRecord(value)) {
    return
  }

  for (const [key, entry] of Object.entries(value)) {
    if (key === 'options' && Array.isArray(entry)) {
      entry.forEach((item) => {
        if (isRecord(item) && typeof item.id === 'string') {
          optionIds.add(item.id)
        }
      })
    }

    collectOptionIds(entry, optionIds)
  }
}

function hasSpellCastLevelScaling(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.some(hasSpellCastLevelScaling)
  }

  if (!isRecord(value)) {
    return false
  }

  if (value.scalingSource === 'SPELL_CAST_LEVEL') {
    return true
  }

  return Object.values(value).some(hasSpellCastLevelScaling)
}

function stripHtml(value: string | null | undefined): string {
  return (value ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function paragraphCount(value: string | null | undefined): number {
  if (!value) return 0
  return value.match(/<p\b/gi)?.length ?? (stripHtml(value) ? 1 : 0)
}

function getSrdEquipment(label: string) {
  const equipment = srdBaselineContent.subjects.equipment.find((item) => item.label === label)

  if (!equipment) {
    throw new Error(`Expected SRD equipment "${label}" to exist.`)
  }

  return equipment
}

function getSrdClass(label: string) {
  const classRecord = srdBaselineContent.subjects.classes.find((item) => item.label === label)

  if (!classRecord) {
    throw new Error(`Expected SRD class "${label}" to exist.`)
  }

  return classRecord
}

function getSrdDamageTypeId(code: string): string {
  const damageType = srdBaselineContent.vocabulary.systems
    .flatMap((system) => system.damageTypes)
    .find((entry) => entry.code === code)

  if (!damageType) {
    throw new Error(`Expected SRD damage type "${code}" to exist.`)
  }

  return damageType.id
}

function hasDamageOutcome(value: unknown, damageTypeId: string, diceConfig: string): boolean {
  if (Array.isArray(value))
    return value.some((item) => hasDamageOutcome(item, damageTypeId, diceConfig))
  if (!isRecord(value)) return false

  if (
    value.effectKind === 'DAMAGE' &&
    value.damageTypeId === damageTypeId &&
    value.diceConfig === diceConfig
  ) {
    return true
  }

  return Object.values(value).some((entry) => hasDamageOutcome(entry, damageTypeId, diceConfig))
}

function hasHealOutcome(value: unknown, diceConfig: string): boolean {
  if (Array.isArray(value)) return value.some((item) => hasHealOutcome(item, diceConfig))
  if (!isRecord(value)) return false

  if (value.effectKind === 'HEAL' && value.diceConfig === diceConfig) {
    return true
  }

  return Object.values(value).some((entry) => hasHealOutcome(entry, diceConfig))
}

function hasManualAdjudicationOutcome(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(hasManualAdjudicationOutcome)
  if (!isRecord(value)) return false

  if (value.effectKind === 'MANUAL_ADJUDICATION') {
    return true
  }

  return Object.values(value).some(hasManualAdjudicationOutcome)
}

export {
  isUuidKey,
  isValidUuidValue,
  collectInvalidUuidValues,
  collectEquipmentReferences,
  collectOptionReferences,
  collectStringReferencesByKey,
  collectDuplicateValues,
  collectDurationReferences,
  collectNestedFeatureReferences,
  isRecord,
  collectGrantedRecordsWithCounts,
  collectInvalidEquipmentProficiencySelectors,
  collectDurationKinds,
  collectInvalidEffectPathCodes,
  collectNonIntegerShapeDimensionAmounts,
  collectOptionIds,
  hasSpellCastLevelScaling,
  stripHtml,
  paragraphCount,
  getSrdEquipment,
  getSrdClass,
  getSrdDamageTypeId,
  hasDamageOutcome,
  hasHealOutcome,
  hasManualAdjudicationOutcome
}
