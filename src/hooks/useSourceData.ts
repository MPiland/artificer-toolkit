import { get, truncate } from 'lodash'
import { useSystemData, useClassData } from '@/hooks'
import { useCallback } from 'react'
import type { DetailConfig, DetailArray, DetailObject } from '@/components/Detail'
import type { FormDataType } from '@/types'
import { extractLookupData, processArrayValue, getLabelsFromIds, getLabelFromId } from '@/utils'

const useSourceData = () => {
  const { system } = useSystemData()
  const { classes } = useClassData()

  const getSourceData = useCallback(
    (sourceType: string) => {
      switch (sourceType) {
        case 'system':
          return system
        case 'classes':
          return classes
        default:
          return null
      }
    },
    [classes, system]
  )

  /**
   * Process a DetailObject to create a label
   */
  const createItemLabel = <T extends FormDataType>({
    item,
    state,
  }: {
    item: DetailObject<T>
    state: FormDataType
  }): string | null => {
    const statePath = item.path
    const stateValue = get(state, statePath)

    // If there's no state value, return null
    if (stateValue === undefined || stateValue === null) return null

    // If we have a source, look up the label
    if (item.source) {
      const sourceData = getSourceData(item.source.type)
      if (!sourceData) return null

      // If we have a path, look in that specific path of the source data
      const rawData = item.source.path ? get(sourceData, item.source.path) : sourceData
      if (!rawData) return null

      const lookupData = extractLookupData(rawData)

      if (Array.isArray(stateValue)) {
        // Handle array of values
        if (stateValue.every((value) => typeof value === 'string')) {
          return getLabelsFromIds(stateValue, lookupData)
        }
        return processArrayValue(stateValue, false)
      } else if (typeof stateValue === 'string') {
        // Handle single string value
        return getLabelFromId(stateValue, lookupData)
      }
    } else {
      // No source - just return the state value directly
      if (Array.isArray(stateValue)) {
        return processArrayValue(stateValue, false)
      } else {
        return String(stateValue)
      }
    }

    return null
  }

  const getSourceText = <T extends FormDataType>({
    input,
    state,
    truncateNum,
  }: {
    input: DetailConfig<T>
    state: T
    truncateNum?: number
  }): string => {
    const shouldTruncate: boolean = !!truncateNum

    /**
     * Process a single item or array of items
     */
    const processItem = <T extends FormDataType>({
      item,
      state,
      shouldTruncate,
    }: {
      item: DetailObject<T> | DetailArray<T> | DetailArray<T>[]
      state: FormDataType
      shouldTruncate: boolean
    }): string | null | undefined => {
      if (!item || !state) {
        return null
      }

      // Handle array case
      if (Array.isArray(item)) {
        let label: string = ''
        item.forEach((nestedItem, index) => {
          if (Array.isArray(nestedItem)) {
            let result = processItem({ item: nestedItem, state, shouldTruncate })
            if (result && index !== item.length - 1) {
              result += ' / '
            }
            label += result
          } else {
            let result = createItemLabel({
              item: nestedItem,
              state,
            })
            if (result && index !== item.length - 1) {
              result += ' '
            }
            label += result
          }
        })
        if (label != null && label !== '') {
          return label
        }
        return null
      }
      // Handle object case
      else {
        const label = createItemLabel({ item, state })

        if (label) {
          // Apply truncation if needed
          return shouldTruncate ? truncate(label, { length: truncateNum || 0 }) : label
        }

        return null
      }
    }

    if (input && input.text) {
      const result = processItem({
        item: input.text,
        state,
        shouldTruncate,
      })
      if (result) {
        return result
      }
      return '---'
    }

    return '---'
  }

  return getSourceText
}

export default useSourceData
