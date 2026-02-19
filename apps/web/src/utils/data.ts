import { truncate } from 'lodash-es'
import type { MetaDataItem } from '@hooks'
import type { CamelCase } from 'type-fest'
import { camelCase } from 'lodash-es'
import { ModCats, ModSpellCats } from '@types'

export interface CharacterGrantRef {
  featureId?: string // FK → Feature.id
  classId?: string // FK → Class.id
  raceId?: string // FK → Race.id
  ancestryId?: string // FK → RaceAncestry.id (if chosen)
  equipmentId?: string // FK → Equipment.id
  backgroundId?: string // FK → Background.id
  featId?: string // FK → Feat.id
  subfeatureOptionId?: string // FK → FeatureOption.id (if from an option)
  uiKey?: string // Stable, deterministic UI key ("typename-parent-sIndex-i")
  grantedAtLevel?: number // int — level of the parent class/feature when granted
}

export type CharacterGrantKind
  = | 'modifier'
    | 'sense'
    | 'feat'
    | 'proficiency'
    | 'expertise'
    | 'spell'

export interface CharacterGrantView extends CharacterGrantRef {
  kind: CharacterGrantKind
  id: string // subfeature id (e.g. subfeatureModifierId)
  targetId?: string // senseId, spellId, skillId, etc.
  featureLevel?: number // optional level granted
}

function buildCharacterGrants(character: Character): CharacterGrantView[] {
  const grants: CharacterGrantView[] = []

  const add = <T extends CharacterGrantRef>(
    kind: CharacterGrantKind,
    array: T[] | undefined,
    getId: (item: T) => string,
    getTarget?: (item: T) => string | undefined
  ) => {
    if (!array) return
    for (const item of array) {
      grants.push({
        kind,
        id: getId(item),
        targetId: getTarget?.(item),
        featureLevel: (item as any).featureLevel,
        ...item
      })
    }
  }

  add('modifier', character.modifiers, (m) => m.subfeatureModifierId)
  add('sense', character.senses, (s) => s.subfeatureSenseId, (s) => s.senseId)
  add('feat', character.feats, (f) => f.subfeatureFeatId)
  add('proficiency', character.proficiencies, (p) => p.subfeatureProficiencyId)
  add('expertise', character.expertise, (e) => e.subfeatureExpertiseId)
  // Optional:
  add('spell', character.spellcasting?.additional, (s) => s.subfeatureSpellId, (s) => s.spellId)

  return grants
}

export const getModifierProperties = ({
  category
}: {
  category: CamelCase<keyof typeof ModCats | keyof typeof ModSpellCats>
}) => {
  switch (camelCase(category)) {
    case 'conditionSave':
    case 'conditions':
      return 'conditions'
    case 'unarmedDamage':
    case 'meleeDamage':
    case 'rangeDamage':
    case 'spellDamage':
    case 'damageSave':
    case 'damageTypes':
      return 'damageTypes'
    case 'speeds':
      return 'speeds'
    case 'spell':
    case 'spells':
      return 'spells'
    case 'saveAbilities':
      return 'saveAbilities'
    case 'abilityScores':
      return 'abilities'
    case 'spellRange':
      return 'range'
    case 'spellDuration':
      return 'duration'
    case 'spellShape':
      return 'shape'
  }
}

// Function to create an array with methods
export const createArrayWithMethods = <
  T,
  M extends {
    [K in keyof M]: (this: T[] & M) => unknown
  }
>(
  array: T[],
  methods: M
): T[] & M => {
  const extended = array as T[] & M

  for (const key in methods) {
    const method = methods[key].bind(extended)
    extended[key as keyof M] = method as (T[] & M)[keyof M]
  }

  return extended
}

// Define a type for the lookup items
export interface LookupItem {
  id: string
  label: string
  [key: string]: unknown
}

type FlattenDataItem = {
  id: string
  label: string
  [key: string]: unknown
}

// Flatten nested data structures to extract lookup items
export const flattenData = <U extends FlattenDataItem>(obj: U | U[]): LookupItem[] => {
  const result: LookupItem[] = []

  const process = (item: U | U[]): void => {
    if (Array.isArray(item)) {
      item.forEach((i) => process(i))
    } else if (typeof item === 'object' && item !== null) {
      if (item.id && item.label) {
        result.push(item)
      }
      Object.values(item).forEach((val) => {
        if (typeof val === 'object' && val !== null) {
          process(val as U | U[])
        }
      })
    }
  }

  process(obj)
  return result
}

// Process array values with optional truncation
export const processArrayValue = (value: unknown[], shouldTruncate: boolean, truncateNum?: number): string | null => {
  if (value.length === 0) {
    return null
  } else if (value.length === 1) {
    const stringValue = String(value[0])
    return shouldTruncate
      ? truncate(stringValue, {
          length: truncateNum || 0,
          omission: ''
        })
      : stringValue
  } else {
    const sortedValues = [...value]
    sortedValues.sort((a, b) => String(a).localeCompare(String(b)))

    return sortedValues
      .map((nestedValue) => {
        const nameValue
          = typeof nestedValue === 'object' && nestedValue !== null && 'name' in nestedValue
            ? (nestedValue.name as string) || String(nestedValue)
            : String(nestedValue)

        return shouldTruncate
          ? truncate(nameValue, {
              length: truncateNum || 0,
              omission: ''
            })
          : nameValue
      })
      .join(' / ')
  }
}

// Extract lookup data from raw source data
export const extractLookupData = (
  rawData:
    | {
      id: string
      label: string
      [key: string]: unknown
    }
    | {
      id: string
      label: string
      [key: string]: unknown
    }[]
): LookupItem[] => {
  let lookupData: LookupItem[] = []

  if (Array.isArray(rawData)) {
    // Always filter to ensure all items have the right structure
    const filteredRawData = rawData.filter(Boolean)

    if (filteredRawData.length) {
      // If all items already have the right structure, no need to flatten
      if (filteredRawData.length === rawData.length) {
        lookupData = filteredRawData as LookupItem[]
      } else {
        // Some items were filtered out, might need to flatten the rest
        lookupData = flattenData(filteredRawData)
      }
    }
  } else if (typeof rawData === 'object' && rawData !== null) {
    // If rawData is an object, flatten it
    if ('id' in rawData && 'label' in rawData) {
      lookupData = [rawData as LookupItem]
    } else {
      lookupData = flattenData(rawData as FlattenDataItem)
    }
  }

  return lookupData
}

// Process array of IDs to find matching labels from lookup data
export const getLabelsFromIds = ({ ids, lookupData }: { ids: string[], lookupData: LookupItem[] }): string | null => {
  const labelValues = ids
    .map((id) => {
      const lookupItem = lookupData.find((item) => item.id === id)
      return lookupItem?.label
    })
    .filter((label): label is string => typeof label === 'string')

  if (labelValues.length === 0) return null

  return labelValues.join(' / ')
}

// Get label for a single ID from lookup data
export const getLabelFromId = ({
  id,
  lookupData,
  labelKey
}: {
  id: MetaDataItem['id']
  lookupData: LookupItem[]
  labelKey?: string
}): string | null => {
  const lookupItem = lookupData.find((item) => item.id === id)
  if (lookupItem) {
    if (labelKey) {
      return lookupItem[labelKey] as string | null
    }
    return lookupItem.label
  }
  return null
}
