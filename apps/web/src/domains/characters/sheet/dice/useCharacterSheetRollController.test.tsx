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
  executeGmPrivate: vi.fn(),
  executeTable: vi.fn(),
  notify: vi.fn()
}))

vi.mock('@mantine/notifications', () => ({
  notifications: { show: rollMutationMocks.notify }
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
    ({
      'campaigns/characterSheet:executeRoll': rollMutationMocks.executeCampaignPrivate,
      'campaigns/rolls:executePrivate': rollMutationMocks.executeGmPrivate
    })[getFunctionName(reference)] ?? rollMutationMocks.executeTable
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

const campaignId = '00000000-0000-4000-8000-000000000123'

function optionLabels(options: readonly { label: string }[]) {
  return options.map((option) => option.label)
}

const request = {
  expression: '1d8 + 1',
  source: { kind: 'HIT_DIE' as const, label: 'Short rest hit dice' }
}

const manualRequest = {
  expression: '1d20',
  source: { kind: 'MANUAL' as const, label: 'Manual roll' }
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

  it('routes a player "Just me" roll through the campaign Character endpoint', async () => {
    rollMutationMocks.executeCampaignPrivate.mockResolvedValue(createRoll('campaign-private-roll'))
    const { result } = renderHook(
      () => useCharacterSheetRollController('character-1', { id: campaignId, isGm: false }),
      { wrapper: createWrapper() }
    )

    act(() => result.current.setDestination('PRIVATE'))
    let outcome!: Promise<RollRecordDto | undefined>
    act(() => {
      outcome = result.current.executeRoll(manualRequest)
    })
    await waitFor(() => expect(result.current.presentedRoll?.id).toBe('campaign-private-roll'))
    expect(rollMutationMocks.executeCampaignPrivate).toHaveBeenCalledWith({
      campaignId,
      characterId: 'character-1',
      ...manualRequest
    })
    expect(rollMutationMocks.execute).not.toHaveBeenCalled()
    expect(rollMutationMocks.executeTable).not.toHaveBeenCalled()
    act(() => result.current.revealRoll('campaign-private-roll'))
    await expect(outcome).resolves.toMatchObject({ id: 'campaign-private-roll' })
  })

  it('offers no destinations outside a Campaign and keeps rolls private', () => {
    const { result } = renderHook(() => useCharacterSheetRollController('character-1'), {
      wrapper: createWrapper()
    })
    expect(result.current.destination).toBe('PRIVATE')
    expect(result.current.destinationOptions).toEqual([])
  })

  it('defaults a player Campaign roll to the table and can send it to the GM', async () => {
    rollMutationMocks.executeTable
      .mockResolvedValueOnce({ roll: createRoll('table-roll') })
      .mockResolvedValueOnce({ roll: createRoll('gm-roll') })
    const { result } = renderHook(
      () => useCharacterSheetRollController('character-1', { id: campaignId, isGm: false }),
      { wrapper: createWrapper() }
    )
    expect(result.current.destination).toBe('TABLE')
    expect(optionLabels(result.current.destinationOptions)).toEqual(['Table', 'To GM', 'Just me'])

    act(() => void result.current.executeRoll(request))
    await waitFor(() => expect(result.current.presentedRoll?.id).toBe('table-roll'))
    act(() => result.current.setDestination('GM'))
    act(() => void result.current.executeRoll(request))
    await waitFor(() => expect(result.current.presentedRoll?.id).toBe('gm-roll'))
    for (const destination of ['TABLE', 'GM'])
      expect(rollMutationMocks.executeTable).toHaveBeenCalledWith(
        expect.objectContaining({
          campaignId,
          destination,
          roll: { characterId: 'character-1', ...request }
        })
      )
    expect(result.current.presentedRollPrivate).toBe(false)
    expect(rollMutationMocks.executeCampaignPrivate).not.toHaveBeenCalled()
  })

  it('defaults a GM Campaign roll to private and hides a blind result', async () => {
    rollMutationMocks.executeGmPrivate
      .mockResolvedValueOnce(createRoll('gm-private-roll'))
      .mockResolvedValueOnce({ ...createRoll('gm-blind-roll'), evidence: null })
    const { result } = renderHook(
      () => useCharacterSheetRollController('character-1', { id: campaignId, isGm: true }),
      { wrapper: createWrapper() }
    )
    expect(result.current.destination).toBe('PRIVATE')
    expect(optionLabels(result.current.destinationOptions)).toEqual(['Table', 'Private', 'Blind'])

    act(() => void result.current.executeRoll(request))
    await waitFor(() => expect(result.current.presentedRoll?.id).toBe('gm-private-roll'))
    act(() => result.current.setDestination('BLIND'))
    let outcome!: Promise<RollRecordDto | undefined>
    act(() => {
      outcome = result.current.executeRoll(manualRequest)
    })
    await expect(outcome).resolves.toBeUndefined()
    expect(result.current.presentedRoll).toBeUndefined()
    expect(rollMutationMocks.notify).toHaveBeenCalledWith({
      message: 'Blind roll: hidden until revealed'
    })
    for (const [call, blind] of [
      [1, false],
      [2, true]
    ] as const)
      expect(rollMutationMocks.executeGmPrivate).toHaveBeenNthCalledWith(
        call,
        expect.objectContaining({ campaignId, blind })
      )
    expect(rollMutationMocks.executeCampaignPrivate).not.toHaveBeenCalled()
    expect(rollMutationMocks.executeTable).not.toHaveBeenCalled()
  })

  it('keeps player hit-die rolls on Table or To GM, never Just me', async () => {
    rollMutationMocks.executeTable.mockResolvedValue({ roll: createRoll('hit-die-roll') })
    const { result } = renderHook(
      () => useCharacterSheetRollController('character-1', { id: campaignId, isGm: false }),
      { wrapper: createWrapper() }
    )
    expect(optionLabels(result.current.stateRollDestinationOptions)).toEqual(['Table', 'To GM'])
    act(() => result.current.setDestination('PRIVATE'))
    expect(result.current.stateRollDestination).toBe('TABLE')
    act(() => void result.current.executeRoll(request))
    await waitFor(() => expect(result.current.presentedRoll?.id).toBe('hit-die-roll'))
    expect(rollMutationMocks.executeTable).toHaveBeenCalledWith(
      expect.objectContaining({ destination: 'TABLE' })
    )
    act(() => result.current.setDestination('GM'))
    expect(result.current.stateRollDestination).toBe('GM')
    expect(rollMutationMocks.executeCampaignPrivate).not.toHaveBeenCalled()
  })

  it('keeps GM hit-die rolls on Table or Private, never Blind', async () => {
    rollMutationMocks.executeTable.mockResolvedValue({ roll: createRoll('gm-hit-die-roll') })
    const { result } = renderHook(
      () => useCharacterSheetRollController('character-1', { id: campaignId, isGm: true }),
      { wrapper: createWrapper() }
    )
    expect(optionLabels(result.current.stateRollDestinationOptions)).toEqual(['Table', 'Private'])
    expect(result.current.stateRollDestination).toBe('PRIVATE')
    act(() => result.current.setDestination('BLIND'))
    expect(result.current.stateRollDestination).toBe('TABLE')
    act(() => void result.current.executeRoll(request))
    await waitFor(() => expect(result.current.presentedRoll?.id).toBe('gm-hit-die-roll'))
    expect(rollMutationMocks.executeGmPrivate).not.toHaveBeenCalled()
  })
})
