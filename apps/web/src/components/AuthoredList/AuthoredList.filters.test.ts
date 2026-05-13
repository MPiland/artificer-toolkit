import type { AuthoredListFilter } from './AuthoredList.types'
import { getFacetedFilterOptionsByKey, itemMatchesQuery, type AuthoredListFilterValues } from './AuthoredList.filters'
import { spellListFilters, spellListItems } from './spellList.fixtures'

const emptyFilterValues: AuthoredListFilterValues = {
  school: null,
  level: null,
  class: null
}

function getOptions(filterValues: AuthoredListFilterValues, normalizedQuery = '') {
  return getFacetedFilterOptionsByKey({
    filters: spellListFilters,
    filterValues,
    items: spellListItems,
    normalizedQuery
  })
}

function optionValues(options: AuthoredListFilter['options']) {
  return options.map((option) => option.value)
}

describe('AuthoredList faceted filters', () => {
  it('matches query text against names, descriptions, and curated search text only', () => {
    const item = {
      ...spellListItems[0],
      name: 'Arcane Lock',
      description: 'Seals a door or container.',
      searchText: 'ward security threshold',
      attributes: { school: 'Abjuration' },
      badges: ['Wizard']
    }

    expect(itemMatchesQuery(item, 'arcane')).toBe(true)
    expect(itemMatchesQuery(item, 'container')).toBe(true)
    expect(itemMatchesQuery(item, 'threshold')).toBe(true)
    expect(itemMatchesQuery(item, 'abjuration')).toBe(false)
    expect(itemMatchesQuery(item, 'wizard')).toBe(false)
  })

  it('narrows filter options from other active filters', () => {
    const options = getOptions({ ...emptyFilterValues, level: '2' })

    expect(optionValues(options.class)).toEqual(['Cleric', 'Sorcerer', 'Warlock', 'Wizard'])
    expect(optionValues(options.school)).toEqual(['Abjuration', 'Conjuration'])
  })

  it('narrows level and school options from a selected class', () => {
    const options = getOptions({ ...emptyFilterValues, class: 'Bard' })

    expect(optionValues(options.level)).toEqual(['1', '3'])
    expect(optionValues(options.school)).toEqual(['Evocation'])
  })

  it('uses search text when deriving available filter options', () => {
    const options = getOptions(emptyFilterValues, 'warding')

    expect(optionValues(options.class)).toEqual(['Cleric', 'Wizard'])
    expect(optionValues(options.school)).toEqual(['Abjuration'])
    expect(optionValues(options.level)).toEqual(['2'])
  })

  it('keeps a selected option visible when it no longer matches the remaining result set', () => {
    const options = getOptions({ ...emptyFilterValues, class: 'Bard' }, 'misty')

    expect(optionValues(options.class)).toEqual(['Bard', 'Sorcerer', 'Warlock', 'Wizard'])
    expect(optionValues(options.school)).toEqual([])
    expect(optionValues(options.level)).toEqual([])
  })
})
