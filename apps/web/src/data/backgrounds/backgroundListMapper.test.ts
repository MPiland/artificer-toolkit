import { describe, expect, it } from 'vitest'
import { backgroundListResponseFixture } from '#domains/backgrounds/background.fixtures'
import {
  buildBackgroundListFilters,
  mapBackgroundListToAuthoredItems,
  summarizeBackgroundList
} from './backgroundListMapper'

describe('backgroundListMapper', () => {
  it('maps provenance and permissions into authored-list display items', () => {
    const items = mapBackgroundListToAuthoredItems(backgroundListResponseFixture)

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

  it('builds source filters and a concrete summary', () => {
    expect(buildBackgroundListFilters(backgroundListResponseFixture)).toEqual([
      expect.objectContaining({ key: 'source' })
    ])
    expect(summarizeBackgroundList(backgroundListResponseFixture)).toBe(
      '2 backgrounds / 1 SRD / 1 homebrew'
    )
  })
})
