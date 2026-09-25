import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { SceneDefinitionDto } from '@artificer-toolkit/schema/api/vttScenes'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import { tabletopSceneDefinition } from './CampaignTabletop.stories.fixtures'
import { CampaignSceneObjectInspector } from './CampaignSceneObjectInspector'

function renderFogSettings(fogMode: SceneDefinitionDto['fogMode']) {
  const onChange = vi.fn()
  renderWithAppProviders(
    <CampaignSceneObjectInspector
      disabled={false}
      memberships={[]}
      scene={{ ...tabletopSceneDefinition, fogMode }}
      section='FOG'
      onChange={onChange}
      onFocus={vi.fn()}
    />
  )
  return onChange
}

describe('CampaignSceneObjectInspector fog of war', () => {
  it('keeps fog off and hides the fog choices until the GM turns fog on', async () => {
    const user = userEvent.setup()
    const onChange = renderFogSettings('OFF')

    expect(screen.getByRole('switch', { name: 'Fog of war' })).not.toBeChecked()
    expect(screen.queryByRole('radiogroup', { name: 'Fog visibility' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('switch', { name: 'Fog of war' }))
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ fogMode: 'SHARED_PARTY' }))
  })

  it('shows the shared-party or per-player choice while fog is on and turns fog off', async () => {
    const user = userEvent.setup()
    const onChange = renderFogSettings('PER_PLAYER')

    expect(screen.getByRole('switch', { name: 'Fog of war' })).toBeChecked()
    expect(screen.getByRole('radiogroup', { name: 'Fog visibility' })).toBeInTheDocument()

    await user.click(screen.getByRole('switch', { name: 'Fog of war' }))
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ fogMode: 'OFF' }))
  })
})
