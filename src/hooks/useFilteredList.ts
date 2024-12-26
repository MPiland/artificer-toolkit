import { useState, useMemo } from 'react'
import { get } from 'lodash'

interface FilteredItem {
  [key: string]: any | any
}

interface FilterValue {
  name: string | number
  value: string | number
  _id: string
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
  _id: string
  value: string | number
  name: string | number
}

const useFilteredList = (
  initialItems: UseFilteredListProps['initialItems'],
  initialFilter: UseFilteredListProps['initialFilter']
) => {
  const [listFilter, setListFilter] = useState<any>(initialFilter)
  const [filteredList, setFilteredItems] = useState<FilteredItem[] | null | undefined>(initialItems)

  const filteredItems = useMemo(() => {
    if (!listFilter) {
      return filteredList
    }

    let filteredItems = filteredList

    Object.entries(listFilter).forEach(([filterField, filterValues]) => {
      console.log({ filterValues })
      if (Array.isArray(filterValues)) {
        filteredItems = filterByArray(filteredItems, filterField, filterValues)
      } else if (typeof filterValues === 'string') {
        filteredItems = filterByString(filteredItems, filterField, filterValues)
      } else if (typeof filterValues === 'object' && filterValues !== null) {
        filteredItems = filterByObject(filteredItems, filterField, filterValues as FilterValues)
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
  const filteredValues = filterValues.filter((item) => item.name !== 'all')

  if (filteredValues.length === 0) {
    return filteredItems
  }

  return filteredItems?.filter((item) => {
    let itemValue: SubItem | string
    if (typeof item[filterField] === 'object') {
      itemValue = get(item, `${filterField}`)
      if (Array.isArray(itemValue)) {
        return itemValue.some((item: SubItem) =>
          filteredValues.some((filterValue: FilterValue) => {
            if (filterValue._id != null) {
              return filterValue._id === item._id
            }
            if (filterValue.value != null) {
              return filterValue.value === item.value
            }
            return false
          })
        )
      } else {
        return filteredValues.some((filterValue: SubItem) => {
          if (filterValue._id != null) {
            return filterValue._id === (itemValue as SubItem)._id
          }
          if (filterValue.value != null) {
            return filterValue.value === (itemValue as SubItem).value
          }
          return false
        })
      }
    } else {
      itemValue = get(item, `${filterField}`)

      return filteredValues.some((filterValue: SubItem) => {
        if (filterValue._id != null) {
          return filterValue._id === itemValue
        }
        if (filterValue.name != null) {
          return filterValue.name === itemValue
        }
        return false
      })
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
  filterValues: FilterValues | FilterValue
) => {
  return filteredItems?.filter((item) => {
    return Object.entries(filterValues).every(([valueField, fieldValues]) => {
      if (Array.isArray(fieldValues)) {
        const filteredFieldValues = fieldValues.filter((field) => field.name !== 'all')

        const itemMatch = get(item, `${filterField}.${valueField}`)

        if (fieldValues.some((value) => value.name === 'all')) {
          if (itemMatch) {
            return true
          } else {
            return false
          }
        }

        if (filteredFieldValues.length === 0) {
          return true
        }

        if (!itemMatch) {
          return false
        }

        const itemValue = Array.isArray(itemMatch) ? itemMatch.map((subItem: SubItem) => subItem._id) : itemMatch._id

        return filteredFieldValues.some((field) => {
          const fieldValue = Array.isArray(field._id) ? field._id : [field._id]
          return fieldValue.some((value: string) => itemValue.includes(value))
        })
      } else {
        return Object.entries(fieldValues).every(([subValueField, subFieldValues]) => {
          if (Array.isArray(subFieldValues)) {
            const filteredFieldValues = subFieldValues.filter((field) => field.name !== 'all')

            const itemMatch = get(item, `${filterField}.${valueField}.${subValueField}`)

            if (subFieldValues.some((value) => value.name === 'all')) {
              if (itemMatch) {
                return true
              } else {
                return false
              }
            }

            if (filteredFieldValues.length === 0) {
              return true
            }

            if (!itemMatch) {
              return false
            }

            const itemValue =
              itemMatch && Array.isArray(itemMatch) ? itemMatch.map((subItem: SubItem) => subItem._id) : itemMatch._id

            return filteredFieldValues.some((field) => {
              const fieldValue = Array.isArray(field._id) ? field._id : [field._id]
              return fieldValue.some((value: string) => itemValue.includes(value))
            })
          }
        })
      }
    })
  })
}

export default useFilteredList
