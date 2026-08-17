import { createRef } from 'react'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import { createTabletopCampaign, tabletopLiveScene } from './CampaignTabletop.stories.fixtures'
import { CampaignLiveSceneObjectEditor } from './CampaignLiveSceneObjectEditor'
import type { VttSceneRenderer } from './vttSceneRenderer'

describe('CampaignLiveSceneObjectEditor', () => {
  it('keeps field edits local until one authoritative save command is sent', async () => {
    const user = userEvent.setup()
    const onCommand = vi.fn(() => true)
    renderWithAppProviders(
      <CampaignLiveSceneObjectEditor
        connected
        memberships={createTabletopCampaign('OWNER').memberships}
        renderer={createRef<VttSceneRenderer>()}
        scene={tabletopLiveScene}
        onCommand={onCommand}
      />
    )

    await user.click(screen.getByRole('button', { name: 'Edit objects' }))
    const label = await screen.findByRole('textbox', { name: 'Label' })
    await user.type(label, ' edited')

    expect(onCommand).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(onCommand).toHaveBeenCalledTimes(1)
    expect(onCommand).toHaveBeenCalledWith({
      commandId: expect.any(String),
      encounterId: tabletopLiveScene.encounterId,
      expectedSceneVersion: tabletopLiveScene.version,
      sceneId: tabletopLiveScene.id,
      token: expect.objectContaining({ label: expect.stringContaining(' edited') }),
      type: 'UPSERT_SCENE_TOKEN'
    })
  })

  it('creates the first live scene object without requiring a canvas interaction', async () => {
    const user = userEvent.setup()
    const onCommand = vi.fn(() => true)
    const emptyScene = {
      ...tabletopLiveScene,
      annotations: [],
      barriers: [],
      darknessZones: [],
      lights: [],
      tokens: []
    }
    renderWithAppProviders(
      <CampaignLiveSceneObjectEditor
        connected
        memberships={createTabletopCampaign('OWNER').memberships}
        renderer={createRef<VttSceneRenderer>()}
        scene={emptyScene}
        onCommand={onCommand}
      />
    )

    await user.click(screen.getByRole('button', { name: 'Edit objects' }))
    await user.click(await screen.findByRole('button', { name: 'Create wall' }))

    expect(onCommand).toHaveBeenCalledTimes(1)
    expect(onCommand).toHaveBeenCalledWith({
      barrier: expect.objectContaining({ kind: 'WALL' }),
      commandId: expect.any(String),
      encounterId: emptyScene.encounterId,
      expectedSceneVersion: emptyScene.version,
      sceneId: emptyScene.id,
      type: 'UPSERT_SCENE_BARRIER'
    })
  })
})
