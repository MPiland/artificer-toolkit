import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { useEffect, useState, type ComponentProps, type JSX, type ReactNode } from 'react'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import { http, HttpResponse } from 'msw'
import type { CampaignDetailDto } from '@artificer-toolkit/schema/api/campaigns'
import type { LiveSessionWebSocketServerMessageDto } from '@artificer-toolkit/schema/api/liveSessions'
import { projectSceneForViewer } from '@artificer-toolkit/shared/vtt'
import { getCampaignDetail, getCampaignSession } from '#app/data/campaigns/queries'
import { getCampaignEncounters } from '#app/data/encounters/queries'
import { queryKeys } from '#app/lib/queryKeys'
import {
  createTabletopCampaign,
  tabletopCampaignId,
  tabletopCurrentUserId,
  tabletopGmEncounter,
  tabletopLiveScene,
  tabletopMapDelivery,
  tabletopPlayerEncounter,
  tabletopSession
} from './CampaignTabletop.stories.fixtures'
import { CampaignTabletopWindow } from './CampaignTabletopWindow'

const liveSessionTicketHandler = http.post('*/api/trpc/campaigns.sessions.ticket', () =>
  HttpResponse.json([
    {
      result: {
        data: {
          expiresAt: '2099-08-15T23:59:00.000Z',
          ticket: 'storybook-live-session-ticket'
        }
      }
    }
  ])
)
const sceneDefinitionsHandler = http.get('*/api/trpc/campaigns.scenes.list', () =>
  HttpResponse.json([{ result: { data: [] } }])
)
const campaignDetailHandler = (campaign: CampaignDetailDto) =>
  http.get('*/api/trpc/campaigns.get', () => HttpResponse.json([{ result: { data: campaign } }]))
const campaignSessionHandler = http.get('*/api/trpc/campaigns.sessions.get', () =>
  HttpResponse.json([{ result: { data: tabletopSession } }])
)
const encounterListHandler = (
  encounter: typeof tabletopGmEncounter | typeof tabletopPlayerEncounter
) =>
  http.get('*/api/trpc/encounters.list', () =>
    HttpResponse.json([{ result: { data: [encounter] } }])
  )

const meta = {
  component: CampaignTabletopWindow,
  parameters: {
    a11y: { test: 'error' },
    layout: 'fullscreen',
    msw: {
      handlers: [liveSessionTicketHandler, sceneDefinitionsHandler]
    }
  },
  title: 'Domains/Campaigns/VTT/Tabletop Window'
} satisfies Meta<typeof CampaignTabletopWindow>

export default meta
type Story = StoryObj<typeof meta>

export const GmWindow: Story = {
  args: {
    campaignId: tabletopCampaignId,
    currentUserId: tabletopCurrentUserId,
    sessionNumber: tabletopSession.sessionNumber
  },
  parameters: {
    msw: {
      handlers: [
        liveSessionTicketHandler,
        sceneDefinitionsHandler,
        campaignDetailHandler(createTabletopCampaign('OWNER')),
        campaignSessionHandler,
        encounterListHandler(tabletopGmEncounter)
      ]
    }
  },
  render: (args) => renderWindow(args, createTabletopCampaign('OWNER')),
  play: async ({ canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body)
    await expect(
      await page.findByRole('region', { name: 'Live scene: The Lantern Vault' })
    ).toBeVisible()
    await expect(
      await page.findByText('Scene map ready.', undefined, { timeout: 30_000 })
    ).toBeInTheDocument()
    await expect(page.getByLabelText('Tabletop mode')).toBeVisible()
    await userEvent.click(page.getByRole('radio', { name: /^Edit$/ }))
    await expect(page.getByRole('button', { name: 'Edit objects' })).toBeVisible()
    await expect(page.getByRole('toolbar', { name: 'Edit tools' })).toBeVisible()
    const drawWallButton = page.getByRole('button', { name: 'Draw wall' })
    await userEvent.click(drawWallButton)
    await expect(drawWallButton).toHaveAttribute('aria-pressed', 'true')

    const editObjectsButton = page.getByRole('button', { name: 'Edit objects' })
    await userEvent.click(editObjectsButton)
    await waitFor(async () => {
      await expect(page.getByRole('dialog', { name: 'Edit live scene object' })).toBeVisible()
    })
  }
}

