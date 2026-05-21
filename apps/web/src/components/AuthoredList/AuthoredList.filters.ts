import type { AuthoredListFilter, AuthoredListItem } from './AuthoredList.types'

export type AuthoredListFilterValues = Record<string, string | null>

export function itemMatchesQuery(item: AuthoredListItem, normalizedQuery: string) {
  if (normalizedQuery.length === 0) return true

  const attributeText = Object.values(item.attributes ?? {}).flatMap((value) => {
    if (!value) return []
    return Array.isArray(value) ? value : [value]
  })
  const searchable = [
    item.name,
    item.description,
    item.searchText,
    ...attributeText,
    ...(item.badges ?? [])
  ]
    .filter((value): value is string => Boolean(value))
    .join(' ')
    .toLowerCase()

  return searchable.includes(normalizedQuery)
}

export function itemMatchesSelectedFilters(
  item: AuthoredListItem,
  filters: AuthoredListFilter[],
  filterValues: AuthoredListFilterValues,
  excludedFilterKey?: string
) {
  return filters.every((filter) => {
    if (filter.key === excludedFilterKey) return true

    const selected = filterValues[filter.key]
    if (!selected) return true

    return getItemFilterValues(item, filter.key).includes(selected)
  })
}

export function getItemFilterValues(item: AuthoredListItem, filterKey: string) {
  const value = item.filterValues?.[filterKey]

  if (!value) return []

  return Array.isArray(value) ? value : [value]
}

export function getFacetedFilterOptions({
  filter,
  filters,
  filterValues,
  items,
  normalizedQuery
}: {
  filter: AuthoredListFilter
  filters: AuthoredListFilter[]
  filterValues: AuthoredListFilterValues
  items: AuthoredListItem[]
  normalizedQuery: string
}) {
  const selected = filterValues[filter.key]
  const availableValues = new Set<string>()

  for (const item of items) {
    if (!itemMatchesQuery(item, normalizedQuery)) continue
    if (!itemMatchesSelectedFilters(item, filters, filterValues, filter.key)) continue

    for (const value of getItemFilterValues(item, filter.key)) {
      availableValues.add(value)
    }
  }

  return filter.options.filter((option) => availableValues.has(option.value) || option.value === selected)
}

export function getFacetedFilterOptionsByKey({
  filters,
  filterValues,
  items,
  normalizedQuery
}: {
  filters: AuthoredListFilter[]
  filterValues: AuthoredListFilterValues
  items: AuthoredListItem[]
  normalizedQuery: string
}) {
  return filters.reduce<Record<string, AuthoredListFilter['options']>>((optionsByKey, filter) => {
    optionsByKey[filter.key] = getFacetedFilterOptions({
      filter,
      filters,
      filterValues,
      items,
      normalizedQuery
    })

    return optionsByKey
  }, {})
}
