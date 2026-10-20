import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import { tabletopSceneDefinition } from './CampaignTabletop.stories.fixtures'
import { sceneCreationDefaults } from './SceneObjectCreator.model'
import { SceneObjectCreator } from './SceneObjectCreator'

describe('SceneObjectCreator', () => {
  it('keeps edited coordinates until the map size changes, then returns to the centered defaults', async () => {
    const user = userEvent.setup()
    const mapX = () => screen.getByRole('textbox', { name: 'Map X' })
    const resized = {
      ...tabletopSceneDefinition,
      map: { ...tabletopSceneDefinition.map, width: tabletopSceneDefinition.map.width * 2 }
    }
    const view = renderWithAppProviders(
      <SceneObjectCreator disabled={false} scene={tabletopSceneDefinition} onCreate={vi.fn()} />
    )

    await screen.findByRole('textbox', { name: 'Map X' })
    await user.clear(mapX())
    await user.type(mapX(), '3')
    view.rerender(
      <SceneObjectCreator disabled={false} scene={tabletopSceneDefinition} onCreate={vi.fn()} />
    )
    expect(mapX()).toHaveValue('3')

    view.rerender(<SceneObjectCreator disabled={false} scene={resized} onCreate={vi.fn()} />)
    expect(mapX()).toHaveValue(String(sceneCreationDefaults(resized).x))
  })
})
