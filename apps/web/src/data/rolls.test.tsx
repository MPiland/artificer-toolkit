import { act, renderHook } from '@testing-library/react'
import { ConvexQueryClient, convexQuery } from '@convex-dev/react-query'
import type {
  RollHistoryEntryDto,
  RollHistoryResponseDto,
  RollRecordDto
} from '@artificer-toolkit/schema/api/rolls'
import { ConvexProvider, ConvexReactClient } from 'convex/react'
import type { OptimisticLocalStore } from 'convex/browser'
import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { api } from '@artificer-toolkit/apis/convex/api'
import { createAppQueryClient } from '#app/query/createAppQueryClient'
import {
  getRollHistory,
  useClearRollHistoryMutation,
  useDiscardRollMutation,
  useExecuteDiceConfigurationMutation,
  useExecuteRollMutation
} from './rolls'

const roll = {
  id: 'roll-1',
  characterId: 'character-1',
  characterLabel: 'Aria',
  source: { kind: 'ABILITY_CHECK', label: 'Strength check' },
  ruleset: { systemId: 'system-1', code: 'DND5E_2014', version: '1' },
  normalizedExpression: '1d20',
  evidence: {
    terms: [{ count: 1, die: 20, rolls: [14], subtotal: 14 }],
    modifier: 0,
    mode: 'NORMAL',
    keep: 'FIRST',
    subtotal: 14,
    transform: { kind: 'NONE' },
    total: 14
  },
  createdAt: '2026-07-31T12:00:00.000Z'
} satisfies RollRecordDto
const retainedRoll = { ...roll, gmCampaignRoll: null } satisfies RollHistoryEntryDto

describe('native roll adapters', () => {
  it('uses native roll references and leaves unloaded history untouched', async () => {
    expect(getRollHistory()).toEqual(convexQuery(api.rolls.history, {}))
    expect(getRollHistory(false)).toEqual(convexQuery(api.rolls.history, 'skip'))
    const queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false }, queries: { retry: false } }
    })
    const client = new ConvexReactClient('https://example.convex.cloud')
    const mutation = vi.spyOn(client, 'mutation').mockResolvedValue({ ok: true })
    const wrapper = ({ children }: { children: ReactNode }) => (
      <ConvexProvider client={client}>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </ConvexProvider>
    )
    const { result } = renderHook(() => useDiscardRollMutation(), { wrapper })

    await act(async () => {
      await result.current.mutateAsync(roll.id)
    })
    expect(mutation).toHaveBeenCalledWith(api.rolls.discard, { id: roll.id }, expect.anything())
    const update = mutation.mock.calls[0]?.[2]?.optimisticUpdate
    expect(update).toBeTypeOf('function')
    const other = { ...retainedRoll, id: 'roll-2' }
    let value: RollHistoryResponseDto | undefined = [retainedRoll, other]
    const store: OptimisticLocalStore = {
      getQuery: () => value,
      getAllQueries: () => [],
      setQuery: (_ref, _args, next) => {
        value = next
      }
    }
    update?.(store, { id: roll.id })
    expect(value).toEqual([other])
    value = undefined
    update?.(store, { id: roll.id })
    expect(value).toBeUndefined()
    await client.close()
  })

  it('passes execute and clear inputs through and returns failures', async () => {
    const client = new ConvexReactClient('https://example.convex.cloud')
    const mutation = vi
      .spyOn(client, 'mutation')
      .mockResolvedValueOnce(roll)
      .mockResolvedValueOnce({
        id: roll.id,
        normalizedExpression: roll.normalizedExpression,
        evidence: roll.evidence
      })
      .mockResolvedValueOnce({ ok: true })
    const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
    const wrapper = ({ children }: { children: ReactNode }) => (
      <ConvexProvider client={client}>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </ConvexProvider>
    )
    const execute = renderHook(() => useExecuteRollMutation(), { wrapper })
    const input = {
      characterId: 'c',
      expression: '1d20',
      source: { kind: 'MANUAL' as const, label: 'Manual' }
    }
    await act(async () => {
      expect(await execute.result.current.mutateAsync(input)).toEqual(roll)
    })
    const config = renderHook(() => useExecuteDiceConfigurationMutation(), { wrapper })
    await act(async () => {
      await config.result.current.mutateAsync({ configuration: '1d20' })
    })
    const clear = renderHook(() => useClearRollHistoryMutation(), { wrapper })
    await act(async () => {
      await clear.result.current.mutateAsync()
    })
    expect(mutation.mock.calls.map(([ref, args]) => [ref, args])).toEqual([
      [api.rolls.execute, input],
      [api.rolls.executeConfiguration, { configuration: '1d20' }],
      [api.rolls.clearHistory, {}]
    ])
    mutation.mockRejectedValueOnce(new Error('Roll service unavailable'))
    await act(async () => {
      await expect(execute.result.current.mutateAsync(input)).rejects.toThrow(
        'Roll service unavailable'
      )
    })
    queryClient.clear()
    await client.close()
  })

  it('receives pushed history through the native query bridge without refetching', async () => {
    const client = new ConvexReactClient('https://example.convex.cloud')
    let records: RollHistoryResponseDto = [retainedRoll]
    const callbacks = new Set<() => void>()
    vi.spyOn(client, 'watchQuery').mockReturnValue({
      localQueryResult: () => records,
      journal: () => undefined,
      onUpdate: (callback) => {
        callbacks.add(callback)
        return () => callbacks.delete(callback)
      }
    })
    const query = vi.spyOn(client, 'query').mockImplementation(async () => records)
    const convex = new ConvexQueryClient(client)
    const queryClient = createAppQueryClient(convex)
    try {
      expect(await queryClient.ensureQueryData(getRollHistory())).toEqual([retainedRoll])
      records = []
      for (const callback of callbacks) callback()
      expect(queryClient.getQueryData(getRollHistory().queryKey)).toEqual([])
      expect(query).toHaveBeenCalledOnce()
      queryClient.clear()
      expect(callbacks.size).toBe(0)
    } finally {
      queryClient.clear()
      convex.unsubscribe?.()
      await client.close()
    }
  })
})
