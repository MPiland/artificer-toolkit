import { api } from '@artificer-toolkit/apis/convex/api'
import type { AuthoredCatalogueReadInput } from '@artificer-toolkit/schema/api/authoredCatalogue'
import type { AuthoredDraftSummaryDto } from '@artificer-toolkit/schema/api/content'
import { convexQuery } from '@convex-dev/react-query'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useNativeAuthoredCatalogWindow } from './useNativeAuthoredCatalogWindow'

const mocks = vi.hoisted(() => ({ window: vi.fn(), drafts: vi.fn(), loadMore: vi.fn() }))
vi.mock('#app/data/useAuthoredCatalogueWindow', () => ({
  useAuthoredCatalogueWindow: mocks.window
}))
vi.mock('convex/react', () => ({ usePaginatedQuery: mocks.drafts }))

const clients: QueryClient[] = []
afterEach(() => clients.splice(0).forEach((client) => client.clear()))
beforeEach(() => {
  vi.clearAllMocks()
  mocks.window.mockReturnValue({
    items: [],
    isPending: false,
    isError: false,
    hasNextPage: true,
    hasPreviousPage: false,
    isFetchingNextPage: false,
    isFetchingPreviousPage: false,
    fetchNextPage: vi.fn(),
    fetchPreviousPage: vi.fn()
  })
  mocks.drafts.mockReturnValue({ results: [], status: 'Exhausted', loadMore: mocks.loadMore })
})

function setup(
  fail = false,
  subjectKind: AuthoredCatalogueReadInput['subjectKind'] = 'BACKGROUND'
) {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        queryFn: ({ queryKey }) => {
          if (fail) throw new Error('Summary unavailable')
          const args = queryKey[2] as { source?: string }
          return {
            activeCount: 101,
            masterCount: 80,
            ownedCount: 21,
            totalCount: args.source === 'OWNED' ? 21 : 101,
            categories: [],
            spellFacets: {
              classes: [{ id: 'wizard', label: 'Wizard' }],
              levels: [{ id: 1 }],
              schools: [{ id: 'evocation', label: 'Evocation' }]
            }
          }
        }
      }
    }
  })
  clients.push(client)
  const hook = renderHook(() => useNativeAuthoredCatalogWindow(subjectKind), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    )
  })
  return { ...hook, client }
}

