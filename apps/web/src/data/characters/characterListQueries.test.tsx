import { renderHook } from '@testing-library/react'
import { api as convexApi } from '@artificer-toolkit/apis/convex/api'
import type {
  CharacterBuilderDraftSummaryDto,
  CharacterListResponseDto
} from '@artificer-toolkit/schema/api/characterBuilder'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useGetCharacterList } from './queries'

const mocks = vi.hoisted(() => ({ usePaginatedQuery: vi.fn() }))
vi.mock('convex/react', () => ({ usePaginatedQuery: mocks.usePaginatedQuery }))

const active = {
  id: 'character-1',
  publicId: 'public-1',
  label: 'Aria',
  status: 'ACTIVE',
  systemId: 'system-1',
  streamVersion: 2
} satisfies CharacterListResponseDto['items'][number]
const draft = {
  characterId: 'character-2',
  publicId: 'public-2',
  userId: 'user-1',
  systemId: 'system-1',
  label: 'Borin',
  status: 'DRAFT',
  draftState: 'DRAFT_ONLY'
} satisfies CharacterBuilderDraftSummaryDto

function page<T>(results: T[], status: 'Exhausted' | 'CanLoadMore', loadMore = vi.fn()) {
  return { results, status, loadMore }
}

describe('useGetCharacterList', () => {
  beforeEach(() => vi.clearAllMocks())

  it('loads both native pages and merges active and draft-only identities', () => {
    const activeLoadMore = vi.fn()
    const draftLoadMore = vi.fn()
    mocks.usePaginatedQuery
      .mockReturnValueOnce(page([active], 'CanLoadMore', activeLoadMore))
      .mockReturnValueOnce(page([draft], 'CanLoadMore', draftLoadMore))
    const hook = renderHook(() => useGetCharacterList())

    expect(mocks.usePaginatedQuery).toHaveBeenNthCalledWith(
      1,
      convexApi.characters.list.list,
      {},
      { initialNumItems: 8 }
    )
    expect(mocks.usePaginatedQuery).toHaveBeenNthCalledWith(
      2,
      convexApi.characters.drafts.list,
      {},
      { initialNumItems: 48 }
    )
    expect(activeLoadMore).toHaveBeenCalledWith(8)
    expect(draftLoadMore).toHaveBeenCalledWith(48)
    expect(hook.result.current.isLoading).toBe(true)
    expect(hook.result.current.data).toBeUndefined()
  })

  it('returns the final deduplicated merge only after both streams are exhausted', () => {
    const duplicateDraft = { ...draft, characterId: active.id, publicId: active.publicId }
    const activeDraft = {
      ...draft,
      characterId: 'character-3',
      draftState: 'ACTIVE_WITH_DRAFT' as const
    }
    mocks.usePaginatedQuery
      .mockReturnValueOnce(page([active], 'Exhausted'))
      .mockReturnValueOnce(page([duplicateDraft, draft, activeDraft], 'Exhausted'))
    const hook = renderHook(() => useGetCharacterList())
    expect(hook.result.current.isLoading).toBe(false)
    expect(hook.result.current.data?.meta).toEqual({})
    expect(hook.result.current.data?.items).toEqual([
      active,
      {
        id: draft.characterId,
        publicId: draft.publicId,
        label: draft.label,
        status: 'DRAFT',
        systemId: draft.systemId,
        streamVersion: 0,
        draft
      }
    ])
  })

  it.each(['active', 'draft'] as const)(
    'waits for the remaining %s stream before exposing filter totals',
    (remaining) => {
      const activeLoadMore = vi.fn()
      const draftLoadMore = vi.fn()
      mocks.usePaginatedQuery
        .mockReturnValueOnce(
          page([active], remaining === 'active' ? 'CanLoadMore' : 'Exhausted', activeLoadMore)
        )
        .mockReturnValueOnce(
          page([draft], remaining === 'draft' ? 'CanLoadMore' : 'Exhausted', draftLoadMore)
        )
      const hook = renderHook(() => useGetCharacterList())

      expect(hook.result.current).toEqual({ data: undefined, isLoading: true })
      expect(activeLoadMore).toHaveBeenCalledTimes(remaining === 'active' ? 1 : 0)
      expect(draftLoadMore).toHaveBeenCalledTimes(remaining === 'draft' ? 1 : 0)
    }
  )

  it('skips both native streams and returns no retained data when disabled', () => {
    const activeLoadMore = vi.fn()
    const draftLoadMore = vi.fn()
    mocks.usePaginatedQuery
      .mockReturnValueOnce(page([active], 'CanLoadMore', activeLoadMore))
      .mockReturnValueOnce(page([draft], 'CanLoadMore', draftLoadMore))
    const hook = renderHook(() => useGetCharacterList(false))
    expect(mocks.usePaginatedQuery).toHaveBeenNthCalledWith(
      1,
      convexApi.characters.list.list,
      'skip',
      { initialNumItems: 8 }
    )
    expect(mocks.usePaginatedQuery).toHaveBeenNthCalledWith(
      2,
      convexApi.characters.drafts.list,
      'skip',
      { initialNumItems: 48 }
    )
    expect(activeLoadMore).not.toHaveBeenCalled()
    expect(draftLoadMore).not.toHaveBeenCalled()
    expect(hook.result.current).toEqual({ data: undefined, isLoading: false })
  })
})
