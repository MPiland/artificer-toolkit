import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { getFunctionName } from 'convex/server'
import { describe, expect, it, vi } from 'vitest'
import { api } from '@artificer-toolkit/apis/convex/api'
import { projectCharacterSheetSlice } from '@artificer-toolkit/rules-runtime/character/sheetSlices'
import {
  prepareFixtureSheet,
  readyFighterFixture,
  system
} from '@artificer-toolkit/rules-runtime/testing/characterContextFixtures'
import { characterSheetResponseDtoSchema } from '@artificer-toolkit/schema/api/characterSheetData'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import { CharacterSheetInventory } from '../../characters/sheet/inventory/CharacterSheetInventory'
import { createCampaignDetail } from '../campaignDetail.fixtures'
import { CampaignInventory } from './CampaignInventory'

const gold = system.currencies.find(({ code }) => code === 'GP')
if (!gold?.short) throw new Error('Expected the SRD System to define gold.')
const guildSystemId = '33333333-3333-4333-8333-333333333333'
const guildMark = { label: 'Guild Mark', abbreviation: 'gm' }
// The Campaign Sheet read names each Campaign denomination with its currency system.
const sheetGuildMark = 'Guild Mark (Guild coinage)'
const fixture = readyFighterFixture()

// The real Sheet projection of a Character holding System gold and a Campaign denomination that
// reuses the gold id; only the currency identity tells them apart.
const { sheet: projected } = await prepareFixtureSheet({
  ...fixture,
  character: {
    ...fixture.character,
    state: {
      ...fixture.character.state,
      currency: [
        {
          id: crypto.randomUUID(),
          currencies: [
            { currencyId: gold.id, kind: 'RULESET', amount: 16 },
            {
              currencyId: gold.id,
              kind: 'CAMPAIGN',
              campaignCurrencySystemId: guildSystemId,
              amount: 2
            }
          ]
        }
      ]
    }
  },
  campaignCurrencyOptions: [
    {
      id: gold.id,
      kind: 'CAMPAIGN',
      campaignCurrencySystemId: guildSystemId,
      label: sheetGuildMark
    }
  ]
})
const sheet = characterSheetResponseDtoSchema.parse(projected)

const mocks = vi.hoisted(() => ({
  empty: { results: [], status: 'Exhausted', loadMore: () => undefined },
  currencySystems: { results: [] as unknown[], status: 'Exhausted', loadMore: () => undefined },
  slice: null as unknown,
  system: null as unknown
}))

vi.mock('#app/data/characters/queries', () => ({
  getCharacterSheetEquipmentOptions: (id: string | undefined) => ({
    queryKey: ['character-equipment-options', id],
    queryFn: async () => [],
    initialData: [],
    staleTime: Infinity
  })
}))
vi.mock('convex/react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('convex/react')>()),
  useConvex: () => ({ query: vi.fn() }),
  useMutation: () => vi.fn(),
  useQuery: (reference: Parameters<typeof getFunctionName>[0], args: unknown) => {
    if (args === 'skip') return undefined
    switch (getFunctionName(reference)) {
      case getFunctionName(api.campaigns.inventoryOwners.version):
        return { version: 7 }
      case getFunctionName(api.characters.sheetSlices.get):
        return mocks.slice
      case getFunctionName(api.content.systems.get):
        return mocks.system
      default:
        return null
    }
  }
}))
vi.mock('convex-helpers/react', () => ({
  usePaginatedQuery: (reference: Parameters<typeof getFunctionName>[0], args: unknown) =>
    args !== 'skip' &&
    getFunctionName(reference) === getFunctionName(api.campaigns.currencySystems.list)
      ? mocks.currencySystems
      : mocks.empty
}))
vi.mock('./CurrencySystemEditor', () => ({ CurrencySystemEditor: () => null }))
vi.mock('./CampaignInventoryAudit', () => ({ CampaignInventoryAudit: () => null }))

describe('Campaign currency labels', () => {
  it('names each Sheet currency holding by its own identity', () => {
    renderWithAppProviders(
      <CharacterSheetInventory
        partyInventory={null}
        pending={false}
        sheet={sheet}
        submitCommand={vi.fn()}
      />
    )

    const totals = screen.getByLabelText('Currency totals')
    for (const [label, amount] of [
      [gold.label, '16'],
      [sheetGuildMark, '2']
    ] as const)
      expect(within(totals).getByText(label).previousElementSibling).toHaveTextContent(amount)
  })

  it('shows the labelled holdings in the Campaign inventory of the Character', async () => {
    const user = userEvent.setup()
    mocks.slice = projectCharacterSheetSlice(sheet, 'INVENTORY')
    mocks.system = system
    mocks.currencySystems.results = [
      {
        id: guildSystemId,
        label: 'Guild coinage',
        isReference: true,
        denominations: [{ id: gold.id, ...guildMark, scaleInReference: 1 }],
        version: 1
      }
    ]
    const ownerUserId = '22222222-2222-4222-8222-222222222222'
    const campaign = createCampaignDetail({
      memberships: [
        {
          userId: ownerUserId,
          username: 'owner',
          role: 'OWNER',
          accessStartedAt: '2026-09-01T00:00:00.000Z',
          acceptedAt: '2026-09-01T00:00:00.000Z',
          assignedCharacter: {
            id: fixture.character.id,
            publicId: 'aria',
            label: 'Aria',
            systemId: system.id
          }
        }
      ]
    })
    renderWithAppProviders(<CampaignInventory campaign={campaign} currentUserId={ownerUserId} />)

    await user.click(screen.getByRole('combobox', { name: 'Inventory owner' }))
    await user.click(screen.getByRole('option', { name: 'Aria' }))

    for (const [label, amount] of [
      [gold.label, `16 ${gold.short}`],
      [guildMark.label, `2 ${guildMark.abbreviation}`]
    ] as const) {
      const row = (await screen.findByText(label)).parentElement
      if (!row) throw new Error(`Expected a ${label} holding row.`)
      expect(within(row).getByText(amount)).toBeVisible()
    }
  })
})
