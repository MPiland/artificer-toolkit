import { describe, expect, it } from 'vitest'

import {
  DURATION_KIND,
  EQUIPMENT_CATEGORY_CODE,
  EQUIPMENT_PROPERTY_CODE,
  PATH_CODES_BY_TRIGGER,
  PROFICIENCY_KIND
} from '@artificer-toolkit/shared/core'

import { mapDurationToRow } from '../domains/shared/upserts/characteristic.js'
import { srdBaselineContent } from '../source-data/srd/index.js'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const RESULT_BLOCK_ID_SUFFIX = '__result'

function isUuidKey(key: string): boolean {
  return key === 'id' || key === 'userId' || key === 'systemId' || key.endsWith('Id') || key.endsWith('Ids')
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
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
      value.proficiencyKind === PROFICIENCY_KIND.EQUIPMENT
      && value.authoringModeKind === 'SELECTED'
      && (!Array.isArray(value.equipmentIds) || value.equipmentIds.length === 0)
    ) {
      invalidValues.push(`${path}.equipmentIds: SELECTED equipment proficiency requires equipment IDs`)
    }
  }

  for (const [key, entry] of Object.entries(value)) {
    collectInvalidEquipmentProficiencySelectors(entry, path ? `${path}.${key}` : key, invalidValues)
  }
}

