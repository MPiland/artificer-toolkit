import { useState, useMemo } from 'react'
import { get } from 'lodash'

const useSortableData = (items, config = null) => {
  const [sortConfig, setSortConfig] = useState(config)

  const sortedItems = useMemo(() => {
    let sortableItems = []
    if (sortConfig !== null) {
      if (Array.isArray(sortConfig.key)) {
        console.log('array')
        const sortKeyNameArray = sortConfig.key[1]
        sortableItems = []

        sortKeyNameArray.forEach((keyObject) => {
          const keyValue = Object.values(keyObject)[0]
          const lowerArray = items.filter((item) => {
            return get(item, sortConfig.key[2]) === keyValue
          })
          lowerArray.sort((a, b) => {
            if (get(a, sortConfig.key[0][0]) < get(b, sortConfig.key[0][0])) {
              return sortConfig.direction === 'ascending' ? -1 : 1
            } else if (
              get(a, sortConfig.key[0][0]) > get(b, sortConfig.key[0][0]) // Corrected condition
            ) {
              return sortConfig.direction === 'ascending' ? 1 : -1
            }
            return 0
          })
          sortableItems.push(...lowerArray)
        })
      } else {
        sortableItems = [...items]
        sortableItems.sort((a, b) => {
          const aValue = get(a, sortConfig.key)
          const bValue = get(b, sortConfig.key)

          if (aValue === undefined || aValue === null) {
            return sortConfig.direction === 'ascending'
              ? bValue === undefined || bValue === null
                ? 0
                : -1
              : 1
          }
          if (bValue === undefined || bValue === null) {
            return sortConfig.direction === 'ascending'
              ? 1
              : aValue === undefined || aValue === null
              ? 0
              : -1
          }

          if (aValue < bValue) {
            return sortConfig.direction === 'ascending' ? -1 : 1
          }
          if (aValue > bValue) {
            return sortConfig.direction === 'ascending' ? 1 : -1
          }
          return 0
        })
      }
      return sortableItems
    } else {
      return (sortableItems = items)
    }
  }, [items, sortConfig])

  const requestSort = (key, order) => {
    let direction = 'ascending'

    if (sortConfig && sortConfig.direction === 'ascending') {
      direction = 'descending'
    }

    let hierarchyOrder = []
    let sortHierarchyKey

    if (order && order.length > 1) {
      hierarchyOrder = order[1]
      console.log('hierarchyOrder', hierarchyOrder)
      hierarchyOrder.sort((a, b) => {
        if (Object.keys(a)[0] < Object.keys(b)[0]) {
          return direction === 'ascending' ? -1 : 1
        }
        if (Object.keys(a)[0] > Object.keys(b)[0]) {
          return direction === 'ascending' ? 1 : -1
        }
        return 0
      })
      sortHierarchyKey = key[order[0].value - 1]
      setSortConfig({ key: [key, hierarchyOrder, sortHierarchyKey], direction })
    } else {
      setSortConfig({ key, direction })
    }
  }

  return { items: sortedItems, requestSort, sortConfig }
}

export default useSortableData
