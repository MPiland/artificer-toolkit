import { useState, useMemo, useReducer } from 'react'
import formReducer from './useReducer'

interface FilteredItem {
  [key: string]: any
}

interface FilterValue {
  value: string | object
}

interface FilterValues {
  [key: string]: FilterValue[] | string | null
}

interface ListFilter {
  [key: string]: FilterValues
}

interface UseFilteredListProps {
  initialItems: FilteredItem[] | null | undefined
  initialFilter: ListFilter | null
}

interface SubItem {
  value: any
}

const useFilteredList = (
  initialItems: UseFilteredListProps['initialItems'],
  initialFilter: UseFilteredListProps['initialFilter']
) => {
  const [listFilter, setListFilter] = useReducer(formReducer, initialFilter)
  const [filteredList, setFilteredItems] = useState<
    FilteredItem[] | null | undefined
  >(initialItems)

  const filteredItems = useMemo(() => {
    if (!listFilter) {
      return filteredList
    }

    let filteredItems = filteredList

    Object.entries(listFilter).forEach(([filterField, filterValues]) => {
      if (Array.isArray(filterValues)) {
        filteredItems = filterByArray(filteredItems, filterField, filterValues)
      } else if (typeof filterValues === 'string') {
        filteredItems = filterByString(filteredItems, filterField, filterValues)
      } else if (typeof filterValues === 'object' && filterValues !== null) {
        filteredItems = filterByObject(
          filteredItems,
          filterField,
          filterValues as FilterValues
        )
      }
    })

    return filteredItems
  }, [filteredList, listFilter])

  return { listFilter, filteredItems, setListFilter, setFilteredItems }
}

const filterByArray = (
  filteredItems: FilteredItem[] | null | undefined,
  filterField: string,
  filterValues: FilterValue[]
) => {
  const filteredValues = filterValues.filter((item) => item.value !== 'All')

  if (filteredValues.length === 0) {
    return filteredItems
  }

  return filteredItems?.filter((item) => {
    let itemValue: SubItem
    if (typeof item[filterField] === 'object') {
      itemValue = item[filterField]
      if (Array.isArray(itemValue)) {
        return itemValue.some((item: SubItem) =>
          filteredValues.some(
            (filterValue: FilterValue) => filterValue.value === item.value
          )
        )
      } else {
        return filteredValues.some(
          (value: SubItem) => value.value === itemValue.value
        )
      }
    } else {
      itemValue = item[filterField]
      return filteredValues.some((value: SubItem) => value.value === itemValue)
    }
  })
}

const filterByString = (
  filteredItems: FilteredItem[] | null | undefined,
  filterField: string,
  filterValues: string
) => {
  const filterWords = filterValues.toLowerCase().split(' ')
  return filteredItems?.filter((item) => {
    const itemValue = item[filterField].toLowerCase()
    return filterWords.every((word) => itemValue.includes(word))
  })
}

const filterByObject = (
  filteredItems: FilteredItem[] | null | undefined,
  filterField: string,
  filterValues: FilterValues
) => {
  return filteredItems?.filter((item) => {
    return Object.entries(filterValues).every(([valueField, fieldValues]) => {
      if (Array.isArray(fieldValues)) {
        const filteredFieldValues = fieldValues.filter(
          (field) => field.value !== 'All'
        )
        if (filteredFieldValues.length === 0) {
          return true
        }

        if (!item[filterField] || !item[filterField][valueField]) {
          return false
        }

        const itemValue =
          item[filterField][valueField] &&
          Array.isArray(item[filterField][valueField])
            ? item[filterField][valueField].map(
                (subItem: SubItem) => subItem.value
              )
            : item[filterField][valueField].value

        return filteredFieldValues.some((field) => {
          const fieldValue = Array.isArray(field.value)
            ? field.value
            : [field.value]
          return fieldValue.some((value) => itemValue.includes(value))
        })
      }
      return false
    })
  })
}

export default useFilteredList
