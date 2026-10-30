import { convexQuery } from '@convex-dev/react-query'
import { api as convexApi } from '@artificer-toolkit/apis/convex/api'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import { type ReactNode } from 'react'
import { afterEach, expect, vi } from 'vitest'
import {
  rollRecordDtoSchema,
  type RollRecordDto,
  type RollVisibilityDto
} from '@artificer-toolkit/schema/api/rolls'
import { getFunctionName } from 'convex/server'
import { useCharacterSheetRollController } from './useCharacterSheetRollController'

const rollMutationMocks = vi.hoisted(() => ({
  discard: vi.fn().mockResolvedValue(undefined),
  execute: vi.fn(),
  executeCampaignPrivate: vi.fn(),
  executeGmPrivate: vi.fn(),
  executeTable: vi.fn(),
  notify: vi.fn(),
  setGmRollVisibility: vi.fn().mockResolvedValue(null)
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

vi.mock('convex/react', async () => {
  const { api } = await import('@artificer-toolkit/apis/convex/api')
  const mutations = {
    [getFunctionName(api.campaigns.characterSheet.executeRoll)]:
      rollMutationMocks.executeCampaignPrivate,
    [getFunctionName(api.campaigns.rolls.executePrivate)]: rollMutationMocks.executeGmPrivate,
    [getFunctionName(api.account.setGmRollVisibility)]: rollMutationMocks.setGmRollVisibility
  }
  return {
    useMutation: (reference: Parameters<typeof getFunctionName>[0]) =>
      mutations[getFunctionName(reference)] ?? rollMutationMocks.executeTable,
    useConvex: () => ({ action: vi.fn(), query: vi.fn() })
  }
})

const characterId = '00000000-0000-4000-8000-000000000125'
const systemId = '00000000-0000-4000-8000-000000000126'

function createRoll(id: string): RollRecordDto {
  return rollRecordDtoSchema.parse({
    id,
    characterId,
    characterLabel: 'Aria',
    source: { kind: 'HIT_DIE', label: 'Short rest hit dice' },
    ruleset: { systemId, code: 'DND5E_2014', version: '1' },
    normalizedExpression: '1d8 + 1',
    evidence: {
      terms: [{ count: 1, die: 8, rolls: [5], subtotal: 5 }],
      modifier: 1,
      mode: 'NORMAL',
      keep: 'FIRST',
      subtotal: 6,
      transform: { kind: 'NONE' },
      total: 6
    },
    createdAt: '2026-07-31T12:00:00.000Z'
  })
}

function createWrapper(gmRollVisibility: RollVisibilityDto = 'PUBLIC') {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } }
  })
  client.setQueryData(convexQuery(convexApi.account.rollPreferences, {}).queryKey, {
    autoRollDice: true,
    gmRollVisibility
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
    const { result } = renderHook(() => useCharacterSheetRollController(characterId), {
      wrapper: createWrapper()
    })

    let outcome!: Promise<RollRecordDto | undefined>
    act(() => {
      outcome = result.current.rolls.executeRoll(request)
    })
    expect(result.current.presentation.presentationPending).toBe(true)

    act(() => result.current.presentation.dismissRoll(true))
    await expect(outcome).resolves.toBeUndefined()

    act(() => resolveNetwork(createRoll('late-roll')))
    await waitFor(() => expect(rollMutationMocks.discard).toHaveBeenCalledWith('late-roll'))
    expect(result.current.presentation.presentedRoll).toBeUndefined()
  })

  it('replaces an unrevealed roll and accepts only the matching presentation reveal', async () => {
    let resolveSecond!: (roll: RollRecordDto) => void
    rollMutationMocks.execute.mockResolvedValueOnce(createRoll('first-roll')).mockReturnValueOnce(
      new Promise<RollRecordDto>((resolve) => {
        resolveSecond = resolve
      })
    )
    const { result } = renderHook(() => useCharacterSheetRollController(characterId), {
      wrapper: createWrapper()
    })

    let firstOutcome!: Promise<RollRecordDto | undefined>
    let secondOutcome!: Promise<RollRecordDto | undefined>
    act(() => {
      firstOutcome = result.current.rolls.executeRoll(request)
    })
    await waitFor(() => expect(result.current.presentation.presentedRoll?.id).toBe('first-roll'))
    act(() => {
      secondOutcome = result.current.rolls.executeRoll(request)
    })
    await expect(firstOutcome).resolves.toBeUndefined()
    await waitFor(() => expect(rollMutationMocks.discard).toHaveBeenCalledWith('first-roll'))
    act(() => resolveSecond(createRoll('second-roll')))
    await waitFor(() => expect(result.current.presentation.presentedRoll?.id).toBe('second-roll'))

    act(() => result.current.presentation.revealRoll('first-roll'))
    expect(result.current.presentation.presentationPending).toBe(true)
    act(() => result.current.presentation.revealRoll('second-roll'))
    await expect(secondOutcome).resolves.toMatchObject({ id: 'second-roll' })
  })

  it('settles on unmount and discards an unrevealed private result', async () => {
    rollMutationMocks.execute.mockResolvedValue(createRoll('unmounted-roll'))
    const { result, unmount } = renderHook(() => useCharacterSheetRollController(characterId), {
      wrapper: createWrapper()
    })

    let outcome!: Promise<RollRecordDto | undefined>
    act(() => {
      outcome = result.current.rolls.executeRoll(request)
    })
    await waitFor(() =>
      expect(result.current.presentation.presentedRoll?.id).toBe('unmounted-roll')
    )
    unmount()
    await expect(outcome).resolves.toBeUndefined()
    await waitFor(() => expect(rollMutationMocks.discard).toHaveBeenCalledWith('unmounted-roll'))
  })

  it('routes a player "Just me" roll through the campaign Character endpoint', async () => {
    rollMutationMocks.executeCampaignPrivate.mockResolvedValue(createRoll('campaign-private-roll'))
    const { result } = renderHook(
      () => useCharacterSheetRollController(characterId, { id: campaignId, isGm: false }),
      { wrapper: createWrapper() }
    )

    act(() => result.current.destinations.setDestination('PRIVATE'))
    let outcome!: Promise<RollRecordDto | undefined>
    act(() => {
      outcome = result.current.rolls.executeRoll(manualRequest)
    })
    await waitFor(() =>
      expect(result.current.presentation.presentedRoll?.id).toBe('campaign-private-roll')
    )
    expect(rollMutationMocks.executeCampaignPrivate).toHaveBeenCalledWith({
      campaignId,
      characterId,
      ...manualRequest
    })
    expect(rollMutationMocks.execute).not.toHaveBeenCalled()
    expect(rollMutationMocks.executeTable).not.toHaveBeenCalled()
    act(() => result.current.presentation.revealRoll('campaign-private-roll'))
    await expect(outcome).resolves.toMatchObject({ id: 'campaign-private-roll' })
  })

  it('offers no destinations outside a Campaign and keeps rolls private', () => {
    const { result } = renderHook(() => useCharacterSheetRollController(characterId), {
      wrapper: createWrapper()
    })
    expect(result.current.destinations.destination).toBe('PRIVATE')
    expect(result.current.destinations.destinationOptions).toEqual([])
  })

  it('defaults a player Campaign roll to the table and can send it to the GM', async () => {
    rollMutationMocks.executeTable
      .mockResolvedValueOnce({ roll: createRoll('table-roll') })
      .mockResolvedValueOnce({ roll: createRoll('gm-roll') })
    const { result } = renderHook(
      () => useCharacterSheetRollController(characterId, { id: campaignId, isGm: false }),
      { wrapper: createWrapper() }
    )
    expect(result.current.destinations.destination).toBe('TABLE')
    expect(optionLabels(result.current.destinations.destinationOptions)).toEqual([
      'Table',
      'To GM',
      'Just me'
    ])

    act(() => void result.current.rolls.executeRoll(request))
    await waitFor(() => expect(result.current.presentation.presentedRoll?.id).toBe('table-roll'))
    act(() => result.current.destinations.setDestination('GM'))
    act(() => void result.current.rolls.executeRoll(request))
    await waitFor(() => expect(result.current.presentation.presentedRoll?.id).toBe('gm-roll'))
    for (const destination of ['TABLE', 'GM'])
      expect(rollMutationMocks.executeTable).toHaveBeenCalledWith(
        expect.objectContaining({
          campaignId,
          destination,
          roll: { characterId, ...request }
        })
      )
    expect(result.current.presentation.presentedRollPrivate).toBe(false)
    expect(rollMutationMocks.executeCampaignPrivate).not.toHaveBeenCalled()
  })

  it('defaults a GM Campaign roll to public and rolls it to the table', async () => {
    rollMutationMocks.executeTable.mockResolvedValueOnce({ roll: createRoll('gm-public-roll') })
    const { result } = renderHook(
      () => useCharacterSheetRollController(characterId, { id: campaignId, isGm: true }),
      { wrapper: createWrapper() }
    )
    expect(result.current.destinations.destination).toBe('TABLE')
    expect(optionLabels(result.current.destinations.destinationOptions)).toEqual([
      'Public',
      'Private'
    ])

    act(() => void result.current.rolls.executeRoll(request))
    await waitFor(() =>
      expect(result.current.presentation.presentedRoll?.id).toBe('gm-public-roll')
    )
    expect(rollMutationMocks.executeTable).toHaveBeenCalledWith(
      expect.objectContaining({ campaignId, destination: 'TABLE' })
    )
    expect(rollMutationMocks.executeGmPrivate).not.toHaveBeenCalled()
    expect(result.current.presentation.presentedRollPrivate).toBe(false)
  })

  it('remembers the GM private choice on the profile and rolls privately with a retry nonce', async () => {
    rollMutationMocks.executeGmPrivate.mockResolvedValueOnce(createRoll('gm-private-roll'))
    const { result } = renderHook(
      () => useCharacterSheetRollController(characterId, { id: campaignId, isGm: true }),
      { wrapper: createWrapper() }
    )
    act(() => result.current.destinations.setDestination('PRIVATE'))
    await waitFor(() => expect(result.current.destinations.destination).toBe('PRIVATE'))
    expect(rollMutationMocks.setGmRollVisibility).toHaveBeenCalledWith({
      gmRollVisibility: 'PRIVATE'
    })

    act(() => void result.current.rolls.executeRoll(request))
    await waitFor(() =>
      expect(result.current.presentation.presentedRoll?.id).toBe('gm-private-roll')
    )
    expect(rollMutationMocks.executeGmPrivate).toHaveBeenCalledWith(
      expect.objectContaining({ campaignId, clientNonce: expect.any(String) })
    )
    expect(rollMutationMocks.executeCampaignPrivate).not.toHaveBeenCalled()
    expect(rollMutationMocks.executeTable).not.toHaveBeenCalled()
  })

  it('starts a GM whose stored choice is private on private', () => {
    const { result } = renderHook(
      () => useCharacterSheetRollController(characterId, { id: campaignId, isGm: true }),
      { wrapper: createWrapper('PRIVATE') }
    )
    expect(result.current.destinations.destination).toBe('PRIVATE')
  })

  it('keeps player hit-die rolls on Table or To GM, never Just me', async () => {
    rollMutationMocks.executeTable.mockResolvedValue({ roll: createRoll('hit-die-roll') })
    const { result } = renderHook(
      () => useCharacterSheetRollController(characterId, { id: campaignId, isGm: false }),
      { wrapper: createWrapper() }
    )
    expect(optionLabels(result.current.destinations.stateRollDestinationOptions)).toEqual([
      'Table',
      'To GM'
    ])
    act(() => result.current.destinations.setDestination('PRIVATE'))
    expect(result.current.destinations.stateRollDestination).toBe('TABLE')
    act(() => void result.current.rolls.executeRoll(request))
    await waitFor(() => expect(result.current.presentation.presentedRoll?.id).toBe('hit-die-roll'))
    expect(rollMutationMocks.executeTable).toHaveBeenCalledWith(
      expect.objectContaining({ destination: 'TABLE' })
    )
    act(() => result.current.destinations.setDestination('GM'))
    expect(result.current.destinations.stateRollDestination).toBe('GM')
    expect(rollMutationMocks.executeCampaignPrivate).not.toHaveBeenCalled()
  })

  it('keeps GM hit-die rolls on Public or Private', async () => {
    rollMutationMocks.executeTable.mockResolvedValue({ roll: createRoll('gm-hit-die-roll') })
    const { result } = renderHook(
      () => useCharacterSheetRollController(characterId, { id: campaignId, isGm: true }),
      { wrapper: createWrapper() }
    )
    expect(optionLabels(result.current.destinations.stateRollDestinationOptions)).toEqual([
      'Public',
      'Private'
    ])
    expect(result.current.destinations.stateRollDestination).toBe('TABLE')
    act(() => void result.current.rolls.executeRoll(request))
    await waitFor(() =>
      expect(result.current.presentation.presentedRoll?.id).toBe('gm-hit-die-roll')
    )
    expect(rollMutationMocks.executeGmPrivate).not.toHaveBeenCalled()
  })
})
