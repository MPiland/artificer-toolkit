import { describe, expect, it } from 'vitest'
import { featListResponseFixture } from '#domains/feats/feat.fixtures'
import { mapAuthoredCatalogueItems } from '../authoredCatalogue'
import { buildFeatListFilters } from './featListMapper'

describe('featListMapper', () => {
  it('maps provenance and permissions into authored-list display items', () => {
    const items = mapAuthoredCatalogueItems(
      featListResponseFixture.items.map((item) => ({
        ...item,
        status: 'ACTIVE',
        description: item.description ?? null
      })),
      'FEAT'
    )

    expect(items).toHaveLength(2)
    expect(items[0]).toMatchObject({
      id: 'grappler',
      name: 'Grappler',
      sourceKind: 'master',
      sourceLabel: 'SRD',
      permissions: {
        canEdit: false,
        canCopy: true,
        canDelete: false
      }
    })
    expect(items[1]).toMatchObject({
      id: 'battlefield-reader',
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
    expect(buildFeatListFilters()).toEqual([expect.objectContaining({ key: 'source' })])
  })
})
