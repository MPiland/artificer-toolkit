import { useMemo } from 'react'
import { get } from 'lodash-es'
import { useFilterStore, type StoreFormType } from '~store'
import type { ListItemType, MetaDataType } from '~types'
import type { FilterConfig, FilterDataType } from '~components/List'
import type { MetaDataItem } from './useMetaData'

interface UseFilteredListProps<T extends FilterDataType, K extends MetaDataType> {
  data: ListItemType[] | null | undefined
  context: StoreFormType | null | undefined
  metaData?: MetaDataType
  filterConfigs?: FilterConfig<T, K>[]
}

const metaKey = {
  spells: 'spellIds',
  equipment: 'equipmentIds',
  classes: 'classIds',
  races: 'raceIds',
} as const

/**
 * Custom hook for filtering data based on filter state
 * @returns The filtered data array
 */
const useFilteredList = <T extends FilterDataType, K extends MetaDataType>({
  data,
  context,
  metaData,
  filterConfigs,
}: UseFilteredListProps<T, K>): ListItemType[] => {
  // Get the filter state directly from the store
  const { filters } = useFilterStore((state) => state)

  // Apply filters to data and return the result
  return useMemo(() => {
    // Early return conditions
    if (!data) return []
    if (!context || !filters || !filters[context] || !filterConfigs || !metaData) return data

    const currentFilters = filters[context]

    // If there are no filters, return all data
    if (Object.keys(currentFilters).length === 0) return data

    // Extract all paths and their values from the filter state
    const pathsAndValues = extractPathsAndValues(currentFilters)

    return data.filter((item) => {
      // Item matches if it passes all filter conditions
      return pathsAndValues.every(([path, value]) => {
        // Skip empty filters
        if (value === null || value === undefined || value === '' || (Array.isArray(value) && value.length === 0)) {
          return true
        }

        if (path === 'label') {
          return item.label.toLowerCase().includes((value as string).toLowerCase())
        }

        const metaPath = filterConfigs.find((c) => c.path === path)?.options?.metaPath

        if (!metaPath) return true

        const metaArray: MetaDataItem[] = get(metaData, metaPath)

        // Handle array values (like from multi-select)
        if (Array.isArray(value)) {
          const metaIds = metaArray
            .filter((metaObject) => value.includes(metaObject.id))
            .flatMap((metaObject) => metaObject[metaKey[context]])

          if (!metaIds.length) return false

          return metaIds.includes(item.id)
        }

        // Handle string values (like from text inputs)
        if (typeof value === 'string') {
          const metaIds = metaArray
            .filter((metaObject) => metaObject.id === value)
            .flatMap((metaObject) => metaObject[metaKey[context]])

          return metaIds.includes(item.id)
        }

        // For number item values, convert to string and check
        if (typeof value === 'number') {
          const metaIds = metaArray
            .filter((metaObject) => metaObject.id === String(value))
            .map((metaObject) => metaObject[metaKey[context]])

          return metaIds.includes(get(item, path))
        }

        return false
      })
    })
  }, [data, context, filters, filterConfigs, metaData])
}

/**
 * Extract all paths and their values from a nested object
 * Example: { damage: { primary: { id: ['cold'] } } } becomes [['damage.primary.id', ['cold']]]
 */
function extractPathsAndValues(obj: object, basePath = ''): [string, unknown][] {
  return Object.entries(obj).flatMap(([key, value]) => {
    const currentPath = basePath ? `${basePath}.${key}` : key

    // If value is an object (but not an array), recursively extract its paths
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      return extractPathsAndValues(value, currentPath)
    }

    // Otherwise, return this path and its value
    return [[currentPath, value]]
  })
}

export default useFilteredList
