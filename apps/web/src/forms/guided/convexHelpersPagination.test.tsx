import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { api } from '@artificer-toolkit/apis/convex/api'
import type { AuthoredCataloguePage } from '@artificer-toolkit/schema/api/authoredCatalogue'
import { ConvexProvider } from 'convex/react'
import type { ConvexReactClient } from 'convex/react'
import { usePaginatedQuery } from 'convex-helpers/react'

const systemId = '00000000-0000-4000-8000-000000000001'
function item(publicId: string): AuthoredCataloguePage['page'][number] {
  return {
    id: `00000000-0000-4000-8000-${(publicId === 'inserted' ? 'e' : publicId).padStart(12, '0')}`,
    publicId,
    systemId,
    label: publicId,
    description: null,
    activeUpdatedAt: '2026-09-05T00:00:00.000Z',
    status: 'ACTIVE',
    provenance: { kind: 'MASTER', ownerUserId: null },
    permissions: { canView: true, canEdit: false, canCopy: true, canDelete: false }
  }
}

describe('convex-helpers pagination', () => {
  it('pins the loaded boundary while reactive rows change before it', async () => {
    let boundPage = [item('a'), item('b')]
    const boundListeners = new Set<() => void>()
    const watchedArgs: Array<{
      paginationOpts: { cursor: string | null; endCursor?: string | null; numItems?: number }
    }> = []
    const client = {
      logger: { warn: vi.fn() },
      watchQuery: (
        _query: unknown,
        args: { paginationOpts: { cursor: string | null; endCursor?: string | null } }
      ) => {
        const paginationOpts = args.paginationOpts
        watchedArgs.push(args)
        const isBound = paginationOpts.endCursor === 'cursor-b'
        return {
          localQueryResult: () => ({
            continueCursor: 'cursor-b',
            isDone: isBound || paginationOpts.cursor === 'cursor-b',
            page: isBound
              ? boundPage
              : paginationOpts.cursor === 'cursor-b'
                ? [item('c'), item('d')]
                : [item('a'), item('b')]
          }),
          onUpdate: (listener: () => void) => {
            if (isBound) boundListeners.add(listener)
            return () => boundListeners.delete(listener)
          }
        }
      }
    } as unknown as ConvexReactClient

    const { result } = renderHook(
      () =>
        usePaginatedQuery(
          api.content.catalogue.list,
          { subjectKind: 'RACE', systemId },
          { initialNumItems: 2 }
        ),
      { wrapper: ({ children }) => <ConvexProvider client={client}>{children}</ConvexProvider> }
    )

    await waitFor(() => expect(result.current.status).toBe('CanLoadMore'))
    act(() => result.current.loadMore(2))

    await waitFor(() => expect(result.current.status).toBe('Exhausted'))
    expect(
      watchedArgs.find(({ paginationOpts }) => paginationOpts.endCursor === 'cursor-b')
        ?.paginationOpts
    ).toMatchObject({
      cursor: null,
      endCursor: 'cursor-b',
      numItems: 2
    })
    boundPage = [item('inserted'), item('a'), item('b')]
    act(() => boundListeners.forEach((listener) => listener()))
    await waitFor(() =>
      expect(result.current.results.map((entry) => entry.publicId)).toEqual([
        'inserted',
        'a',
        'b',
        'c',
        'd'
      ])
    )

    boundPage = [item('inserted'), item('b')]
    act(() => boundListeners.forEach((listener) => listener()))
    await waitFor(() =>
      expect(result.current.results.map((entry) => entry.publicId)).toEqual([
        'inserted',
        'b',
        'c',
        'd'
      ])
    )
  })
})
