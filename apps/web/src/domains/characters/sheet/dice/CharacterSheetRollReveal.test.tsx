import { MantineProvider } from '@mantine/core'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { GmCampaignRollDto, RollHistoryEntryDto } from '@artificer-toolkit/schema/api/rolls'
import { CharacterSheetRollReveal } from './CharacterSheetRollReveal'

const campaignId = '00000000-0000-4000-8000-000000000123'
const rollId = '00000000-0000-4000-8000-000000000456'

function createRoll(gmCampaignRoll: Partial<GmCampaignRollDto> = {}): RollHistoryEntryDto {
  return {
    id: rollId,
    characterId: null,
    characterLabel: 'GM',
    source: { kind: 'MANUAL', label: 'Manual roll' },
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
    createdAt: '2026-09-18T12:00:00.000Z',
    gmCampaignRoll: {
      campaignId,
      creature: null,
      revealedAt: null,
      noticedAt: null,
      ...gmCampaignRoll
    }
  }
}

function renderReveal(roll: RollHistoryEntryDto, onReveal = vi.fn().mockResolvedValue({})) {
  render(
    <MantineProvider>
      <QueryClientProvider client={new QueryClient()}>
        <CharacterSheetRollReveal roll={roll} onReveal={onReveal} />
      </QueryClientProvider>
    </MantineProvider>
  )
  return onReveal
}

describe('CharacterSheetRollReveal', () => {
  it('offers Show roll and Show that I rolled, each once', async () => {
    const user = userEvent.setup()
    const onReveal = renderReveal(createRoll())

    await user.click(screen.getByRole('button', { name: 'Show roll' }))
    expect(onReveal.mock.lastCall?.[0]).toEqual({ campaignId, rollId, mode: 'FULL' })
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Show roll' })).toBeNull())
    expect(screen.getByText('Revealed to table')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Show that I rolled' }))
    expect(onReveal.mock.lastCall?.[0]).toEqual({ campaignId, rollId, mode: 'NOTICE' })
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Show that I rolled' })).toBeNull()
    )
    expect(onReveal).toHaveBeenCalledTimes(2)
  })

  it('hides a reveal the roll already used', () => {
    renderReveal(
      createRoll({ revealedAt: '2026-09-18T12:01:00.000Z', noticedAt: '2026-09-18T12:00:30.000Z' })
    )
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('keeps a failed reveal available', async () => {
    const user = userEvent.setup()
    renderReveal(createRoll(), vi.fn().mockRejectedValue(new Error('nope')))
    await user.click(screen.getByRole('button', { name: 'Show roll' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Show roll' })).toBeEnabled())
  })

  it('renders nothing for a roll the GM did not retain for a Campaign', () => {
    renderReveal({ ...createRoll(), gmCampaignRoll: null })
    expect(screen.queryByRole('button')).toBeNull()
  })
})
