import { truncate } from 'lodash'
import type { MetaDataItem } from '../hooks/useMetaData'

// Function to create an array with methods
export const createArrayWithMethods = <
  T,
  M extends {
    [K in keyof M]: (this: T[] & M & { all: T[] }, ...args: any[]) => any
  },
>(
  array: T[],
  methods: M
): T[] & M & { all: T[] } => {
  const extended = array as T[] & M & { all: T[] }

  for (const key in methods) {
    extended[key] = methods[key].bind(extended)
  }

  extended.all = array

  return extended
}

// Define a type for the lookup items
export interface LookupItem {
  id: string
  label: string
  value: any
  [key: string]: any
}

// Flatten nested data structures to extract lookup items
export const flattenData = <U extends { id: string; label: string; value: string; [key: string]: any }>(
  obj: U | U[]
): LookupItem[] => {
  const result: LookupItem[] = []

  const process = (item: U | U[]): void => {
    if (Array.isArray(item)) {
      item.forEach((i) => process(i))
    } else if (typeof item === 'object' && item !== null) {
      if (item.id && item.value && item.label) {
        result.push(item)
      }
      Object.values(item).forEach((val) => {
        if (typeof val === 'object' && val !== null) {
          process(val as any)
        }
      })
    }
  }

  process(obj)
  return result
}

// Process array values with optional truncation
export const processArrayValue = (value: any[], shouldTruncate: boolean, truncateNum?: number): string | null => {
  if (value.length === 0) {
    return null
  } else if (value.length === 1) {
    const stringValue = String(value[0])
    return shouldTruncate ?
        truncate(stringValue, {
          length: truncateNum || 0,
          omission: '',
        })
      : stringValue
  } else {
    const sortedValues = [...value]
    sortedValues.sort((a, b) => String(a).localeCompare(String(b)))

    return sortedValues
      .map((nestedValue) => {
        const nameValue =
          typeof nestedValue === 'object' && nestedValue !== null ?
            (nestedValue as any).name || String(nestedValue)
          : String(nestedValue)

        return shouldTruncate ?
            truncate(nameValue, {
              length: truncateNum || 0,
              omission: '',
            })
          : nameValue
      })
      .join(' / ')
  }
}

// Extract lookup data from raw source data
export const extractLookupData = (rawData: any): LookupItem[] => {
  let lookupData: LookupItem[] = []

  if (Array.isArray(rawData)) {
    // Always filter to ensure all items have the right structure
    const filteredRawData = rawData.filter(
      (item) => !!item && typeof item === 'object' && 'id' in item && 'label' in item && 'value' in item
    )

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
    if ('id' in rawData && 'label' in rawData && 'value' in rawData) {
      lookupData = [rawData as LookupItem]
    } else {
      lookupData = flattenData(rawData as any)
    }
  }

  return lookupData
}

// Process array of IDs to find matching labels from lookup data
export const getLabelsFromIds = ({ ids, lookupData }: { ids: string[]; lookupData: LookupItem[] }): string | null => {
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
  labelKey,
}: {
  id: MetaDataItem['id']
  lookupData: LookupItem[]
  labelKey?: string
}): string | null => {
  const lookupItem = lookupData.find((item) => item.id === id)
  if (lookupItem) {
    if (labelKey) {
      return lookupItem[labelKey]
    }
    return lookupItem.label
  }
  return null
}