export const PlayerWindow: Story = {
  args: {
    campaignId: tabletopCampaignId,
    currentUserId: tabletopCurrentUserId,
    sessionNumber: tabletopSession.sessionNumber
  },
  parameters: {
    msw: {
      handlers: [
        liveSessionTicketHandler,
        sceneDefinitionsHandler,
        campaignDetailHandler(createTabletopCampaign('PLAYER')),
        campaignSessionHandler,
        encounterListHandler(tabletopPlayerEncounter)
      ]
    }
  },
  render: (args) => renderWindow(args, createTabletopCampaign('PLAYER')),
  play: async ({ canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body)
    await expect(
      await page.findByRole('region', { name: 'Live scene: The Lantern Vault' })
    ).toBeVisible()
    await expect(
      await page.findByText('Scene map ready.', undefined, { timeout: 30_000 })
    ).toBeInTheDocument()
    await expect(page.queryByLabelText('Tabletop mode')).not.toBeInTheDocument()
    await expect(page.getByRole('toolbar', { name: 'Play tools' })).toBeVisible()
    const sceneControlsButton = page.getByRole('button', { name: 'Scene controls' })
    await userEvent.click(sceneControlsButton)
    const sceneControls = await page.findByRole('menu', { name: 'Scene controls' })
    await waitFor(async () => {
      await expect(sceneControls).toBeVisible()
    })
    const controls = within(sceneControls)
    await expect(controls.getByText('Focus Ember')).toBeVisible()
    await expect(controls.getByText(/Remove Vault span/)).toBeVisible()
    await expect(controls.getByText('No doors')).toBeVisible()
    await expect(page.queryByText('Reveal entire map')).not.toBeInTheDocument()
    await expect(page.queryByRole('button', { name: 'Edit objects' })).not.toBeInTheDocument()
  }
}

function renderWindow(
  args: ComponentProps<typeof CampaignTabletopWindow>,
  campaign: CampaignDetailDto
): JSX.Element {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Number.POSITIVE_INFINITY } }
  })
  queryClient.setQueryData(getCampaignDetail(tabletopCampaignId).queryKey, campaign)
  queryClient.setQueryData(
    getCampaignSession(tabletopCampaignId, tabletopSession.sessionNumber).queryKey,
    tabletopSession
  )
  const encounter = campaign.role === 'OWNER' ? tabletopGmEncounter : tabletopPlayerEncounter
  queryClient.setQueryData(getCampaignEncounters(tabletopCampaignId).queryKey, [encounter])
  queryClient.setQueryData(queryKeys.media.vttMap(tabletopMapDelivery.assetId), tabletopMapDelivery)

  return (
    <StoryLiveSessionTransport role={campaign.role}>
      <QueryClientProvider client={queryClient}>
        <CampaignTabletopWindow
          campaignId={args.campaignId}
          currentUserId={args.currentUserId}
          sessionNumber={args.sessionNumber}
        />
      </QueryClientProvider>
    </StoryLiveSessionTransport>
  )
}

function StoryLiveSessionTransport({
  children,
  role
}: {
  children: ReactNode
  role: CampaignDetailDto['role']
}) {
  const [installed, setInstalled] = useState(false)

  useEffect(() => {
    const originalWebSocket = globalThis.WebSocket
    const scene =
      role === 'OWNER'
        ? tabletopLiveScene
        : projectSceneForViewer(tabletopLiveScene, {
            role: 'PLAYER',
            userId: tabletopCurrentUserId
          })
    const readyMessage = {
      aggregateVersions: [
        {
          aggregateId: tabletopGmEncounter.id,
          aggregateKind: 'ENCOUNTER',
          version: tabletopGmEncounter.version
        },
        { aggregateId: scene.id, aggregateKind: 'SCENE', version: scene.version }
      ],
      campaignId: tabletopCampaignId,
      deliverySequence: 0,
      sceneSnapshots: [{ campaignId: tabletopCampaignId, scene, sessionId: tabletopSession.id }],
      sessionId: tabletopSession.id,
      type: 'READY'
    } satisfies LiveSessionWebSocketServerMessageDto

    class StoryWebSocket extends EventTarget {
      readyState = 0

      constructor() {
        super()
        queueMicrotask(() => {
          if (this.readyState !== 0) return
          this.readyState = 1
          this.dispatchEvent(new Event('open'))
          this.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(readyMessage) }))
        })
      }

      close(code = 1000, reason = ''): void {
        if (this.readyState === 3) return
        this.readyState = 3
        this.dispatchEvent(new CloseEvent('close', { code, reason }))
      }

      send(): void {}
    }

    Reflect.set(globalThis, 'WebSocket', StoryWebSocket)
    setInstalled(true)
    return () => {
      Reflect.set(globalThis, 'WebSocket', originalWebSocket)
    }
  }, [role])

  return installed ? children : null
}
