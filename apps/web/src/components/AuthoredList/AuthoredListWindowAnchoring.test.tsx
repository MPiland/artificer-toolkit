import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import { AuthoredListPage } from './AuthoredListPage'
import type { AuthoredListCatalogWindow, AuthoredListItem } from './AuthoredList.types'

const virtualizer = vi.hoisted(() => ({
  measure: vi.fn(),
  scrollToOffset: vi.fn(),
  getOffsetForIndex: vi.fn((index: number) => [index * 64, 'start']),
  getVirtualItems: () =>
    Array.from({ length: 20 }, (_, offset) => ({
      index: offset + 192,
      start: (offset + 192) * 64,
      end: (offset + 193) * 64
    })),
  getTotalSize: () => 240 * 64
}))
vi.mock('@tanstack/react-virtual', () => ({ useVirtualizer: () => virtualizer }))
vi.mock('./AuthoredCatalogueSearch', () => ({ AuthoredCatalogueSearch: () => null }))

describe('catalogue window scroll anchoring', () => {
  it('restores the old visible row and within-row offset before reading its replacement index', () => {
    const items: AuthoredListItem[] = Array.from({ length: 288 }, (_, index) => ({
      id: String(index + 1),
      publicId: String(index + 1),
      name: `Background ${index + 1}`,
      sourceLabel: 'SRD',
      sourceKind: 'master',
      permissions: { canView: true, canCopy: true, canEdit: false, canDelete: false }
    }))
    const catalog: AuthoredListCatalogWindow = {
      activeCount: 288,
      totalCount: 288,
      controls: {
        query: '',
        sort: 'name',
        filterValues: {},
        onQueryChange: vi.fn(),
        onSortChange: vi.fn(),
        onFilterChange: vi.fn(),
        onClearFilters: vi.fn()
      },
      fetchNextPage: vi.fn(),
      fetchPreviousPage: vi.fn(),
      hasNextPage: false,
      hasPreviousPage: false,
      isFetchingNextPage: false,
      isFetchingPreviousPage: false
    }
    const renderList = (start: number) => (
      <AuthoredListPage
        title='Backgrounds'
        summary='288 backgrounds'
        createLabel='Create Background'
        filters={[]}
        items={items.slice(start, start + 240)}
        catalog={catalog}
      />
    )
    const { rerender } = renderWithAppProviders(renderList(0))
    const viewport = screen.getByRole('table', { name: 'Authored content table' }).parentElement!
    viewport.scrollTop = 200 * 64 + 13
    fireEvent.scroll(viewport)
    rerender(renderList(0))
    virtualizer.scrollToOffset.mockClear()
    rerender(renderList(48))
    expect(virtualizer.getOffsetForIndex).toHaveBeenLastCalledWith(152, 'start')
    expect(virtualizer.scrollToOffset).toHaveBeenLastCalledWith(152 * 64 + 13)
  })
})
