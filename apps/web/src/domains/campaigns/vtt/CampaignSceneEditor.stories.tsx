import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { ConvexReactClient, useAction, useConvex } from 'convex/react'
import { getFunctionName } from 'convex/server'
import type { ComponentProps, JSX } from 'react'
import { api } from '@artificer-toolkit/apis/convex/api'
import type { SignedVttMapDeliveryDto } from '@artificer-toolkit/schema/api/media'
import {
  appendSceneDefinitionInputSchema,
  beginSceneDefinitionInputSchema,
  sceneDefinitionSaveProgressSchema
} from '@artificer-toolkit/schema/api/sceneDefinitionSave'
import { lootDocumentSchema } from '@artificer-toolkit/schema/api/lootTables'
import { SRD_SYSTEM_ID } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { expect, fn, mocked, userEvent, waitFor, within } from 'storybook/test'
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
  title: 'Domains/Campaigns/VTT/Scene Editor',
  beforeEach: () => {
    begin.mockClear()
    append.mockClear()
    publish.mockClear()
    getDelivery.mockClear()
    const client = new ConvexReactClient('https://story-fixture.convex.cloud', { logger: false })
    let received = { annotations: 0, barriers: 0, darknessZones: 0, lights: 0, tokens: 0 }
    Object.defineProperty(client, 'mutation', {
      value: fn<ConvexReactClient['mutation']>().mockImplementation(
        async (...[reference, input]) => {
          switch (getFunctionName(reference)) {
            case getFunctionName(api.scenes.definitions.begin): {
              const values = beginSceneDefinitionInputSchema.parse(input)
              begin(values)
              expect(values.expectedVersion).toBe(tabletopSceneDefinition.version)
              expect(values.counts).toEqual({
                annotations: tabletopSceneDefinition.annotations.length,
                barriers: tabletopSceneDefinition.barriers.length + 1,
                darknessZones: tabletopSceneDefinition.darknessZones.length,
                lights: tabletopSceneDefinition.lights.length,
                tokens: tabletopSceneDefinition.tokens.length
              })
              received = { annotations: 0, barriers: 0, darknessZones: 0, lights: 0, tokens: 0 }
              return sceneDefinitionSaveProgressSchema.parse({
                counts: values.counts,
                liveSceneId: null,
                received,
                saveId: '77777777-7777-4777-8777-777777777799',
                sceneId: tabletopSceneDefinition.id,
                status: 'RECEIVING',
                version: tabletopSceneDefinition.version + 1
              })
            }
            case getFunctionName(api.scenes.definitions.append): {
              const values = appendSceneDefinitionInputSchema.parse(input.input)
              append(values)
              received = {
                ...received,
                [values.collection]: received[values.collection] + values.entities.length
              }
              return sceneDefinitionSaveProgressSchema.parse({
                counts: {
                  annotations: tabletopSceneDefinition.annotations.length,
                  barriers: tabletopSceneDefinition.barriers.length + 1,
                  darknessZones: tabletopSceneDefinition.darknessZones.length,
                  lights: tabletopSceneDefinition.lights.length,
                  tokens: tabletopSceneDefinition.tokens.length
                },
                liveSceneId: null,
                received,
                saveId: values.saveId,
                sceneId: tabletopSceneDefinition.id,
                status: 'RECEIVING',
                version: tabletopSceneDefinition.version + 1
              })
            }
            case getFunctionName(api.scenes.definitions.publish):
              publish(input)
              return sceneDefinitionSaveProgressSchema.parse({
                counts: {
                  annotations: tabletopSceneDefinition.annotations.length,
                  barriers: tabletopSceneDefinition.barriers.length + 1,
                  darknessZones: tabletopSceneDefinition.darknessZones.length,
                  lights: tabletopSceneDefinition.lights.length,
                  tokens: tabletopSceneDefinition.tokens.length
                },
                liveSceneId: null,
                received,
                saveId: '77777777-7777-4777-8777-777777777799',
                sceneId: tabletopSceneDefinition.id,
                status: 'PUBLISHED',
                version: tabletopSceneDefinition.version + 1
              })
            default:
              throw new Error(`Unexpected Scene Editor mutation: ${getFunctionName(reference)}`)
          }
        }
      )
    })
    Object.defineProperty(client, 'query', {
      value: fn<ConvexReactClient['query']>().mockImplementation(async (...[reference]) => {
        if (getFunctionName(reference) !== getFunctionName(api.loot.tables.get))
          throw new Error(`Unexpected Scene Editor query: ${getFunctionName(reference)}`)
        return lootDocumentSchema.parse({
          owner: {
            kind: 'SCENE',
            campaignId: tabletopCampaignId,
            sceneDefinitionId: tabletopSceneDefinition.id
          },
          tables: [],
          version: 0
        })
      })
    })
    mocked(useConvex).mockReturnValue(client)
    mocked(useAction).mockImplementation((reference) => {
      if (getFunctionName(reference) !== getFunctionName(api.media.vttMapActions.getDelivery))
        throw new Error(`Unexpected Scene Editor action: ${getFunctionName(reference)}`)
      return getDelivery
    })
    return () => client.close()
  }
} satisfies Meta<typeof CampaignSceneEditor>

export default meta
type Story = StoryObj<typeof meta>

export const ConfiguredScene: Story = {
  args: {
    campaignId: tabletopCampaignId,
    currentUserId: tabletopCurrentUserId,
    gameSystemId: SRD_SYSTEM_ID,
    memberships: [
      {
        acceptedAt: '2026-08-01T12:00:00.000Z',
        accessStartedAt: '2026-08-01T12:00:00.000Z',
        assignedCharacter: null,
        characterControllerUserIds: [],
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
    await userEvent.click(page.getByRole('button', { name: 'Create wall' }))
    const saveButton = page.getByRole('button', { name: 'Save scene' })
    await expect(saveButton).toBeEnabled()
    await userEvent.click(saveButton)
    await waitFor(() => expect(saveButton).toBeDisabled())
    await waitFor(() => expect(begin).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(publish).toHaveBeenCalledTimes(1))
    await expect(append).toHaveBeenCalled()
    expect(append.mock.calls).toEqual(
      expect.arrayContaining([
        [
          expect.objectContaining({
            collection: 'barriers',
            entities: expect.arrayContaining([expect.objectContaining({ kind: 'WALL' })])
          })
        ]
      ])
    )
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

const begin = fn()
const append = fn()
const publish = fn()
const getDelivery = fn().mockResolvedValue(tabletopMapDelivery)
