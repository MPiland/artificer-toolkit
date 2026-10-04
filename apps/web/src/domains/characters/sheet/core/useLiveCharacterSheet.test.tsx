import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CharacterSheetLivePlayCommand } from '@artificer-toolkit/schema/api/characterSheetLiveCommands'
import { getCharacterSheetLiveAuthority } from '#app/data/characters/queries'
import { characterSheetFixture } from '../fixtures/characterSheet.fixtures'
import { useLiveCharacterSheet } from './useLiveCharacterSheet'

const characterId = characterSheetFixture.meta.characterId
const campaignId = '00000000-0000-4000-8000-000000000123'
const encounterId = '00000000-0000-4000-8000-000000000456'
const baseVersion = characterSheetFixture.meta.streamVersion
const damage = {
  type: 'ADJUST_HIT_POINTS',
  mode: 'DAMAGE',
  amount: 6,
  commandId: '00000000-0000-4000-8000-000000000999',
  expectedVersion: baseVersion
} satisfies CharacterSheetLivePlayCommand

const mocks = vi.hoisted(() => ({
  live: { characterSheet: null as unknown, sendCharacterSheetCommand: vi.fn() }
}))

vi.mock('#app/domains/campaigns/vtt/useCampaignLiveSession', () => ({
  useCampaignLiveSession: () => mocks.live
}))

const pushed = (
  streamVersion: number,
  currentHitPoints = characterSheetFixture.overview.currentHitPoints
) => ({
  characterId,
  streamVersion,
  type: 'CHARACTER_SHEET' as const,
  sheet: {
    ...characterSheetFixture,
    meta: { ...characterSheetFixture.meta, streamVersion },
    overview: { ...characterSheetFixture.overview, currentHitPoints }
  }
})

function render() {
  const client = new QueryClient({
    defaultOptions: { queries: { staleTime: Infinity } }
  })
  client.setQueryData(getCharacterSheetLiveAuthority(characterId, campaignId).queryKey, {
    characterId,
    campaignId,
    encounterIds: [encounterId]
  })
  return renderHook(() => useLiveCharacterSheet(characterId, campaignId), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    )
  })
}

const hitPoints = (result: { current: ReturnType<typeof useLiveCharacterSheet> }) =>
  result.current?.common?.overview.currentHitPoints

describe('useLiveCharacterSheet optimistic play edits', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.live.characterSheet = pushed(baseVersion)
  })

  it('shows an edit at once and keeps it until the push at its committed version', async () => {
    let commit: (response: { streamVersion: number }) => void = () => {}
    mocks.live.sendCharacterSheetCommand.mockReturnValue(
      new Promise((resolve) => (commit = resolve))
    )
    const { result, rerender } = render()
    expect(hitPoints(result)).toBe(14)

    let sent: Promise<unknown> = Promise.resolve()
    act(() => {
      sent = result.current!.sendPlayCommand(damage)
    })
    expect(hitPoints(result)).toBe(12)
    expect(mocks.live.sendCharacterSheetCommand).toHaveBeenCalledWith({
      characterId,
      encounterId,
      command: damage
    })

    await act(async () => {
      commit({ streamVersion: baseVersion + 1 })
      await sent
    })
    expect(hitPoints(result)).toBe(12)

    mocks.live.characterSheet = pushed(baseVersion + 1, 8)
    rerender()
    expect(hitPoints(result)).toBe(8)
    expect(result.current?.sheet?.meta.streamVersion).toBe(baseVersion + 1)
  })

  it('reverts a refused edit and rethrows the room reason, then reuses the command id on retry', async () => {
    mocks.live.sendCharacterSheetCommand
      .mockRejectedValueOnce(new Error('No spell slot left.'))
      .mockResolvedValueOnce({ streamVersion: baseVersion + 1 })
    const { result } = render()

    await act(async () => {
      await expect(result.current!.sendPlayCommand(damage)).rejects.toThrow('No spell slot left.')
    })
    expect(hitPoints(result)).toBe(14)

    await act(async () => {
      await result.current!.sendPlayCommand(damage)
    })
    const commandIds = mocks.live.sendCharacterSheetCommand.mock.calls.map(
      ([input]) => (input as { command: { commandId: string } }).command.commandId
    )
    expect(commandIds).toEqual([damage.commandId, damage.commandId])
  })

  it('accepts a push at an unchanged version as a content refresh', () => {
    const { result, rerender } = render()
    mocks.live.characterSheet = pushed(baseVersion, 3)
    rerender()
    expect(hitPoints(result)).toBe(3)
  })
})
