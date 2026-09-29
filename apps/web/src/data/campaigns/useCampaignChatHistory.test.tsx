import {
  listCampaignChatEntriesInputSchema,
  type CampaignChatPageDto
} from '@artificer-toolkit/schema/api/campaignCommunication'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { getCampaignChat } from './queries'
import { useCampaignChatHistory } from './useCampaignChatHistory'

const mocks = vi.hoisted(() => ({
  open: vi.fn<() => Promise<void>>(),
  query: vi.fn<(reference: unknown, args: unknown) => Promise<CampaignChatPageDto>>()
}))
vi.mock('convex/react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('convex/react')>()),
  useMutation: () => mocks.open,
  useConvex: () => ({ query: mocks.query })
}))
const campaignId = '11111111-1111-4111-8111-111111111111'
const conversationId = '22222222-2222-4222-8222-222222222222'
const clients: QueryClient[] = []
beforeEach(() => {
  mocks.open.mockReset().mockResolvedValue(undefined)
  mocks.query.mockReset()
})
afterEach(() => clients.splice(0).forEach((client) => client.clear()))

function entryId(index: number) {
  return `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`
}

function page(indexes: number[], nextCursor: string | null = null): CampaignChatPageDto {
  return {
    entries: indexes.map((index) => ({
      id: entryId(index),
      campaignId,
      conversationId,
      room: 'TABLE',
      kind: 'CHAT',
      mode: 'OOC',
      body: `Message ${index}`,
      roll: null,
      revealedByGm: false,
      authorUserId: entryId(99),
      authorUsername: 'reader',
      characterId: null,
      characterLabel: null,
      editedAt: null,
      unsentAt: null,
      createdAt: new Date(Date.UTC(2026, 8, 9, 0, 0, index)).toISOString()
    })),
    nextCursor,
    unreadCount: indexes.length,
    lastReadAt: null
  }
}

function setup(
  newest: () => CampaignChatPageDto,
  older: (cursor: string) => CampaignChatPageDto | Promise<CampaignChatPageDto> = () => {
    throw new Error('Unexpected older page read.')
  }
) {
  // The subscription serves only the newest page; older pages are one-shot reads.
  const queryFn = vi.fn(({ queryKey }: { queryKey: readonly unknown[] }) => {
    expect(queryKey[1]).toBe('campaigns/chat:list')
    const input = listCampaignChatEntriesInputSchema.parse(queryKey[2])
    expect(input.limit).toBe(50)
    expect(input.cursor).toBeUndefined()
    return newest()
  })
  mocks.query.mockImplementation(async (_reference, args) => {
    const input = listCampaignChatEntriesInputSchema.parse(args)
    expect(input.limit).toBe(50)
    return older(input.cursor!)
  })
  const client = new QueryClient({ defaultOptions: { queries: { queryFn, retry: false } } })
  clients.push(client)
  const hook = renderHook(
    ({ accessKey, enabled }) =>
      useCampaignChatHistory({ campaignId, room: 'TABLE' }, accessKey, enabled),
    {
      initialProps: { accessKey: 'owner:first-membership', enabled: true },
      wrapper: ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      )
    }
  )
  return { ...hook, client, queryFn }
}

const indexes = (hook: ReturnType<typeof setup>) =>
  hook.result.current.entries.map((entry) => Number.parseInt(entry.id.slice(-12), 10))
const newest = (hook: ReturnType<typeof setup>, value: CampaignChatPageDto) =>
  act(() => hook.client.setQueryData(getCampaignChat(campaignId, 'TABLE').queryKey, value))