function collectDurationKinds(
  value: unknown,
  path: string,
  invalidValues: string[]
) {
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

function collectInvalidEffectPathCodes(
  value: unknown,
  path: string,
  invalidValues: string[]
) {
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

  if (isRecord(invocation) && Array.isArray(value.paths) && typeof invocation.triggerCode === 'string') {
    const allowedPathCodes: ReadonlySet<string> = new Set(
      PATH_CODES_BY_TRIGGER[invocation.triggerCode as keyof typeof PATH_CODES_BY_TRIGGER] ?? []
    )

    value.paths.forEach((effectPath, index) => {
      if (isRecord(effectPath) && typeof effectPath.pathCode === 'string' && !allowedPathCodes.has(effectPath.pathCode)) {
        invalidValues.push(`${path}.paths[${index}]: ${invocation.triggerCode}/${effectPath.pathCode}`)
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

  for (const key of [
    'edgeLength', 'height', 'length', 'radius', 'thickness'
  ]) {
    const dimension = value[key]

    if (isRecord(dimension) && typeof dimension.amount === 'number' && !Number.isInteger(dimension.amount)) {
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

describe('SRD source data', () => {
  it('uses valid UUID strings for deterministic ID fields', () => {
    const invalidValues: string[] = []

    collectInvalidUuidValues(srdBaselineContent, 'srdBaselineContent', invalidValues)

    expect(invalidValues).toEqual([])
  })

  it('does not define duplicate subject IDs', () => {
    const subjectGroups = Object.values(srdBaselineContent.subjects) as readonly (readonly { id: string }[])[]
    const subjectIds = subjectGroups
      .flatMap((subjects) => subjects.map((subject) => subject.id))

    expect(collectDuplicateValues(subjectIds)).toEqual([])
  })

  it('only references equipment records that exist in the SRD equipment bundle', () => {
    const equipmentIds = new Set(srdBaselineContent.subjects.equipment.map((equipment) => equipment.id))
    const referencedEquipmentIds: string[] = []

    collectEquipmentReferences(srdBaselineContent, referencedEquipmentIds)

    expect([...new Set(referencedEquipmentIds.filter((id) => !equipmentIds.has(id)))]).toEqual([])
  })

  it('only references rarity records that exist in the SRD system vocabulary', () => {
    const rarityIds = new Set(srdBaselineContent.vocabulary.systems.flatMap((system) => system.rarities.map((rarity) => rarity.id)))
    const referencedRarityIds = srdBaselineContent.subjects.equipment.map((equipment) => equipment.rarityId)

    expect([...new Set(referencedRarityIds.filter((id) => !rarityIds.has(id)))]).toEqual([])
  })

  it('only references creature type records that exist in the SRD system vocabulary', () => {
    const creatureTypeIds = new Set(
      srdBaselineContent.vocabulary.systems.flatMap((system) => system.creatureTypes.map((creatureType) => creatureType.id))
    )
    const referencedCreatureTypeIds: string[] = []

    collectStringReferencesByKey(srdBaselineContent, 'creatureTypeId', referencedCreatureTypeIds)

    expect([...new Set(referencedCreatureTypeIds.filter((id) => !creatureTypeIds.has(id)))]).toEqual([])
  })

  it('only references challenge rating records that exist in the SRD system vocabulary', () => {
    const challengeRatingIds = new Set(
      srdBaselineContent.vocabulary.systems.flatMap((system) => system.challengeRatings.map((challengeRating) => challengeRating.id))
    )
    const referencedChallengeRatingIds: string[] = []

    collectStringReferencesByKey(srdBaselineContent, 'challengeRatingId', referencedChallengeRatingIds)

    expect([...new Set(referencedChallengeRatingIds.filter((id) => !challengeRatingIds.has(id)))]).toEqual([])
  })

  it('only references speed records that exist in the SRD system vocabulary', () => {
    const speedIds = new Set(srdBaselineContent.vocabulary.systems.flatMap((system) => system.speeds.map((speed) => speed.id)))
    const referencedSpeedIds: string[] = []

    collectStringReferencesByKey(srdBaselineContent, 'speedId', referencedSpeedIds)

    expect([...new Set(referencedSpeedIds.filter((id) => !speedIds.has(id)))]).toEqual([])
  })

  it('normalizes creature damageability references to SRD damage type IDs', () => {
    const damageTypeIds = new Set(
      srdBaselineContent.vocabulary.systems.flatMap((system) => system.damageTypes.map((damageType) => damageType.id))
    )
    const referencedDamageTypeIds = srdBaselineContent.subjects.creatures.flatMap((creature) => [
      ...(creature.damageResistances ?? []),
      ...(creature.damageImmunities ?? []),
      ...(creature.damageVulnerabilities ?? [])
    ])

    expect([...new Set(referencedDamageTypeIds.filter((id) => !damageTypeIds.has(id)))]).toEqual([])
  })

  it('normalizes creature condition immunities to SRD condition type IDs', () => {
    const conditionTypeIds = new Set(
      srdBaselineContent.vocabulary.systems.flatMap((system) => system.conditionTypes.map((conditionType) => conditionType.id))
    )
    const referencedConditionTypeIds = srdBaselineContent.subjects.creatures.flatMap((creature) => creature.conditionImmunities ?? [])

    expect([...new Set(referencedConditionTypeIds.filter((id) => !conditionTypeIds.has(id)))]).toEqual([])
  })

  it('only references option records that exist in the SRD bundle', () => {
    const optionIds = new Set<string>()
    const referencedOptionIds: string[] = []

    collectOptionIds(srdBaselineContent, optionIds)
    collectOptionReferences(srdBaselineContent, referencedOptionIds)

    expect([...new Set(referencedOptionIds.filter((id) => !optionIds.has(id)))]).toEqual([])
  })

  it('uses valid equipment proficiency selectors', () => {
    const invalidValues: string[] = []

    collectInvalidEquipmentProficiencySelectors(srdBaselineContent, 'srdBaselineContent', invalidValues)

    expect(invalidValues).toEqual([])
  })

  it('uses duration kinds supported by normalized duration persistence', () => {
    const invalidValues: string[] = []

    collectDurationKinds(srdBaselineContent, 'srdBaselineContent', invalidValues)

    expect(invalidValues).toEqual([])
    expect(mapDurationToRow({
      id: '00000000-0000-0000-0000-000000000001',
      durationKind: DURATION_KIND.UNTIL_DISPELLED
    }, '00000000-0000-0000-0000-000000000001')).toMatchObject({
      kind: DURATION_KIND.UNTIL_DISPELLED,
      amount: null,
      scaling: null
    })
  })

  it('uses effect path codes supported by each invocation trigger', () => {
    const invalidValues: string[] = []

    collectInvalidEffectPathCodes(srdBaselineContent, 'srdBaselineContent', invalidValues)

    expect(invalidValues).toEqual([])
  })

  it('uses integer shape dimensions supported by normalized shape persistence', () => {
    const invalidValues: string[] = []

    collectNonIntegerShapeDimensionAmounts(srdBaselineContent, 'srdBaselineContent', invalidValues)

    expect(invalidValues).toEqual([])
  })
})
