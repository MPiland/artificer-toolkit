import { act, renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import type { RollRecordDto } from '@artificer-toolkit/schema/api/rolls'
import { queryKeys } from '#app/lib/queryKeys'
import { useDiscardRollMutation } from './rolls'

const mocks = vi.hoisted(() => ({ discard: vi.fn() }))

vi.mock('#app/lib/api', () => ({ api: { rolls: { discard: mocks.discard } } }))

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
    subtotal: 14,
    transform: { kind: 'NONE' },
    total: 14
  },
  createdAt: '2026-07-31T12:00:00.000Z'
} satisfies RollRecordDto

describe('useDiscardRollMutation', () => {
  it('restores optimistic roll history when discard fails', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false }, queries: { retry: false } }
    })
    queryClient.setQueryData(queryKeys.rolls.history(), [roll])
    mocks.discard.mockRejectedValueOnce(new Error('Discard failed'))
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
    const { result } = renderHook(() => useDiscardRollMutation(), { wrapper })

    await act(async () => {
      await expect(result.current.mutateAsync(roll.id)).rejects.toThrow('Discard failed')
    })

    expect(queryClient.getQueryData(queryKeys.rolls.history())).toEqual([roll])
  })
})
