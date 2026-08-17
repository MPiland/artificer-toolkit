import { createRef } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import { CampaignLiveSceneObjectEditor } from './CampaignLiveSceneObjectEditor'
import { createTabletopCampaign, tabletopLiveScene } from './CampaignTabletop.stories.fixtures'
import type { VttSceneRenderer } from './vttSceneRenderer'

const meta = {
  component: CampaignLiveSceneObjectEditor,
  parameters: {
    a11y: { test: 'error' },
    layout: 'fullscreen'
  },
  title: 'Domains/Campaigns/VTT/Live Object Editor'
} satisfies Meta<typeof CampaignLiveSceneObjectEditor>

export default meta
type Story = StoryObj<typeof meta>

export const TokenDraft: Story = {
  args: {
    connected: true,
    memberships: createTabletopCampaign('OWNER').memberships,
    onCommand: () => true,
    renderer: createRef<VttSceneRenderer>(),
    scene: tabletopLiveScene
  },
  play: async ({ canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body)
    const editObjectsButton = page.getByRole('button', { name: 'Edit objects' })
    editObjectsButton.focus()
    await userEvent.keyboard('{Enter}')
    await waitFor(async () => {
      await expect(page.getByRole('dialog', { name: 'Edit live scene object' })).toBeVisible()
    })
    await expect(page.getByRole('button', { name: 'Close live scene editor' })).toBeVisible()
  }
}
