import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { Meta, StoryObj } from '@storybook/react-vite'
import type { ComponentProps, JSX } from 'react'
import type { SignedVttMapDeliveryDto } from '@artificer-toolkit/schema/api/media'
import { expect, userEvent, within } from 'storybook/test'
import { queryKeys } from '#app/lib/queryKeys'
import { CampaignSceneEditor } from './CampaignSceneEditor'
import {
  tabletopCampaignId,
  tabletopCurrentUserId,
  tabletopMapAssetId,
  tabletopMapDelivery,
  tabletopSceneDefinition
} from './CampaignTabletop.stories.fixtures'

const meta = {
  component: CampaignSceneEditor,
  parameters: {
    a11y: { test: 'error' },
    layout: 'fullscreen'
  },
  title: 'Domains/Campaigns/VTT/Scene Editor'
} satisfies Meta<typeof CampaignSceneEditor>

export default meta
type Story = StoryObj<typeof meta>

export const ConfiguredScene: Story = {
  args: {
    campaignId: tabletopCampaignId,
    currentUserId: tabletopCurrentUserId,
    memberships: [
      {
        acceptedAt: '2026-08-01T12:00:00.000Z',
        accessStartedAt: '2026-08-01T12:00:00.000Z',
        assignedCharacter: null,
        role: 'PLAYER',
        userId: tabletopCurrentUserId,
        username: 'ember'
      }
    ],
    onDirtyChange: () => undefined,
    scene: tabletopSceneDefinition
  },
  render: (args) => renderEditor(args, tabletopMapDelivery),
  play: async ({ canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body)
    await expect(await page.findByRole('toolbar', { name: 'Scene editor tools' })).toBeVisible()
    const wallTool = page.getByRole('button', { name: 'Draw wall' })
    await userEvent.click(wallTool)
    await expect(wallTool).toHaveAttribute('aria-pressed', 'true')
  }
}

export const MapLoadFailure: Story = {
  args: ConfiguredScene.args,
  render: (args) =>
    renderEditor(args, {
      ...tabletopMapDelivery,
      overview: { ...tabletopMapDelivery.overview, url: 'data:image/png;base64,AA==' },
      tiles: tabletopMapDelivery.tiles.map((tile) => ({
        ...tile,
        url: 'data:image/png;base64,AA=='
      }))
    })
}

function renderEditor(
  args: ComponentProps<typeof CampaignSceneEditor>,
  mapDelivery: SignedVttMapDeliveryDto
): JSX.Element {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Number.POSITIVE_INFINITY } }
  })
  queryClient.setQueryData(queryKeys.media.vttMap(tabletopMapAssetId), mapDelivery)
  return (
    <QueryClientProvider client={queryClient}>
      <CampaignSceneEditor {...args} />
    </QueryClientProvider>
  )
}
