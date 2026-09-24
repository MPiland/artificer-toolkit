import { describe, expect, it } from 'vitest'
import { backgroundListResponseFixture } from '#domains/backgrounds/background.fixtures'
import { mapAuthoredCatalogueItems } from '../authoredCatalogue'
import { buildBackgroundListFilters } from './backgroundListMapper'

describe('backgroundListMapper', () => {
  it('maps provenance and permissions into authored-list display items', () => {
    const items = mapAuthoredCatalogueItems(
      backgroundListResponseFixture.items.map((item) => ({
        ...item,
        status: 'ACTIVE',
        description: item.description ?? null
      })),
      'BACKGROUND'
    )

    expect(items).toHaveLength(2)
    expect(items[0]).toMatchObject({
      id: 'acolyte',
      name: 'Acolyte',
      sourceKind: 'master',
      sourceLabel: 'SRD',
      permissions: {
        canEdit: false,
        canCopy: true,
        canDelete: false
      }
    })
    expect(items[1]).toMatchObject({
      id: 'urban-investigator',
      sourceKind: 'owned',
      sourceLabel: 'Homebrew',
      permissions: {
        canEdit: true,
        canCopy: true,
        canDelete: true
      }
    })
  })

  it('builds source filters without a legacy list response', () => {
    expect(buildBackgroundListFilters()).toEqual([expect.objectContaining({ key: 'source' })])
  })
})
