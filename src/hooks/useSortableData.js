import { useState, useMemo } from 'react'
import { get } from 'lodash'

const useSortableData = (items, config = null) => {
  const [sortConfig, setSortConfig] = useState(config)

  const sortedItems = useMemo(() => {
    let sortableItems = []
    if (sortConfig !== null) {
      if (Array.isArray(sortConfig.key)) {
        const sortKeyNameArray = sortConfig.key[1]

        sortKeyNameArray.forEach((keyObject) => {
          const keyValue = Object.values(keyObject)[0]
          const lowerArray = items.filter((item) => {
            return get(item, sortConfig.key[2]) === keyValue
          })
          lowerArray.sort((a, b) => {
            if (get(a, sortConfig.key[0][0]) < get(b, sortConfig.key[0][0])) {
              return sortConfig.direction === 'ascending' ? -1 : 1
            } else if (
              get(a, sortConfig.key[0][0]) > get(b, sortConfig.key[0][0])
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

          if (
            (!aValue || aValue.length < 1) &&
            (!bValue || bValue.length < 1)
          ) {
            return 0
          }
          if ((!aValue || aValue.length < 1) && bValue) {
            return 1
          }
          if (aValue && (!bValue || bValue.length < 1)) {
            return -1
          }

          if (Array.isArray(aValue) && Array.isArray(bValue)) {
            const sortedAValue =
              aValue.length > 1
                ? aValue
                    .slice()
                    .sort((x, y) =>
                      String(x.value).localeCompare(String(y.value))
                    )
                : aValue
            const sortedBValue =
              bValue.length > 1
                ? bValue
                    .slice()
                    .sort((x, y) =>
                      String(x.value).localeCompare(String(y.value))
                    )
                : bValue

            for (
              let i = 0;
              i < Math.min(sortedAValue.length, sortedBValue.length);
              i++
            ) {
              const comparisonResult =
                sortConfig.direction === 'ascending'
                  ? sortedAValue[i].value > sortedBValue[i].value
                    ? 1
                    : -1
                  : sortedBValue[i].value > sortedAValue[i].value
                  ? 1
                  : -1
              if (comparisonResult !== 0) {
                return comparisonResult
              }
            }

            return sortedAValue.length - sortedBValue.length
          } else {
            if (sortConfig.direction === 'ascending') {
              return String(aValue).localeCompare(String(bValue))
            } else {
              return String(bValue).localeCompare(String(aValue))
            }
          }
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
