import { useMemo } from 'react'
import { get } from 'lodash'
import { FormType } from '../store/filterSlice'
import { FormDataType } from '../types/form'
import { useStore } from '../store/useStore'

interface UseFilteredListProps {
  data: FormDataType[] | null | undefined
  context: FormType | null | undefined
}

/**
 * Custom hook for filtering data based on filter state
 * @returns The filtered data array
 */
const useFilteredList = ({ data, context }: UseFilteredListProps): FormDataType[] => {
  // Get the filter state directly from the store
  const { filterState } = useStore()

  // Apply filters to data and return the result
  return useMemo(() => {
    // Early return conditions
    if (!data) return []
    if (!context || !filterState || !filterState[context]) return data

    const currentFilters = filterState[context]

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

        // Get the item value at this path
        const itemValue = get(item, path)

        // If the item doesn't have this path, it doesn't match
        if (itemValue === undefined) return false

        // Handle array values (like from multi-select)
        if (Array.isArray(value)) {
          // If the item value is an array, check if any filter value matches any item value
          if (Array.isArray(itemValue)) {
            return value.some((v) => itemValue.some((iv) => valuesMatch(iv, v)))
          }

          // If the item value is not an array, check if any filter value matches it
          return value.some((v) => valuesMatch(itemValue, v))
        }

        // Handle string values (like from text inputs)
        if (typeof value === 'string') {
          // For string item values, check if it includes the filter value
          if (typeof itemValue === 'string') {
            return itemValue.toLowerCase().includes(value.toLowerCase())
          }

          // For number item values, convert to string and check
          if (typeof itemValue === 'number') {
            return String(itemValue).toLowerCase().includes(value.toLowerCase())
          }

          return false
        }

        // For other value types, do a direct comparison
        return valuesMatch(itemValue, value)
      })
    })
  }, [data, context, filterState])
}

/**
 * Extract all paths and their values from a nested object
 * Example: { damage: { primary: { id: ['cold'] } } } becomes [['damage.primary.id', ['cold']]]
 */
function extractPathsAndValues(obj: any, basePath = ''): [string, any][] {
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

/**
 * Helper function to check if two values match, handling type conversions
 */
function valuesMatch(a: any, b: any): boolean {
  // Direct equality
  if (a === b) return true

  // String equality
  if (String(a) === String(b)) return true

  // Number equality (string to number)
  if (typeof a === 'string' && typeof b === 'number' && Number(a) === b) return true

  // Number equality (number to string)
  if (typeof a === 'number' && typeof b === 'string' && a === Number(b)) return true

  return false
}

export default useFilteredList
