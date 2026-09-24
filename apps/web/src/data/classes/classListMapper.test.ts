import { describe, expect, it } from 'vitest'
import { mapAuthoredCatalogueItems } from '../authoredCatalogue'
import { classListFixture } from '#domains/classes/class.fixtures'
import { buildClassListFilters, formatClassCategory } from './classListMapper'

describe('class list mapper', () => {
  it('maps catalogue rows with formatted categories and parent hierarchy', () => {
    const parentId = classListFixture.items[0].id
    const items = mapAuthoredCatalogueItems(
      classListFixture.items.map((item) => ({
        ...item,
        status: 'ACTIVE',
        description: item.description ?? null,
        ...(item.category === 'SUBCLASS'
          ? { parentClassId: parentId, parentClassLabel: 'Parent' }
          : {})
      })),
      'CLASS'
    )

    expect(items[0]).toMatchObject({ attributes: { Category: 'Base Class' } })
    expect(items[1]).toMatchObject({
      attributes: { Category: 'Subclass' },
      hierarchy: { level: 1, parentId, parentLabel: 'Parent' }
    })
  })

  it('builds filters from catalogue facets', () => {
    expect(buildClassListFilters(['BASE', 'SUBCLASS'])[0]?.options).toEqual([
      { value: 'BASE', label: 'Base Class' },
      { value: 'SUBCLASS', label: 'Subclass' }
    ])
    expect(formatClassCategory(undefined)).toBe('Uncategorized')
  })
})
