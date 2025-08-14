import { get } from 'lodash-es'
import { useCallback } from 'react'
import type { ListItemType, MetaDataType } from '~/types'
import type { FooterObject, FooterConfig, FooterPathObject, FooterPath } from '~/components/List'
import type { DropdownOption } from '~/components/Dropdown'
import { useSystemData } from '~/hooks'
import { extractLookupData, getLabelFromId } from '~/utils'
import { useListClasses } from '../apis'

export type MetaDataItem = {
  id: string
  spellIds?: string[]
  classIds?: string[]
  raceIds?: string[]
  equipmentIds?: string[]
  [key: string]: unknown
}

// Define a mapping between metadata types and their ID field names
export const metaDataIdFieldMap: Record<
  MetaDataType['__typename'],
  'spellIds' | 'classIds' | 'raceIds' | 'equipmentIds'
> = {
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
  const { data: classes } = useListClasses()

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
      const metaItems = metaData[metaPath] as DropdownOption[]

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

  const isPathObject = (pathObject: object): pathObject is FooterPathObject<T, K> => {
    return pathObject && typeof pathObject === 'object' && 'subPaths' in pathObject
  }

  const resolvePathLabel = ({
    pathObject,
    metaObject,
    stateId,
  }: {
    pathObject: FooterPathObject<T, K> | FooterPath<T, K>
    metaObject: keyof T
    stateId: string
  }): string | null => {
    if (!metaData) return null
    const itemId = metaDataIdFieldMap[metaData.__typename]
    const metaItems = metaData[metaObject]
    if (!metaItems || !Array.isArray(metaItems)) return null

    // Use filter to gather all relevant meta items for the given stateId
    const relevantMetaItems = metaItems.filter((m) => m[itemId]?.includes?.(stateId))
    if (relevantMetaItems.length === 0) return null

    let label: string = ''
    const groupValues = relevantMetaItems.map((relevantMeta) => {
      // Resolve the value for the primary path
      const value = relevantMeta[pathObject.path]

      // If there's a source field, resolve it
      if (pathObject.source) {
        const sourceData = getSourceData(pathObject.source.type)
        const rawData = pathObject.source.sourcePath ? get(sourceData, pathObject.source.sourcePath) : sourceData

        const lookupData = extractLookupData(
          rawData as
            | { id: string; label: string; [key: string]: unknown }
            | { id: string; label: string; [key: string]: unknown }[]
        )
        return getLabelFromId({ id: value, lookupData, labelKey: pathObject.source.labelKey })
      }
      return get(relevantMeta, pathObject.path)
    })

    const filteredValues = groupValues.filter(Boolean)

    if (filteredValues.length && filteredValues.length > 1) {
      label = filteredValues.join(', ')
    } else if (filteredValues.length === 1) {
      label = `${filteredValues.join('')} `
    }

    // If there is a subPath array, process that next
    let subGroupLabel: string = ''
    if (isPathObject(pathObject)) {
      if (pathObject?.subPaths && pathObject?.subPaths?.length) {
        const subGroupValues = pathObject.subPaths.map((subPath) => {
          // If subPath object is nested array
          if (Array.isArray(subPath)) {
            let subPathGroupIsInvalid = false
            const subLabels: string[] = []
            for (const subPathItem of subPath) {
              const subLabel = resolvePathLabel({ pathObject: subPathItem, metaObject, stateId })
              if (subPathItem.dependents && (!subLabel || subLabel === '')) {
                subPathGroupIsInvalid = true
                break
              }
              if (subLabel && subLabel !== '') {
                subLabels.push(subLabel)
              }
            }
            if (subLabels.length && !subPathGroupIsInvalid) {
              return subLabels.join(' ')
            }
            return null
          }
          return resolvePathLabel({ pathObject: subPath, metaObject, stateId })
        })

        if (subGroupValues.length) {
          subGroupLabel = subGroupValues.filter(Boolean).join(' / ')
          label += subGroupLabel
        }
      }
    }

    // If we have multiple group values, join them with ", "
    return label
  }

  type CreateItemLabelParams = {
    metaObjects: FooterObject<T>[] | FooterObject<T>
    stateId: string
  }

  const createItemLabel = ({ metaObjects, stateId }: CreateItemLabelParams): string => {
    const items = Array.isArray(metaObjects) ? metaObjects : [metaObjects]
    const itemLabels = items.map((item) => {
      let groupIsInvalid = false
      const pathLabels: string[] = []

      if (item.paths?.length) {
        for (const pathObject of item.paths) {
          const label = resolvePathLabel({
            pathObject,
            metaObject: item.metaObject as keyof T,
            stateId,
          })

          if (pathObject.dependents && (!label || label === '')) {
            groupIsInvalid = true
            break
          }

          if (label) pathLabels.push(label)
        }
      }

      return groupIsInvalid ? '' : pathLabels.join(' ')
    })

    return itemLabels.filter(Boolean).join(' / ')
  }

  const getSourceText = ({ footer, state }: { footer: FooterConfig<T>; state: U }): string => {
    // If there's a footer item to process, process the text
    if (footer && footer.text) {
      const result = createItemLabel({
        metaObjects: footer.text,
        stateId: state.id,
      })

      if (result != null && result !== '') {
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