it('subscribes to the newest page only and keeps older pages below it as it slides', async () => {
  const hook = setup(
    () => page([4, 3], entryId(3)),
    (cursor) => (cursor === entryId(3) ? page([2, 1], entryId(1)) : page([0]))
  )
  await waitFor(() => expect(indexes(hook)).toEqual([3, 4]))
  expect(hook.result.current).toMatchObject({ hasNextPage: true, unreadCount: 2 })
  act(() => hook.result.current.fetchNextPage())
  await waitFor(() => expect(indexes(hook)).toEqual([1, 2, 3, 4]))
  expect(mocks.query).toHaveBeenLastCalledWith(expect.anything(), {
    campaignId,
    room: 'TABLE',
    cursor: entryId(3),
    limit: 50
  })

  // A new message slides entry 3 out of the newest page; it stays in place below it.
  newest(hook, page([5, 4], entryId(4)))
  await waitFor(() => expect(indexes(hook)).toEqual([1, 2, 3, 4, 5]))
  const edited = page([5, 4], entryId(4))
  edited.entries[1]!.body = 'Edited recent message'
  newest(hook, edited)
  await waitFor(() => expect(hook.result.current.entries[3]?.body).toBe('Edited recent message'))
  act(() => hook.result.current.fetchNextPage())
  await waitFor(() => expect(indexes(hook)).toEqual([0, 1, 2, 3, 4, 5]))
  expect(hook.result.current.hasNextPage).toBe(false)
  expect(mocks.query).toHaveBeenLastCalledWith(
    expect.anything(),
    expect.objectContaining({ cursor: entryId(1) })
  )

  // A newest page that no longer reaches the one before it restarts history from itself.
  newest(hook, page([9, 8], entryId(8)))
  await waitFor(() => expect(indexes(hook)).toEqual([8, 9]))
  expect(hook.result.current.hasNextPage).toBe(true)
  expect(hook.queryFn).toHaveBeenCalledTimes(1)
  expect(mocks.query).toHaveBeenCalledTimes(2)
})

it('appends an older page requested before the newest page slid, and retries a failed read', async () => {
  let finish: ((value: CampaignChatPageDto) => void) | undefined
  const hook = setup(
    () => page([4, 3], entryId(3)),
    (cursor) => {
      if (cursor === entryId(3))
        return new Promise((resolve) => {
          finish = resolve
        })
      if (mocks.query.mock.calls.length === 2) throw new Error('Network down.')
      return page([0])
    }
  )
  await waitFor(() => expect(indexes(hook)).toEqual([3, 4]))
  act(() => hook.result.current.fetchNextPage())
  await waitFor(() => expect(finish).toBeDefined())
  expect(hook.result.current.isFetchingNextPage).toBe(true)
  newest(hook, page([5, 4], entryId(4)))
  await waitFor(() => expect(indexes(hook)).toEqual([3, 4, 5]))
  await act(async () => finish!(page([2, 1], entryId(1))))
  await waitFor(() => expect(indexes(hook)).toEqual([1, 2, 3, 4, 5]))

  act(() => hook.result.current.fetchNextPage())
  await waitFor(() => expect(hook.result.current.error?.message).toBe('Network down.'))
  expect(indexes(hook)).toEqual([1, 2, 3, 4, 5])
  expect(hook.result.current.hasNextPage).toBe(true)
  act(() => hook.result.current.fetchNextPage())
  await waitFor(() => expect(indexes(hook)).toEqual([0, 1, 2, 3, 4, 5]))
  expect(hook.result.current.error).toBeUndefined()
})

it('withholds cached messages while new membership authority opens and when it is denied', async () => {
  const hook = setup(() => page([1]))
  await waitFor(() => expect(hook.result.current.entries).toHaveLength(1))
  let rejectOpen: ((reason: Error) => void) | undefined
  mocks.open.mockImplementationOnce(
    () =>
      new Promise((_, reject) => {
        rejectOpen = reject
      })
  )
  hook.rerender({ accessKey: 'owner:rejoined-membership', enabled: true })
  expect(hook.result.current.entries).toEqual([])
  await waitFor(() => expect(rejectOpen).toBeDefined())
  await act(async () => rejectOpen!(new Error('Campaign not found.')))
  await waitFor(() => expect(hook.result.current.error?.message).toBe('Campaign not found.'))
  expect(hook.result.current.entries).toEqual([])
  expect(hook.queryFn).toHaveBeenCalledTimes(1)
  hook.rerender({ accessKey: 'owner:rejoined-membership', enabled: false })
  expect(hook.result.current.entries).toEqual([])
})
