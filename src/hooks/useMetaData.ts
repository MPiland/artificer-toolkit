import { get } from 'lodash'
import { useCallback } from 'react'
import type { DeepKeyOf, ListItemType, MetaDataType } from '../types/form'
import type { FooterArray, FooterObject, FooterConfig, DropdownOption } from '../types/components'
import useSystemData from './useSystemData'
import useClassData from './useClassData'
import { extractLookupData, getLabelFromId } from '../utils/data'

export type MetaDataItem = {
  id: string
  [key: string]: string
}

// Define a mapping between metadata types and their ID field names
export const metaDataIdFieldMap: Record<MetaDataType['__typename'], 'spellIds' | 'classIds' | 'raceIds' | 'equipmentIds'> =
  {
    SpellMeta: 'spellIds',
    EquipmentMeta: 'equipmentIds',
    ClassMeta: 'classIds',
    RaceMeta: 'raceIds',
  } as const

const useMetaData = <T extends MetaDataType, K extends keyof T, U extends ListItemType>({
  metaData,
}: {
  metaData?: T
}) => {
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

  // Get the options to populate the dropdowns for filtering on list
  const getFilterOptions = useCallback(
    ({ metaPath, source }: { metaPath: keyof T; source?: { type: string; sourcePath: string } }): DropdownOption[] => {
      if (!metaData || !metaData[metaPath]) {
        return []
      }

      // Get the meta array from the metaData
      const metaItems = metaData[metaPath]

      // If empty, return empty
      if (!Array.isArray(metaItems) || metaItems.length === 0) {
        return []
      }

      const { type: sourceType, sourcePath } = source || {}

      // If we have sourceType and sourcePath, look up labels from source data
      if (sourceType && sourcePath) {
        const sourceData = getSourceData(sourceType)
        if (!sourceData) return []

        const rawData = get(sourceData, sourcePath)
        if (!rawData) return []

        const lookupData = extractLookupData(rawData)

        return metaItems
          .map((item) => {
            const lookupItem = lookupData.find((lookup) => lookup.id === item.id)
            if (!lookupItem) return null

            return {
              id: item.id,
              value: lookupItem.value,
              label: lookupItem.label,
            }
          })
          .filter((item): item is NonNullable<typeof item> => item !== null)
      }
      // If no source, return the meta items as options
      if (metaItems.length) {
        return metaItems
          .map((item) => {
            if (!!item && typeof item === 'object') {
              return {
                id: item.id,
                value: item.id,
                label: String(item.id),
              }
            }
          })
          .filter((item): item is NonNullable<typeof item> => item !== null)
      }
      // If no source and no meta, return empty
      return []
    },
    [metaData, getSourceData]
  )

  const createItemLabel = ({
    item,
    stateId,
    metaDataTypename,
  }: {
    item: FooterObject<T>
    stateId: string
    metaDataTypename: MetaDataType['__typename']
  }) => {
    const itemId = metaDataIdFieldMap[metaDataTypename]
    // Get the path and subpath with proper typing
    const metaPath = item.metaPath as K
    const subMetaPath = item.subMetaPath as NonNullable<T[K]> extends Array<infer U> ? DeepKeyOf<NonNullable<U>> : never

    // Get the metadata for this path with proper typing
    const metaItems = metaData && (metaData[metaPath] as MetaDataItem[])
    if (!metaItems || !Array.isArray(metaItems)) return null

    // Find metadata items that reference the current state item
    const metaItem = metaItems.find((metaItem) => metaItem[itemId].length && metaItem[itemId].includes(stateId))

    if (!metaItem) return null

    if (item.source) {
      // Otherwise, get source data and find labels
      const sourceData = getSourceData(item.source.type)
      if (!sourceData) return null

      // If we have a field or path, look in that specific field/path of the source data
      const rawData = item.source.sourcePath ? get(sourceData, item.source.sourcePath) : sourceData
      if (!rawData) return null

      const labelKey = item.source?.labelKey

      const lookupData = extractLookupData(rawData)

      if (lookupData.length) {
        const label = getLabelFromId(metaItem.id, lookupData, labelKey)
        if (item.subMetaPath) {
          const subLabel = metaItem[subMetaPath]
          return `${subLabel} ${label}`
        } else {
          return label
        }
      }
    }

    return null
  }

  const getSourceText = ({ footer, state }: { footer: FooterConfig<T>; state: U }): string => {
    // Process a single item or array of items
    const processItem = ({
      item,
      state,
    }: {
      item: FooterObject<T> | FooterArray<T> | FooterArray<T>[]
      state: U
    }): string | null | undefined => {
      if (!item || !state || !metaData) {
        return null
      }

      // Handle array case
      if (Array.isArray(item)) {
        let label: string = ''
        item.forEach((nestedItem, index) => {
          if (Array.isArray(nestedItem)) {
            let result = processItem({ item: nestedItem, state })
            if (result && index !== item.length - 1) {
              result += ' / '
            }
            label += result
          } else {
            let result = createItemLabel({
              item: nestedItem,
              stateId: state.id,
              metaDataTypename: metaData.__typename,
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
        return createItemLabel({
          item,
          stateId: state.id,
          metaDataTypename: metaData.__typename,
        })
      }
    }

    // If there's a footer item to process, process the text
    if (footer && footer.text) {
      const result = processItem({
        item: footer.text,
        state,
      })
      if (result) {
        return result
      }
      return '---'
    }

    return '---'
  }

  return {
    getSourceText,
    getFilterOptions,
  }
}

export default useMetaData
