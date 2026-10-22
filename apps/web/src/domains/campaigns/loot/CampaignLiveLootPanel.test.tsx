import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import type { LootTable } from '@artificer-toolkit/schema/api/lootTables'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import { CampaignLiveLootPanel } from './CampaignLiveLootPanel'

const table = (name: string): LootTable => ({
  id: crypto.randomUUID(),
  name,
  skillId: 'stealth',
  ranges: [
    {
      id: crypto.randomUUID(),
      min: 1,
      max: 10,
      entries: [{ kind: 'COIN', denominationId: 'gp', amount: 30 }]
    },
    {
      id: crypto.randomUUID(),
      min: 11,
      max: null,
      entries: [{ kind: 'ITEM', itemId: 'club', quantity: 2 }],
      note: 'Under the cot'
    }
  ]
})

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

it('lists the Scene and defeated creature tables and highlights the range a roll result matches', async () => {
  const user = userEvent.setup()
  renderWithAppProviders(
    <CampaignLiveLootPanel
      creatures={[{ id: 'goblin', label: 'Goblin', tables: [table('Pockets')] }]}
      gameSystemId='system'
      sceneTables={[table('Guard room')]}
    />
  )
  await user.click(screen.getByRole('button', { name: 'Open loot' }))
  const scene = await screen.findByRole('region', { name: 'This scene' })
  const goblin = screen.getByRole('region', { name: 'Goblin (defeated)' })
  expect(within(scene).getByText('Check: Stealth')).toBeInTheDocument()
  expect(within(scene).getByText('30 Gold Piece')).toBeInTheDocument()
  expect(within(scene).queryByText('Matches roll')).not.toBeInTheDocument()

  await user.type(within(scene).getByRole('textbox', { name: 'Roll result for Guard room' }), '14')
  const matched = within(scene).getByText('Matches roll').closest('[aria-current="true"]')
  expect(matched).toHaveTextContent('11+')
  expect(matched).toHaveTextContent('2 × Club')
  expect(matched).toHaveTextContent('Under the cot')
  // Each table keeps its own roll.
  expect(within(goblin).queryByText('Matches roll')).not.toBeInTheDocument()
})

it('says so when there is nothing to list', async () => {
  const user = userEvent.setup()
  renderWithAppProviders(
    <CampaignLiveLootPanel creatures={[]} gameSystemId='system' sceneTables={[]} />
  )
  await user.click(screen.getByRole('button', { name: 'Open loot' }))
  expect(await screen.findByText(/have no loot tables/)).toBeInTheDocument()
})
