import { screen, waitFor } from '@testing-library/react'
import { queryOptions } from '@tanstack/react-query'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'
import type { LootDocument } from '@artificer-toolkit/schema/api/lootTables'
import { LOOT_RANGE_REFUSAL } from '@artificer-toolkit/shared/vtt/lootTable'
import { getLoot, saveLoot } from '#app/data/campaigns/loot'
import { queryKeys } from '#app/lib/queryKeys'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import { CampaignSceneLootEditor } from './CampaignSceneLootEditor'

const campaignId = '11111111-1111-4111-8111-111111111111'
const sceneId = '22222222-2222-4222-8222-222222222222'
const owner = { kind: 'SCENE', campaignId, sceneDefinitionId: sceneId } as const
const stored: LootDocument = {
  owner,
  version: 3,
  tables: [
    {
      id: '33333333-3333-4333-8333-333333333333',
      name: 'Guard room',
      ranges: [
        {
          id: '44444444-4444-4444-8444-444444444444',
          min: 1,
          max: 10,
          entries: [{ kind: 'COIN', denominationId: 'gp', amount: 30 }]
        },
        {
          id: '55555555-5555-4555-8555-555555555555',
          min: 11,
          max: null,
          entries: [],
          note: 'Under the cot'
        }
      ]
    }
  ]
}

vi.mock('convex/react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('convex/react')>()),
  useQuery: () => ({
    currencies: [{ id: 'gp', label: 'Gold Piece' }],
    skills: [{ id: 'stealth', label: 'Stealth' }]
  })
}))
vi.mock('#app/data/contentSnapshots/useContentCatalogue', () => ({
  useContentCatalogue: () => ({ items: [{ id: 'club', label: 'Club' }] })
}))
vi.mock('#app/data/campaigns/loot', () => ({
  getLoot: vi.fn(),
  saveLoot: vi.fn()
}))

afterEach(() => vi.clearAllMocks())

function renderEditor() {
  vi.mocked(getLoot).mockReturnValue(
    queryOptions({
      queryKey: queryKeys.campaigns.loot(owner),
      queryFn: async () => stored
    })
  )
  renderWithAppProviders(
    <CampaignSceneLootEditor campaignId={campaignId} gameSystemId='system' sceneId={sceneId} />
  )
}

it('reopens saved tables, refuses an overlapping range, and saves the corrected table', async () => {
  const user = userEvent.setup()
  renderEditor()
  expect(await screen.findByDisplayValue('Guard room')).toBeInTheDocument()
  expect(screen.getByDisplayValue('Under the cot')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Save loot' })).toBeDisabled()

  const secondFrom = screen.getByRole('textbox', { name: 'Table 1 range 2 roll from' })
  await user.clear(secondFrom)
  await user.type(secondFrom, '10')
  expect(await screen.findByRole('alert')).toHaveTextContent(LOOT_RANGE_REFUSAL.OVERLAP)
  expect(screen.getByRole('button', { name: 'Save loot' })).toBeDisabled()

  await user.clear(secondFrom)
  await user.type(secondFrom, '12')
  await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
  const saved = { ...stored, version: 4 }
  vi.mocked(saveLoot).mockResolvedValue(saved)
  await user.click(screen.getByRole('button', { name: 'Save loot' }))

  await waitFor(() => expect(saveLoot).toHaveBeenCalledTimes(1))
  const input = vi.mocked(saveLoot).mock.calls[0]![1]
  expect(input).toMatchObject({ owner, expectedVersion: 3 })
  expect(input.tables[0]!.ranges[1]).toMatchObject({ min: 12, max: null, note: 'Under the cot' })
})
