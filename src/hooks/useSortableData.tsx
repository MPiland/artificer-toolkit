import { useState, useMemo, useCallback } from 'react'
import { PropertyPath, get, isObject, uniq } from 'lodash'
import { SortConfig } from '../utils/types'

interface UseSortableDataProps {
  items: any[]
  config?: SortConfig | null
}

interface UseSortableDataResult {
  items: any
  requestSort: (key: SortConfig['key']) => void
  sortConfig: SortConfig | null
}

const useSortableData = (
  items: UseSortableDataProps['items'],
  config: UseSortableDataProps['config'] = null
): UseSortableDataResult => {
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(config)

  const compareValues = useCallback(
    (aValue: any, bValue: any, direction: SortConfig['direction']): number => {
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
        if (aValue != null && bValue == null) {
          return direction === 'ascending' ? 1 : -1
        } else if (aValue == null && bValue != null) {
          return direction === 'ascending' ? -1 : 1
        } else {
          return direction === 'ascending'
            ? String(aValue).localeCompare(String(bValue))
            : String(bValue).localeCompare(String(aValue))
        }
      }
    },
    []
  )

  const hierarchyOrderSort = useCallback(
    (order: any[], direction: SortConfig['direction']): any[] => {
      return order.sort((a, b) => {
        const aValue = isObject(a) ? Object.keys(a)[0] : a
        const bValue = isObject(b) ? Object.keys(b)[0] : b
        return compareValues(aValue, bValue, direction)
      })
    },
    [compareValues]
  )

  const recursiveSort = useCallback(
    (
      items: any[],
      key: SortConfig['key'],
      direction: SortConfig['direction']
    ): any[] => {
      let sortableItems: any[] = []
      let nullArray: any[] = []
      const { orderKey, order, sortOn, subSort } = key

      if (orderKey && order) {
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
              let aValueSub: any = null
              let bValueSub: any = null
              let aSubIndex: number | null = null
              let bSubIndex: number | null = null
              if (subSort.orderKey) {
                aValueSub = get(a, subSort.orderKey)
                bValueSub = get(b, subSort.orderKey)
              }

              if (subSort.order) {
                aSubIndex = subSort.order.findIndex(
                  (orderItem) => orderItem === aValueSub
                )
                bSubIndex = subSort.order.findIndex(
                  (orderItem) => orderItem === bValueSub
                )
              }

              if (
                (aSubIndex === bSubIndex || (!aSubIndex && !bSubIndex)) &&
                subSort.sortOn
              ) {
                const aValueSortOn = get(a, subSort.sortOn)
                const bValueSortOn = get(b, subSort.sortOn)

                return compareValues(aValueSortOn, bValueSortOn, direction)
              } else if (aSubIndex && bSubIndex) {
                return aSubIndex > bSubIndex ? 1 : -1
              }
            }
            return compareResult
          })

          sortableItems.push(...lowerArray)
        })
        sortableItems.push(...nullArray)
      } else {
        sortableItems = [...items]
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
    let sortableItems: any[] = []

    if (items != null && items.length > 0) {
      sortableItems = [...items]
      if (sortConfig && sortConfig.key.filter) {
        sortableItems.filter((item) => {
          const filter = sortConfig.key.filter
          if (filter && filter.filterOn) {
            const value = get(item, filter.filterOn)
            return value === filter.filterKey
          } else {
            return true // Keep the item if no filterOn is provided
          }
        })
      }
      if (sortConfig !== null) {
        const { key, direction } = sortConfig
        if (key) {
          if (key?.orderKey) {
            if (!key.order) {
              key.order = uniq(
                sortableItems.map((item) =>
                  get(item, key.orderKey as PropertyPath)
                )
              ).filter((orderItem) => orderItem != null)
              if (key?.subSort && !key.subSort.order) {
                key.subSort.order = uniq(
                  sortableItems.map((item) =>
                    get(item, key.subSort?.orderKey as PropertyPath)
                  )
                ).filter((orderItem) => orderItem != null)
              }
              key.subSort?.order &&
                hierarchyOrderSort(key.subSort.order, direction)
            }
            hierarchyOrderSort(key.order, direction)
            return (sortableItems = recursiveSort(
              sortableItems,
              key,
              direction
            ))
          }
          sortableItems.sort((a, b) => {
            const aValue = get(a, key.sortOn)
            const bValue = get(b, key.sortOn)

            if (
              ((!aValue && aValue !== 0) || aValue.length < 1) &&
              ((!bValue && bValue !== 0) || bValue.length < 1)
            ) {
              return 0
            }
            if (((!aValue && aValue !== 0) || aValue.length < 1) && bValue) {
              return 1
            }
            if (aValue && ((!bValue && bValue !== 0) || bValue.length < 1)) {
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
                  sortedAValue[i].value === sortedBValue[i].value
                    ? 0
                    : sortConfig.direction === 'ascending'
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
      }
    }
    return sortableItems
  }, [sortConfig, recursiveSort, compareValues, hierarchyOrderSort, items])

  const requestSort = (key: SortConfig['key']) => {
    let direction: SortConfig['direction'] = 'ascending'

    if (sortConfig && sortConfig.key === key) {
      direction =
        sortConfig.direction === 'ascending' ? 'descending' : 'ascending'
    }
    setSortConfig({ key, direction })
  }

  return { items: sortedItems, requestSort, sortConfig }
}

export default useSortableData
