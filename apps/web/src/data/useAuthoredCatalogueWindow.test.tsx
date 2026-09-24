import { api } from '@artificer-toolkit/apis/convex/api'
import {
  authoredCatalogueReadInputSchema,
  type AuthoredCataloguePage,
  type AuthoredCatalogueReadInput
} from '@artificer-toolkit/schema/api/authoredCatalogue'
import { convexQuery } from '@convex-dev/react-query'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useAuthoredCatalogueWindow } from './useAuthoredCatalogueWindow'
import { getAuthoredCatalogueList } from './authoredCatalogue'

const clients: QueryClient[] = []
afterEach(() => clients.splice(0).forEach((client) => client.clear()))

function item(index: number): AuthoredCataloguePage['page'][number] {
  return {
    id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    publicId: `background-${index}`,
    systemId: '00000000-0000-4000-8000-000000000001',
    label: `Background ${index}`,
    description: null,
    activeUpdatedAt: '2026-09-05T00:00:00.000Z',
    status: 'ACTIVE',
    provenance: { kind: 'MASTER', ownerUserId: null },
    permissions: { canView: true, canEdit: false, canCopy: true, canDelete: false }
  }
}

function setup(
  read?: (
    input: AuthoredCatalogueReadInput
  ) => AuthoredCataloguePage | Promise<AuthoredCataloguePage>
) {
  const rows = Array.from({ length: 384 }, (_, index) => item(index + 1))
  const queryFn = vi.fn(({ queryKey }: { queryKey: readonly unknown[] }) => {
    const input = authoredCatalogueReadInputSchema.parse(queryKey[2])
    if (read) return read(input)
    const { cursor, endCursor, numItems } = input.paginationOpts
    const start = cursor === null ? 0 : Number(cursor)
    const end = endCursor === undefined ? start + numItems : Number(endCursor)
    return {
      page: rows.slice(start, end),
      isDone: end >= rows.length,
      continueCursor: String(end)
    } satisfies AuthoredCataloguePage
  })
  const client = new QueryClient({ defaultOptions: { queries: { queryFn, retry: false } } })
  clients.push(client)
  const hook = renderHook(
    (scope: Omit<AuthoredCatalogueReadInput, 'paginationOpts'>) =>
      useAuthoredCatalogueWindow(scope),
    {
      initialProps: { subjectKind: 'BACKGROUND' },
      wrapper: ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      )
    }
  )
  return { ...hook, client, queryFn }
}

async function next(hook: Pick<ReturnType<typeof setup>, 'result'>) {
  await waitFor(() => expect(hook.result.current.isFetchingNextPage).toBe(false))
  act(() => hook.result.current.fetchNextPage())
  await waitFor(() => expect(hook.result.current.isFetchingNextPage).toBe(false))
}

