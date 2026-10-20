import { createRef } from 'react'
import { screen, waitFor } from '@testing-library/react'
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
      expectedSceneVersion: emptyScene.version,
      sceneId: emptyScene.id,
      type: 'UPSERT_SCENE_BARRIER'
    })
  })

  it('keeps an in-progress edit when the live scene updates and saves against the version it began from', async () => {
    const user = userEvent.setup()
    const onCommand = vi.fn(() => true)
    const props = {
      connected: true,
      memberships: createTabletopCampaign('OWNER').memberships,
      onCommand,
      renderer: createRef<VttSceneRenderer>()
    }
    const view = renderWithAppProviders(
      <CampaignLiveSceneObjectEditor {...props} scene={tabletopLiveScene} />
    )

    await user.click(screen.getByRole('button', { name: 'Edit objects' }))
    await user.type(await screen.findByRole('textbox', { name: 'Label' }), ' edited')
    view.rerender(
      <CampaignLiveSceneObjectEditor
        {...props}
        scene={{ ...tabletopLiveScene, version: tabletopLiveScene.version + 1 }}
      />
    )

    expect(await screen.findByRole('textbox', { name: 'Label' })).toHaveDisplayValue(/ edited$/)
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(onCommand).toHaveBeenCalledWith(
      expect.objectContaining({ expectedSceneVersion: tabletopLiveScene.version })
    )
  })

  it('follows the live scene while clean and closes when the Scene changes', async () => {
    const user = userEvent.setup()
    const props = {
      connected: true,
      memberships: createTabletopCampaign('OWNER').memberships,
      onCommand: vi.fn(() => true),
      renderer: createRef<VttSceneRenderer>()
    }
    const view = renderWithAppProviders(
      <CampaignLiveSceneObjectEditor {...props} scene={tabletopLiveScene} />
    )

    await user.click(screen.getByRole('button', { name: 'Edit objects' }))
    expect(await screen.findByRole('textbox', { name: 'Label' })).not.toHaveValue(
      'Moved by the room'
    )

    view.rerender(
      <CampaignLiveSceneObjectEditor
        {...props}
        scene={{
          ...tabletopLiveScene,
          tokens: tabletopLiveScene.tokens.map((entry) => ({
            ...entry,
            label: 'Moved by the room'
          })),
          version: tabletopLiveScene.version + 1
        }}
      />
    )
    expect(await screen.findByDisplayValue('Moved by the room')).toBeInTheDocument()

    view.rerender(
      <CampaignLiveSceneObjectEditor
        {...props}
        scene={{ ...tabletopLiveScene, id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' }}
      />
    )
    await waitFor(() =>
      expect(screen.queryByRole('textbox', { name: 'Label' })).not.toBeInTheDocument()
    )
  })
})
