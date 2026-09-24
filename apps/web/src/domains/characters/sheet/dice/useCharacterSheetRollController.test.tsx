import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import { type ReactNode } from 'react'
import { afterEach, expect, vi } from 'vitest'
import type { RollRecordDto } from '@artificer-toolkit/schema/api/rolls'
import { getFunctionName } from 'convex/server'
import { useCharacterSheetRollController } from './useCharacterSheetRollController'

const rollMutationMocks = vi.hoisted(() => ({
  discard: vi.fn().mockResolvedValue(undefined),
  execute: vi.fn(),
  executeCampaignPrivate: vi.fn(),
  executeTable: vi.fn()
}))

vi.mock('#app/data/rolls', () => ({
  useDiscardRollMutation: () => ({ mutateAsync: rollMutationMocks.discard }),
  useExecuteRollMutation: () => ({
    isPending: false,
    mutateAsync: rollMutationMocks.execute,
    variables: undefined
  })
}))

vi.mock('#app/settings/dicePreferences', () => ({
  useDicePresentationPreferences: () => [
    { animate3d: false, postProcessing: true, shadowQuality: 'MEDIUM' }
  ]
}))

vi.mock('convex/react', () => ({
  useMutation: (reference: Parameters<typeof getFunctionName>[0]) =>
    getFunctionName(reference) === 'campaigns/characterSheet:executeRoll'
      ? rollMutationMocks.executeCampaignPrivate
      : rollMutationMocks.executeTable
}))

function createRoll(id: string): RollRecordDto {
  return {
    id,
    characterId: 'character-1',
    characterLabel: 'Aria',
    source: { kind: 'HIT_DIE', label: 'Short rest hit dice' },
    ruleset: { systemId: 'system-1', code: 'DND5E_2014', version: '1' },
    normalizedExpression: '1d8 + 1',
    evidence: {
      terms: [{ count: 1, die: 8, rolls: [5], subtotal: 5 }],
      modifier: 1,
      mode: 'NORMAL',
      subtotal: 6,
      transform: { kind: 'NONE' },
      total: 6
    },
    createdAt: '2026-07-31T12:00:00.000Z'
  }
}

function createWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  })
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
  }
}

const request = {
  expression: '1d8 + 1',
  source: { kind: 'HIT_DIE' as const, label: 'Short rest hit dice' }
}

describe('useCharacterSheetRollController', () => {
  afterEach(() => vi.clearAllMocks())

  it('cancels a network-pending private roll and discards its late result', async () => {
    let resolveNetwork!: (roll: RollRecordDto) => void
    rollMutationMocks.execute.mockReturnValue(
      new Promise<RollRecordDto>((resolve) => {
        resolveNetwork = resolve
      })
    )
    const { result } = renderHook(() => useCharacterSheetRollController('character-1'), {
      wrapper: createWrapper()
    })

    let outcome!: Promise<RollRecordDto | undefined>
    act(() => {
      outcome = result.current.executeRoll(request)
    })
    expect(result.current.presentationPending).toBe(true)

    act(() => result.current.dismissRoll(true))
    await expect(outcome).resolves.toBeUndefined()

    act(() => resolveNetwork(createRoll('late-roll')))
    await waitFor(() => expect(rollMutationMocks.discard).toHaveBeenCalledWith('late-roll'))
    expect(result.current.presentedRoll).toBeUndefined()
  })

  it('replaces an unrevealed roll and accepts only the matching presentation reveal', async () => {
    let resolveSecond!: (roll: RollRecordDto) => void
    rollMutationMocks.execute.mockResolvedValueOnce(createRoll('first-roll')).mockReturnValueOnce(
      new Promise<RollRecordDto>((resolve) => {
        resolveSecond = resolve
      })
    )
    const { result } = renderHook(() => useCharacterSheetRollController('character-1'), {
      wrapper: createWrapper()
    })

    let firstOutcome!: Promise<RollRecordDto | undefined>
    let secondOutcome!: Promise<RollRecordDto | undefined>
    act(() => {
      firstOutcome = result.current.executeRoll(request)
    })
    await waitFor(() => expect(result.current.presentedRoll?.id).toBe('first-roll'))
    act(() => {
      secondOutcome = result.current.executeRoll(request)
    })
    await expect(firstOutcome).resolves.toBeUndefined()
    await waitFor(() => expect(rollMutationMocks.discard).toHaveBeenCalledWith('first-roll'))
    act(() => resolveSecond(createRoll('second-roll')))
    await waitFor(() => expect(result.current.presentedRoll?.id).toBe('second-roll'))

    act(() => result.current.revealRoll('first-roll'))
    expect(result.current.presentationPending).toBe(true)
    act(() => result.current.revealRoll('second-roll'))
    await expect(secondOutcome).resolves.toMatchObject({ id: 'second-roll' })
  })

  it('settles on unmount and discards an unrevealed private result', async () => {
    rollMutationMocks.execute.mockResolvedValue(createRoll('unmounted-roll'))
    const { result, unmount } = renderHook(() => useCharacterSheetRollController('character-1'), {
      wrapper: createWrapper()
    })

    let outcome!: Promise<RollRecordDto | undefined>
    act(() => {
      outcome = result.current.executeRoll(request)
    })
    await waitFor(() => expect(result.current.presentedRoll?.id).toBe('unmounted-roll'))
    unmount()
    await expect(outcome).resolves.toBeUndefined()
    await waitFor(() => expect(rollMutationMocks.discard).toHaveBeenCalledWith('unmounted-roll'))
  })

  it('routes a campaign Sheet private roll through the campaign Character endpoint', async () => {
    const campaignId = '00000000-0000-4000-8000-000000000123'
    rollMutationMocks.executeCampaignPrivate.mockResolvedValue(createRoll('campaign-private-roll'))
    const { result } = renderHook(
      () => useCharacterSheetRollController('character-1', campaignId),
      { wrapper: createWrapper() }
    )

    let outcome!: Promise<RollRecordDto | undefined>
    act(() => {
      outcome = result.current.executeRoll(request)
    })
    await waitFor(() => expect(result.current.presentedRoll?.id).toBe('campaign-private-roll'))
    expect(rollMutationMocks.executeCampaignPrivate).toHaveBeenCalledWith({
      campaignId,
      characterId: 'character-1',
      ...request
    })
    expect(rollMutationMocks.execute).not.toHaveBeenCalled()
    expect(rollMutationMocks.executeTable).not.toHaveBeenCalled()
    act(() => result.current.revealRoll('campaign-private-roll'))
    await expect(outcome).resolves.toMatchObject({ id: 'campaign-private-roll' })
  })
})