describe('native catalogue window', () => {
  it('keeps the visible range during its asynchronous fixed-boundary re-read', async () => {
    let complete: ((page: AuthoredCataloguePage) => void) | undefined
    const firstPage = {
      page: Array.from({ length: 48 }, (_, index) => item(index + 1)),
      isDone: false,
      continueCursor: '48'
    }
    const hook = setup(({ paginationOpts }) => {
      if (paginationOpts.endCursor === '48')
        return new Promise((resolve) => {
          complete = resolve
        })
      if (paginationOpts.cursor === null) return firstPage
      return {
        page: Array.from({ length: 48 }, (_, index) => item(index + 49)),
        isDone: false,
        continueCursor: '96'
      }
    })
    await waitFor(() => expect(hook.result.current.items).toHaveLength(48))
    act(() => hook.result.current.fetchNextPage())
    await waitFor(() => expect(hook.result.current.items).toHaveLength(96))
    expect(hook.result.current.items[0]).toEqual(item(1))
    expect(hook.result.current.isPending).toBe(false)
    expect(hook.result.current.isFetchingNextPage).toBe(true)
    await act(async () => complete!(firstPage))
    await waitFor(() => expect(hook.result.current.isFetchingNextPage).toBe(false))
    expect(hook.result.current.items).toHaveLength(96)
  })

  it('evicts the initial page even when the route prefetched it before mounting', async () => {
    const client = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          queryFn: ({ queryKey }) => {
            const { paginationOpts } = authoredCatalogueReadInputSchema.parse(queryKey[2])
            const start = Number(paginationOpts.cursor ?? 0)
            return {
              page: Array.from({ length: 48 }, (_, index) => item(start + index + 1)),
              isDone: false,
              continueCursor: String(start + 48)
            }
          }
        }
      }
    })
    clients.push(client)
    const key = getAuthoredCatalogueList({
      subjectKind: 'BACKGROUND',
      paginationOpts: { cursor: null, numItems: 48 }
    })
    await client.ensureQueryData(key)
    const hook = renderHook(() => useAuthoredCatalogueWindow({ subjectKind: 'BACKGROUND' }), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      )
    })
    for (let index = 0; index < 5; index++) await next(hook)
    await waitFor(() => expect(client.getQueryCache().getAll()).toHaveLength(5))
    expect(client.getQueryData(key.queryKey)).toBeUndefined()
  })

  it('pins range ends, retains at most five subscriptions and reloads evicted rows backward', async () => {
    const hook = setup()
    await waitFor(() => expect(hook.result.current.items).toHaveLength(48))
    for (let index = 0; index < 6; index++) await next(hook)
    expect(hook.result.current.items).toHaveLength(240)
    expect(hook.result.current.items[0]).toEqual(item(97))
    expect(hook.result.current.hasPreviousPage).toBe(true)
    await waitFor(() => expect(hook.client.getQueryCache().getAll()).toHaveLength(5))
    expect(
      hook.client
        .getQueryCache()
        .getAll()
        .every((query) => query.getObserversCount() === 1)
    ).toBe(true)
    act(() => hook.result.current.fetchPreviousPage())
    await waitFor(() => expect(hook.result.current.items[0]).toEqual(item(49)))
    expect(hook.result.current.items).toHaveLength(240)
    expect(
      hook.queryFn.mock.calls.some(([{ queryKey }]) => {
        const input = authoredCatalogueReadInputSchema.parse(queryKey[2])
        return input.paginationOpts.cursor === '48' && input.paginationOpts.endCursor === '96'
      })
    ).toBe(true)
    hook.unmount()
    await waitFor(() => expect(hook.client.getQueryCache().getAll()).toHaveLength(0))
  })

  it('keeps the original range tail when a required split returns a truncated continuation', async () => {
    const hook = setup()
    await next(hook)
    const firstKey = convexQuery(api.content.catalogue.list, {
      subjectKind: 'BACKGROUND',
      paginationOpts: { cursor: null, endCursor: '48', numItems: 48 }
    }).queryKey
    act(() =>
      hook.client.setQueryData(firstKey, {
        page: [item(1)],
        isDone: false,
        continueCursor: '24',
        splitCursor: '12',
        pageStatus: 'SplitRequired'
      } satisfies AuthoredCataloguePage)
    )
    await waitFor(() =>
      expect(
        hook.queryFn.mock.calls.some(([{ queryKey }]) => {
          const input = authoredCatalogueReadInputSchema.parse(queryKey[2])
          return input.paginationOpts.cursor === '12' && input.paginationOpts.endCursor === '48'
        })
      ).toBe(true)
    )
    await waitFor(() =>
      expect(hook.result.current.items).toEqual(
        Array.from({ length: 96 }, (_, index) => item(index + 1))
      )
    )
    expect(hook.result.current.isError).toBe(false)
  })

  it('reflects live inserts and deletes within pinned pages without moving the adjacent boundary', async () => {
    const hook = setup()
    await next(hook)
    const key = convexQuery(api.content.catalogue.list, {
      subjectKind: 'BACKGROUND',
      paginationOpts: { cursor: null, endCursor: '48', numItems: 48 }
    }).queryKey
    act(() =>
      hook.client.setQueryData(key, {
        page: [item(999), ...Array.from({ length: 47 }, (_, index) => item(index + 2))],
        isDone: false,
        continueCursor: '48'
      } satisfies AuthoredCataloguePage)
    )
    await waitFor(() => expect(hook.result.current.items[0]).toEqual(item(999)))
    expect(hook.result.current.items[48]).toEqual(item(49))
    expect(new Set(hook.result.current.items.map((row) => row.id)).size).toBe(96)
  })

  it.each([
    { subjectKind: 'BACKGROUND', source: 'OWNED' },
    { subjectKind: 'BACKGROUND', sort: 'name' },
    { subjectKind: 'BACKGROUND', category: 'changed' }
  ] satisfies Array<Omit<AuthoredCatalogueReadInput, 'paginationOpts'>>)(
    'drops all old rows and cursor history immediately when scope changes to %j',
    async (scope) => {
      const hook = setup()
      await next(hook)
      hook.rerender(scope)
      expect(hook.result.current.items).toEqual([])
      expect(hook.result.current.hasPreviousPage).toBe(false)
      await waitFor(() => expect(hook.result.current.items).toHaveLength(48))
      await waitFor(() => expect(hook.client.getQueryCache().getAll()).toHaveLength(1))
      expect(
        authoredCatalogueReadInputSchema.parse(hook.client.getQueryCache().getAll()[0]!.queryKey[2])
      ).toMatchObject({ ...scope, paginationOpts: { cursor: null, numItems: 48 } })
    }
  )

  it('advances through empty live ranges and stops at exhaustion', async () => {
    const hook = setup(({ paginationOpts }) => ({
      page: paginationOpts.cursor === 'next' ? [item(1)] : [],
      continueCursor: 'next',
      isDone: paginationOpts.cursor === 'next'
    }))
    await waitFor(() => expect(hook.result.current.items).toEqual([item(1)]))
    expect(hook.result.current.hasNextPage).toBe(false)
  })

  it.each(['continuation', 'split', 'query'] as const)(
    'fails closed for a nonprogressing %s',
    async (failure) => {
      const hook = setup(({ paginationOpts }) => {
        if (failure === 'query') throw new Error('Catalogue unavailable')
        return {
          page: [],
          isDone: false,
          continueCursor: paginationOpts.cursor ?? 'same',
          ...(failure === 'split'
            ? { pageStatus: 'SplitRequired' as const, splitCursor: null }
            : {})
        }
      })
      await waitFor(() => expect(hook.result.current.isError).toBe(true))
      expect(hook.result.current.items).toEqual([])
      const calls = hook.queryFn.mock.calls.length
      act(() => hook.result.current.fetchNextPage())
      expect(hook.queryFn).toHaveBeenCalledTimes(calls)
    }
  )
})
