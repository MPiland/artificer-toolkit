import { useState, useMemo, useCallback } from 'react'
import { get, isObject, uniq } from 'lodash'

const useSortableData = (items, config = null) => {
  const [sortConfig, setSortConfig] = useState(config)

  const compareValues = useCallback((aValue, bValue, direction) => {
    if (aValue == null && bValue == null && bValue !== 0 && aValue !== 0)
      return 0
    if (aValue == null && aValue !== 0 && !!bValue)
      return direction === 'ascending' ? -1 : 1
    if (bValue == null && bValue !== 0 && !!bValue)
      return direction === 'ascending' ? 1 : -1

    if (typeof aValue === 'number' && typeof bValue === 'number') {
      return direction === 'ascending'
        ? aValue > bValue
          ? 1
          : aValue < bValue || !aValue
          ? -1
          : 0
        : aValue < bValue
        ? 1
        : aValue > bValue || !aValue
        ? -1
        : 0
    } else {
      return direction === 'ascending'
        ? aValue.localeCompare(bValue)
        : bValue.localeCompare(aValue)
    }
  }, [])

  const hierarchyOrderSort = useCallback(
    (order, direction) => {
      return order.sort((a, b) => {
        const aValue = isObject(a) ? Object.keys(a)[0] : a
        const bValue = isObject(b) ? Object.keys(b)[0] : b
        return compareValues(aValue, bValue, direction)
      })
    },
    [compareValues]
  )

  const recursiveSort = useCallback(
    (items, key, direction) => {
      let sortableItems = []
      let nullArray = []
      const { orderKey, order, sortOn, subSort } = key

      if (orderKey) {
        order.forEach((orderItem) => {
          const filterKey = isObject(orderItem)
            ? Object.values(orderItem)[0]
            : orderItem
          const filteredArray = items.filter(
            (item) => get(item, orderKey) === filterKey
          )

          nullArray = items.filter((item) => get(item, orderKey) == null)
          const lowerArray = filteredArray.sort((a, b) => {
            const aValue = get(a, sortOn)
            const bValue = get(b, sortOn)

            const compareResult = compareValues(aValue, bValue, direction)
            if (compareResult === 0 && subSort) {
              const aValueSub = get(a, subSort.orderKey)
              const bValueSub = get(b, subSort.orderKey)

              const aSubIndex = subSort.order.findIndex(
                (orderItem) => orderItem === aValueSub
              )
              const bSubIndex = subSort.order.findIndex(
                (orderItem) => orderItem === bValueSub
              )

              if (aSubIndex === bSubIndex && subSort.sortOn) {
                const aValueSortOn = get(a, subSort.sortOn)
                const bValueSortOn = get(b, subSort.sortOn)

                return compareValues(aValueSortOn, bValueSortOn, direction)
              } else {
                return aSubIndex > bSubIndex ? 1 : -1
              }
            }
            return compareResult
          })

          sortableItems.push(...lowerArray)
        })
        sortableItems.push(...nullArray)
      } else {
        sortableItems = items.sort((a, b) => {
          const aValue = get(a, sortOn)
          const bValue = get(b, sortOn)
          return compareValues(aValue, bValue, direction)
        })
      }
      return sortableItems
    },
    [compareValues]
  )

  const sortedItems = useMemo(() => {
    let sortableItems = []

    if (items != null && items.length > 0) {
      if (sortConfig !== null) {
        const { key, direction } = sortConfig

        if (key?.orderKey) {
          if (!key.order) {
            key.order = uniq(
              items.map((item) => get(item, key.orderKey))
            ).filter((orderItem) => orderItem != null)
            if (key.subSort && !key.subSort.order) {
              key.subSort.order = uniq(
                items.map((item) => get(item, key.subSort.orderKey))
              ).filter((orderItem) => orderItem != null)
            }
          }
          key.subSort?.order && hierarchyOrderSort(key.subSort.order, direction)
          hierarchyOrderSort(key.order, direction)
          sortableItems = recursiveSort(items, key, direction)
        } else if (key) {
          sortableItems = [...items]
          sortableItems.sort((a, b) => {
            const aValue = get(a, key.sortOn)
            const bValue = get(b, key.sortOn)

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
              return compareValues(aValue, bValue, direction)
            }
          })
        }
      } else {
        sortableItems = [...items]
      }
      return sortableItems
    } else {
      return items
    }
  }, [items, sortConfig, recursiveSort, compareValues, hierarchyOrderSort])

  const requestSort = (key) => {
    let direction = 'ascending'

    if (sortConfig && sortConfig.key === key) {
      direction =
        sortConfig.direction === 'ascending' ? 'descending' : 'ascending'
    }
    setSortConfig({ key, direction })
  }

  return { items: sortedItems, requestSort, sortConfig }
}

export default useSortableData
