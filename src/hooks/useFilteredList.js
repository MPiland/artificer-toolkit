import { useState, useMemo, useReducer } from 'react'
import formReducer from './useReducer'

const useFilteredList = (initialItems, initialFilter = {}) => {
  const [listFilter, setListFilter] = useReducer(formReducer, initialFilter)
  const [filterItems, setFilterItems] = useState(initialItems)

  const filteredList = useMemo(() => {
    if (!listFilter) {
      return filterItems
    }

    let filteredItems = filterItems

    Object.entries(listFilter).forEach(([filterField, filterValues]) => {
      if (Array.isArray(filterValues)) {
        filteredItems = filterByArray(filteredItems, filterField, filterValues)
      } else if (typeof filterValues === 'string') {
        filteredItems = filterByString(filteredItems, filterField, filterValues)
      } else if (typeof filterValues === 'object' && filterValues !== null) {
        filteredItems = filterByObject(filteredItems, filterField, filterValues)
      }
    })

    return filteredItems
  }, [filterItems, listFilter])

  return { listFilter, filteredList, setListFilter, setFilterItems }
}

const filterByArray = (filteredItems, filterField, filterValues) => {
  const filteredValues = filterValues.filter((item) => item.value !== 'All')

  if (filteredValues.length === 0) {
    return filteredItems
  }

  return filteredItems.filter((item) => {
    let itemValue
    if (typeof item[filterField] === 'object') {
      itemValue = item[filterField]
      if (Array.isArray(itemValue)) {
        return itemValue.some((item) =>
          filteredValues.some((filterValue) => filterValue.value === item.value)
        )
      } else {
        return filteredValues.some((value) => value.value === itemValue.value)
      }
    } else {
      itemValue = item[filterField]
      return filteredValues.some((value) => value.value === itemValue)
    }
  })
}

const filterByString = (filteredItems, filterField, filterValues) => {
  const filterWords = filterValues.toLowerCase().split(' ')
  return filteredItems.filter((item) => {
    const itemValue = item[filterField].toLowerCase()
    return filterWords.every((word) => itemValue.includes(word))
  })
}

const filterByObject = (filteredItems, filterField, filterValues) => {
  return filteredItems.filter((item) => {
    return Object.entries(filterValues).every(([valueField, fieldValues]) => {
      if (Array.isArray(fieldValues)) {
        const filteredFieldValues = fieldValues.filter(
          (field) => field.value !== 'All'
        )
        if (filteredFieldValues.length === 0) {
          return true
        }

        const itemValue = Array.isArray(item[filterField][valueField])
          ? item[filterField][valueField].map((subItem) => subItem.value)
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