describe('native authored catalogue listing', () => {
  it.each(['CLASS', 'RACE'] as const)(
    'selects family order for %s browsing without changing the visible name-sort control',
    async (subjectKind) => {
      const hook = setup(false, subjectKind)
      await waitFor(() => expect(hook.result.current.loading).toBe(false))
      expect(hook.result.current.catalog.controls.sort).toBe('name')
      expect(mocks.window).toHaveBeenLastCalledWith({
        subjectKind,
        source: undefined,
        category: undefined,
        sort: 'family'
      })
      act(() => hook.result.current.catalog.controls.onSortChange('category'))
      expect(mocks.window).toHaveBeenLastCalledWith({
        subjectKind,
        source: undefined,
        category: undefined,
        sort: 'category'
      })
      act(() => hook.result.current.catalog.controls.onSortChange('name'))
      expect(mocks.window).toHaveBeenLastCalledWith({
        subjectKind,
        source: undefined,
        category: undefined,
        sort: 'family'
      })
    }
  )
  it.each([
    ['EQUIPMENT', 'WEAPON', 'Weapon'],
    ['CREATURE', 'NPC', 'NPC'],
    ['VEHICLE', 'SPELLJAMMER', 'Spelljammer']
  ] as const)(
    'forwards %s category filters/sort and formats active and draft categories',
    async (subjectKind, category, label) => {
      mocks.window.mockReturnValue({
        ...mocks.window(),
        items: [
          {
            id: '00000000-0000-4000-8000-000000000001',
            publicId: 'item',
            label: 'Item',
            category,
            description: null,
            provenance: { kind: 'MASTER' },
            permissions: { canEdit: false, canCopy: true }
          }
        ]
      })
      mocks.drafts.mockReturnValue({
        results: [
          {
            subjectId: '00000000-0000-4000-8000-000000000001',
            publicId: 'draft',
            label: 'Draft',
            category,
            description: null
          }
        ],
        status: 'Exhausted',
        loadMore: mocks.loadMore
      })
      const hook = setup(false, subjectKind)
      await waitFor(() => expect(hook.result.current.loading).toBe(false))
      act(() => {
        hook.result.current.catalog.controls.onFilterChange('category', category)
        hook.result.current.catalog.controls.onSortChange('category')
      })
      await waitFor(() => expect(hook.result.current.loading).toBe(false))
      expect(mocks.window).toHaveBeenLastCalledWith({
        subjectKind,
        source: undefined,
        category,
        sort: 'category'
      })
      expect(
        hook.client.getQueryData(
          convexQuery(api.content.catalogue.summary, { subjectKind, category }).queryKey
        )
      ).toBeDefined()
      expect(hook.result.current.draftItems[0]?.attributes).toEqual({ Category: label })
      expect(hook.result.current.items[0]).toMatchObject({
        attributes: { Category: label },
        sourceKind: 'master',
        permissions: { canEdit: false, canCopy: true }
      })
    }
  )
  it('keeps global totals independent of the retained rows and scopes native reads to the selected source', async () => {
    const hook = setup()
    await waitFor(() => expect(hook.result.current.loading).toBe(false))
    expect(hook.result.current.items).toEqual([])
    expect(hook.result.current.catalog.activeCount).toBe(101)
    expect(hook.result.current.catalog.totalCount).toBe(101)
    act(() => hook.result.current.catalog.controls.onFilterChange('source', 'OWNED'))
    await waitFor(() => expect(hook.result.current.catalog.totalCount).toBe(21))
    expect(hook.result.current.catalog.activeCount).toBe(101)
    expect(mocks.window).toHaveBeenLastCalledWith({
      subjectKind: 'BACKGROUND',
      source: 'OWNED',
      category: undefined,
      sort: undefined
    })
    expect(
      hook.client.getQueryData(
        convexQuery(api.content.catalogue.summary, { subjectKind: 'BACKGROUND', source: 'OWNED' })
          .queryKey
      )
    ).toHaveProperty('totalCount', 21)
    act(() => hook.result.current.catalog.controls.onQueryChange('ward'))
    expect(mocks.window).toHaveBeenLastCalledWith({
      subjectKind: 'BACKGROUND',
      source: 'OWNED',
      category: undefined,
      sort: undefined
    })
    act(() => hook.result.current.catalog.controls.onClearFilters())
    expect(hook.result.current.catalog.controls.filterValues).toEqual({})
  })

  it('forwards Spell filters and sort values to native list and summary reads', async () => {
    const hook = setup(false, 'SPELL')
    await waitFor(() => expect(hook.result.current.loading).toBe(false))
    act(() => {
      hook.result.current.catalog.controls.onFilterChange('class', 'wizard')
      hook.result.current.catalog.controls.onFilterChange('level', '1')
      hook.result.current.catalog.controls.onFilterChange('school', 'evocation')
      hook.result.current.catalog.controls.onSortChange('school')
    })
    await waitFor(() =>
      expect(mocks.window).toHaveBeenLastCalledWith({
        subjectKind: 'SPELL',
        classId: 'wizard',
        level: 1,
        magicSchoolId: 'evocation',
        source: undefined,
        category: undefined,
        sort: 'school'
      })
    )
    expect(
      hook.client.getQueryData(
        convexQuery(api.content.catalogue.summary, {
          subjectKind: 'SPELL',
          classId: 'wizard',
          level: 1,
          magicSchoolId: 'evocation'
        }).queryKey
      )
    ).toBeDefined()
  })

  it('loads every separate bounded draft page before declaring the draft count complete', async () => {
    const draft = {
      subjectId: '00000000-0000-4000-8000-000000000001',
      subjectKind: 'BACKGROUND',
      publicId: 'my-draft',
      label: 'My draft',
      description: null
    } satisfies Pick<
      AuthoredDraftSummaryDto,
      'subjectId' | 'subjectKind' | 'publicId' | 'label' | 'description'
    >
    mocks.drafts.mockReturnValue({
      results: [draft],
      status: 'CanLoadMore',
      loadMore: mocks.loadMore
    })
    const hook = setup()
    await waitFor(() => expect(hook.result.current.loading).toBe(false))
    expect(hook.result.current.draftLoading).toBe(true)
    expect(mocks.loadMore).toHaveBeenCalledWith(48)
    expect(mocks.drafts).toHaveBeenCalledWith(
      api.content.drafts.list,
      { subjectKind: 'BACKGROUND' },
      { initialNumItems: 48 }
    )
    mocks.drafts.mockReturnValue({
      results: [draft, { ...draft, subjectId: '00000000-0000-4000-8000-000000000002' }],
      status: 'Exhausted',
      loadMore: mocks.loadMore
    })
    hook.rerender()
    expect(hook.result.current.draftLoading).toBe(false)
    expect(hook.result.current.draftItems).toHaveLength(2)
    expect(hook.result.current.draftItems[0]).toMatchObject({
      contentState: 'draft',
      name: 'My draft',
      permissions: { canCopy: false, canDelete: true }
    })
  })

  it('surfaces native summary errors without a legacy fallback', async () => {
    const hook = setup(true)
    await waitFor(() => expect(hook.result.current.error).toBe('Could not load this catalogue.'))
    expect(hook.result.current.loading).toBe(false)
  })
})
