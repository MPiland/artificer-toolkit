import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'
import { saveSceneDefinition } from '#app/data/campaigns/scenes'
import { sceneDefinitionDtoSchema } from '@artificer-toolkit/schema/api/vttScenes'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import { CampaignSceneEditor } from './CampaignSceneEditor'
import {
  tabletopSceneDefinition,
  tabletopCurrentUserId,
  tabletopMapDelivery
} from './CampaignTabletop.stories.fixtures'

const { delivery } = vi.hoisted(() => ({ delivery: vi.fn() }))

vi.mock('convex/react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('convex/react')>()),
  useAction: () => delivery
}))
vi.mock('#app/data/campaigns/scenes', () => ({ saveSceneDefinition: vi.fn() }))
vi.mock('../loot/CampaignLootEditor', () => ({ CampaignLootEditor: () => null }))
vi.mock('./vttSceneRenderer', () => ({
  createVttSceneRenderer: async () => ({ update: vi.fn(), destroy: vi.fn() })
}))
afterEach(() => vi.clearAllMocks())

it('preserves a dirty draft during refresh and reuses its save attempt until the draft changes', async () => {
  const user = userEvent.setup()
  delivery.mockResolvedValue(tabletopMapDelivery)
  const save = vi.mocked(saveSceneDefinition).mockRejectedValue(new Error('Retry the save.'))
  const props = {
    campaignId: tabletopSceneDefinition.campaignId,
    currentUserId: tabletopCurrentUserId,
    gameSystemId: '11111111-1111-4111-8111-111111111111',
    memberships: [],
    onDirtyChange: vi.fn(),
    scene: tabletopSceneDefinition
  }
  const { rerender } = renderWithAppProviders(<CampaignSceneEditor {...props} />)
  await user.click(screen.getByRole('button', { name: 'Create wall' }))
  await waitFor(() => expect(props.onDirtyChange).toHaveBeenLastCalledWith(true))
  rerender(
    <CampaignSceneEditor
      {...props}
      scene={{
        ...tabletopSceneDefinition,
        version: tabletopSceneDefinition.version + 1,
        name: 'Updated elsewhere',
        map: { ...tabletopSceneDefinition.map, assetId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }
      }}
    />
  )
  expect(
    screen.getByRole('region', { name: `Scene editor: ${tabletopSceneDefinition.name}` })
  ).toBeInTheDocument()
  expect(delivery).not.toHaveBeenCalledWith({ assetId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' })
  await user.click(screen.getByRole('button', { name: 'Save scene' }))
  await screen.findByText('Retry the save.')
  const first = save.mock.calls[0]!
  expect(first[1]).toMatchObject({ expectedVersion: tabletopSceneDefinition.version })
  expect(first[1].barriers).toHaveLength(tabletopSceneDefinition.barriers.length + 1)
  save.mockResolvedValueOnce(
    sceneDefinitionDtoSchema.parse({
      ...tabletopSceneDefinition,
      barriers: first[1].barriers,
      version: tabletopSceneDefinition.version + 1
    })
  )
  await user.click(screen.getByRole('button', { name: 'Save scene' }))
  await waitFor(() => expect(screen.getByRole('button', { name: 'Save scene' })).toBeDisabled())
  expect(save.mock.calls[1]).toEqual(first)
  await user.click(screen.getByRole('button', { name: 'Create wall' }))
  await user.click(screen.getByRole('button', { name: 'Save scene' }))
  await waitFor(() => expect(save).toHaveBeenCalledTimes(3))
  expect(save.mock.calls[2]?.[2]).not.toBe(first[2])
})
