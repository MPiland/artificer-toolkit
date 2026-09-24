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

const mocks = vi.hoisted(() => ({ open: vi.fn<() => Promise<void>>() }))
vi.mock('convex/react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('convex/react')>()),
  useMutation: () => mocks.open
}))
const campaignId = '11111111-1111-4111-8111-111111111111'
const conversationId = '22222222-2222-4222-8222-222222222222'
const clients: QueryClient[] = []
beforeEach(() => {
  mocks.open.mockReset().mockResolvedValue(undefined)
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

function setup(read: (cursor?: string) => CampaignChatPageDto | Promise<CampaignChatPageDto>) {
  const queryFn = vi.fn(({ queryKey }: { queryKey: readonly unknown[] }) => {
    expect(queryKey[1]).toBe('campaigns/chat:list')
    const input = listCampaignChatEntriesInputSchema.parse(queryKey[2])
    expect(input.limit).toBe(50)
    return read(input.cursor)
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

it('loads older pages on request and drops a stale tail when a live boundary changes', async () => {
  let finishReplacement: ((value: CampaignChatPageDto) => void) | undefined
  const hook = setup((cursor) => {
    if (!cursor) return page([4, 3], entryId(3))
    if (cursor === entryId(3)) return page([2, 1])
    return new Promise((resolve) => {
      finishReplacement = resolve
    })
  })
  await waitFor(() =>
    expect(hook.result.current.entries.map((entry) => entry.body)).toEqual([
      'Message 3',
      'Message 4'
    ])
  )
  expect(hook.queryFn).toHaveBeenCalledTimes(1)
  act(() => hook.result.current.fetchNextPage())
  await waitFor(() => expect(hook.result.current.entries).toHaveLength(4))
  const edited = page([2, 1])
  edited.entries[0]!.body = 'Edited older message'
  act(() =>
    hook.client.setQueryData(
      getCampaignChat(campaignId, 'TABLE', undefined, entryId(3)).queryKey,
      edited
    )
  )
  await waitFor(() => expect(hook.result.current.entries[1]?.body).toBe('Edited older message'))

  act(() =>
    hook.client.setQueryData(
      getCampaignChat(campaignId, 'TABLE').queryKey,
      page([6, 5], entryId(5))
    )
  )
  await waitFor(() => expect(finishReplacement).toBeDefined())
  expect(hook.result.current.entries.map((entry) => entry.body)).toEqual(['Message 5', 'Message 6'])
  await act(async () => finishReplacement!(page([4, 3])))
  await waitFor(() =>
    expect(hook.result.current.entries.map((entry) => entry.body)).toEqual([
      'Message 3',
      'Message 4',
      'Message 5',
      'Message 6'
    ])
  )
  expect(hook.result.current.hasNextPage).toBe(false)
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
