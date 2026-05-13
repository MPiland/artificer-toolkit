import { describe, expect, it } from 'vitest'
import { featListResponseFixture } from '#domains/feats/feat.fixtures'
import {
  buildFeatListFilters,
  mapFeatListToAuthoredItems,
  summarizeFeatList
} from './featListMapper'

describe('featListMapper', () => {
  it('maps provenance and permissions into authored-list display items', () => {
    const items = mapFeatListToAuthoredItems(featListResponseFixture)

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

  it('builds source filters and a concrete summary', () => {
    expect(buildFeatListFilters(featListResponseFixture)).toEqual([
      expect.objectContaining({ key: 'source' })
    ])
    expect(summarizeFeatList(featListResponseFixture)).toBe('2 feats / 1 SRD / 1 homebrew')
  })
})
