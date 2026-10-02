import { convexQuery } from '@convex-dev/react-query'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { ConvexReactClient, useConvex } from 'convex/react'
import { getFunctionName } from 'convex/server'
import { useEffect, useState, type ComponentProps, type JSX, type ReactNode } from 'react'
import { expect, fn, mocked, userEvent, waitFor, within } from 'storybook/test'
import { http, HttpResponse } from 'msw'
import { api as convexApi } from '@artificer-toolkit/apis/convex/api'
import type { CampaignDetailDto } from '@artificer-toolkit/schema/api/campaigns'
import {
  encounterCommandResultDtoSchema,
  type EncounterCommandResultDto
} from '@artificer-toolkit/schema/api/encounters'
import {
  sceneFogAppendInputSchema,
  sceneFogChunksPageInputSchema,
  sceneFogChunksPageSchema,
  sceneFogLayersPageInputSchema,
  sceneFogLayersPageSchema,
  sceneFogPatchInputSchema,
  type SceneFogPatchInput
} from '@artificer-toolkit/schema/api/sceneFog'
import type {
  LiveSessionRecipientStateDto,
  LiveSessionWebSocketServerMessageDto
} from '@artificer-toolkit/schema/api/liveSessions'
import { liveSessionWebSocketClientMessageDtoSchema } from '@artificer-toolkit/schema/api/liveSessions'
import {
  sceneEncounterBindingSchema,
  sceneRecipientHeaderSchema,
  sceneRecipientEncounterBindingsInputSchema,
  sceneRecipientEncounterBindingsPageSchema,
  sceneRecipientPageInputSchema,
  sceneRecipientPageSchema
} from '@artificer-toolkit/schema/api/sceneRecipient'
import {
  type CampaignSceneStateDto,
  setCampaignLiveScenePresentationInputDtoSchema,
  setCampaignLiveScenePresentationResultDtoSchema
} from '@artificer-toolkit/schema/api/vttScenes'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { projectSceneForViewer } from '@artificer-toolkit/shared/vtt'
import { getCampaignDetail } from '#app/data/campaigns/queries'
import {
  createTabletopCampaign,
  tabletopCampaignId,
  tabletopCurrentUserId,
  tabletopGmEncounter,
  tabletopLiveScene,
  tabletopMapDelivery,
  tabletopPlayerEncounter
} from './CampaignTabletop.stories.fixtures'
import { CampaignTabletopWindow } from './CampaignTabletopWindow'

const liveSessionTokenHandler = http.get('*/api/auth/convex/token', () =>
  HttpResponse.json({ token: 'story-convex-access-token' })
)
const recipientRevision = 'a'.repeat(64)
const mapReadyTimeoutMs = 10_000
const liveCommand = fn()
const mediaGetDelivery = fn()
const fogBegin = fn()
const fogAppend = fn()
const storyFogSaveId = '77777777-7777-4777-8777-777777777799'
const meta = {
  component: CampaignTabletopWindow,
  parameters: {
    a11y: { test: 'error' },
    layout: 'fullscreen',
    msw: {
      handlers: [liveSessionTokenHandler]
    }
  },
  title: 'Domains/Campaigns/VTT/Tabletop Window'
} satisfies Meta<typeof CampaignTabletopWindow>

export default meta
type Story = StoryObj<typeof meta>

export const GmWindow: Story = {
  args: {
    campaignId: tabletopCampaignId,
    currentUserId: tabletopCurrentUserId
  },
  render: (args) => renderWindow(args, createTabletopCampaign('OWNER')),
  play: async ({ canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body)
    await expect(
      await page.findByText('Scene map ready.', undefined, { timeout: mapReadyTimeoutMs })
    ).toBeInTheDocument()
    await expect(page.getByRole('region', { name: 'Live scene: The Lantern Vault' })).toBeVisible()
    await expect(mediaGetDelivery).toHaveBeenCalledWith({
      assetId: tabletopMapDelivery.assetId
    })
    await expect(page.getByLabelText('Tabletop mode')).toBeVisible()
    await userEvent.click(page.getByRole('radio', { name: /^Edit$/ }))
    await expect(page.getByRole('button', { name: 'Edit objects' })).toBeVisible()
    await expect(page.getByRole('toolbar', { name: 'Edit tools' })).toBeVisible()
    const drawWallButton = page.getByRole('button', { name: 'Draw wall' })
    await userEvent.click(drawWallButton)
    await expect(drawWallButton).toHaveAttribute('aria-pressed', 'true')

    const editObjectsButton = page.getByRole('button', {
      name: 'Edit objects'
    })
    await userEvent.click(editObjectsButton)
    await waitFor(async () => {
      await expect(page.getByRole('dialog', { name: 'Edit live scene object' })).toBeVisible()
    })
    await waitFor(async () => {
      await expect(page.getByRole('button', { name: 'Create wall' })).toBeEnabled()
    })
    await userEvent.click(page.getByRole('button', { name: 'Create wall' }))
    // The room is the only writer of the presented Scene (D79).
    await waitFor(async () => {
      await expect(liveCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          command: {
            command: expect.objectContaining({
              expectedSceneVersion: tabletopLiveScene.version,
              sceneId: tabletopLiveScene.id,
              type: 'UPSERT_SCENE_BARRIER'
            }),
            scope: 'SCENE'
          },
          type: 'COMMAND'
        })
      )
    })
    await userEvent.click(page.getByRole('button', { name: 'Close live scene editor' }))
    await userEvent.click(page.getByRole('button', { name: 'Scene controls' }))
    await userEvent.click(await page.findByRole('menuitem', { name: 'Move Ember right' }))
    await waitFor(() =>
      expect(liveCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          command: {
            command: expect.objectContaining({
              type: 'MOVE_SCENE_TOKEN',
              expectedEncounterVersion: null,
              expectedSceneVersion: tabletopLiveScene.version,
              tokenId: tabletopLiveScene.tokens[0]!.id,
              path: expect.arrayContaining([tabletopLiveScene.tokens[0]!.position])
            }),
            scope: 'SCENE'
          },
          expectedSessionSequence: 1,
          type: 'COMMAND'
        })
      )
    )
    await userEvent.click(page.getByRole('button', { name: 'Scene controls' }))
    await userEvent.click(await page.findByRole('menuitem', { name: 'Move Vault Warden right' }))
    await waitFor(() =>
      expect(liveCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          command: {
            command: expect.objectContaining({
              type: 'MOVE_SCENE_TOKEN',
              expectedEncounterVersion: tabletopGmEncounter.version,
              expectedSceneVersion: tabletopLiveScene.version,
              tokenId: tabletopLiveScene.tokens[1]!.id,
              path: expect.arrayContaining([tabletopLiveScene.tokens[1]!.position])
            }),
            scope: 'SCENE'
          },
          expectedSessionSequence: 1,
          type: 'COMMAND'
        })
      )
    )
    await userEvent.click(page.getByRole('button', { name: 'Undo last token move' }))
    await waitFor(() =>
      expect(liveCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          command: {
            command: expect.objectContaining({
              type: 'UNDO_LAST_SCENE_MOVE',
              expectedSceneVersion: tabletopLiveScene.version,
              sceneId: tabletopLiveScene.id
            }),
            scope: 'SCENE'
          },
          expectedSessionSequence: 1,
          type: 'COMMAND'
        })
      )
    )
    await userEvent.click(page.getByRole('button', { name: 'Open turn order' }))
    await userEvent.click(await page.findByRole('button', { name: 'Next turn' }))
    await waitFor(async () => {
      await expect(liveCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          command: {
            command: expect.objectContaining({ type: 'ADVANCE_TURN' }),
            scope: 'ENCOUNTER'
          },
          type: 'COMMAND'
        })
      )
    })
    const emberTokenSelect = page.getByLabelText("Scene token for Ember's Wake")
    // Turn controls stay disabled until the room acknowledges the turn change.
    await waitFor(() => expect(emberTokenSelect).toBeEnabled())
    await userEvent.click(emberTokenSelect)
    await userEvent.click(await page.findByRole('option', { name: 'Ember' }))
    await waitFor(async () => {
      await expect(liveCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          command: {
            command: expect.objectContaining({
              encounterId: tabletopGmEncounter.id,
              sceneId: tabletopLiveScene.id,
              tokenId: tabletopLiveScene.tokens[0]!.id,
              type: 'SET_ENCOUNTER_SCENE_ACTOR_TOKEN_BINDING'
            }),
            scope: 'ENCOUNTER'
          },
          type: 'COMMAND'
        })
      )
    })
    await userEvent.click(page.getByRole('button', { name: 'Scene controls' }))
    await userEvent.click(await page.findByRole('menuitem', { name: 'Reveal entire map' }))
    await waitFor(async () => {
      await expect(fogBegin).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'PATCH_SCENE_FOG' })
      )
      const input = sceneFogPatchInputSchema.parse(fogBegin.mock.calls[0]?.[0])
      await expect(input.chunkManifest).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            checksum: expect.stringMatching(/^[a-f0-9]{64}$/)
          })
        ])
      )
      await expect(fogAppend).toHaveBeenCalled()
      const appendInputs = fogAppend.mock.calls.map(([args]) =>
        sceneFogAppendInputSchema.parse(args)
      )
      await expect(appendInputs.every((append) => append.chunks.length <= 8)).toBe(true)
      await expect(input.chunkManifest).toEqual(
        appendInputs.flatMap((append) =>
          append.chunks.map((chunk) => ({
            index: chunk.index,
            checksum: checksumCanonicalJson(chunk)
          }))
        )
      )
      await expect(liveCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          command: {
            command: expect.objectContaining({
              commandId: input.commandId,
              saveId: storyFogSaveId,
              type: 'PUBLISH_SCENE_FOG_PATCH'
            }),
            scope: 'SCENE'
          },
          type: 'COMMAND'
        })
      )
    })
  }
}

export const PlayerWindow: Story = {
  args: {
    campaignId: tabletopCampaignId,
    currentUserId: tabletopCurrentUserId
  },
  render: (args) => renderWindow(args, createTabletopCampaign('PLAYER')),
  play: async ({ canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body)
    await expect(
      await page.findByText('Scene map ready.', undefined, { timeout: mapReadyTimeoutMs })
    ).toBeInTheDocument()
    await expect(page.getByRole('region', { name: 'Live scene: The Lantern Vault' })).toBeVisible()
    await expect(mediaGetDelivery).toHaveBeenCalledWith({
      assetId: tabletopMapDelivery.assetId
    })
    await expect(page.queryByLabelText('Tabletop mode')).not.toBeInTheDocument()
    await expect(page.getByRole('toolbar', { name: 'Play tools' })).toBeVisible()
    const sceneControlsButton = page.getByRole('button', {
      name: 'Scene controls'
    })
    await userEvent.click(sceneControlsButton)
    const sceneControls = await page.findByRole('menu', {
      name: 'Scene controls'
    })
    await waitFor(async () => {
      await expect(sceneControls).toBeVisible()
    })
    const controls = within(sceneControls)
    await expect(controls.getByText('Focus Ember')).toBeVisible()
    await expect(controls.getByText(/Remove Vault span/)).toBeVisible()
    await expect(controls.getByText('No doors')).toBeVisible()
    await expect(page.queryByText('Vault Warden')).not.toBeInTheDocument()
    await expect(page.queryByText('Reveal entire map')).not.toBeInTheDocument()
    await expect(page.queryByRole('button', { name: 'Edit objects' })).not.toBeInTheDocument()
  }
}

function renderWindow(
  args: ComponentProps<typeof CampaignTabletopWindow>,
  campaign: CampaignDetailDto
): JSX.Element {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Number.POSITIVE_INFINITY }
    }
  })
  queryClient.setQueryDefaults(getCampaignDetail(tabletopCampaignId).queryKey, {
    queryFn: async () => campaign
  })
  // This Scene fixture has no Character Sheet action data.
  queryClient.setQueryDefaults(['convexQuery', 'characters/sheetSlices:get'], {
    queryFn: async () => null
  })
  queryClient.setQueryData(getCampaignDetail(tabletopCampaignId).queryKey, campaign)
  const encounter = campaign.role === 'OWNER' ? tabletopGmEncounter : tabletopPlayerEncounter
  const scene = projectScene(campaign.role)
  const header = recipientHeader(scene)
  const nativeActorTokenBindings = scene.tokens.slice(1).flatMap((token, index) => {
    const actor = encounter.actors[index + 1]
    return actor
      ? [
          {
            actorId: actor.id,
            encounterId: encounter.id,
            sceneId: scene.id,
            tokenId: token.id
          }
        ]
      : []
  })
  const encounterResult = encounterCommandResultDtoSchema.parse({
    projection: { ...encounter, version: encounter.version + 1 },
    roll: null,
    occurrence: null
  })
  const sceneBinding = sceneEncounterBindingSchema.parse({
    encounterId: encounter.id,
    encounterVersion: encounter.version,
    sceneId: scene.id
  })
  const presentation = {
    campaignId: tabletopCampaignId,
    sceneId: scene.id,
    version: 0
  }
  mediaGetDelivery.mockReset().mockResolvedValue(tabletopMapDelivery)
  const presentationQuery = convexQuery(convexApi.scenes.presentations.get, {
    campaignId: tabletopCampaignId
  })
  const headerQuery = convexQuery(convexApi.scenes.recipientReads.header, {
    sceneId: scene.id,
    includeSnapshot: false
  })
  const sceneBindingQuery = convexQuery(convexApi.encounters.sceneBindings.get, {
    encounterId: encounter.id,
    sceneId: scene.id
  })
  const activeEncounterQuery = convexQuery(convexApi.encounters.activeReads.active, {
    campaignId: tabletopCampaignId
  })
  const pendingPreparedQuery = convexQuery(convexApi.encounters.projectionReads.pendingPrepared, {
    campaignId: tabletopCampaignId
  })
  const skippedActionChoicesQuery = convexQuery(convexApi.encounters.actionChoices.get, 'skip')
  queryClient.setQueryDefaults(presentationQuery.queryKey, {
    queryFn: async () => presentation
  })
  queryClient.setQueryDefaults(headerQuery.queryKey, {
    queryFn: async () => header
  })
  queryClient.setQueryDefaults(sceneBindingQuery.queryKey.slice(0, 2), {
    queryFn: async () => sceneBinding
  })
  queryClient.setQueryDefaults(activeEncounterQuery.queryKey, {
    queryFn: async () => ({ encounter, pending: null, waitingOn: null, turnMovement: [] })
  })
  queryClient.setQueryDefaults(pendingPreparedQuery.queryKey, { queryFn: async () => [] })
  const rollPreferencesQuery = convexQuery(convexApi.account.rollPreferences, {})
  queryClient.setQueryDefaults(rollPreferencesQuery.queryKey, {
    queryFn: async () => ({ autoRollDice: true })
  })
  queryClient.setQueryDefaults(skippedActionChoicesQuery.queryKey, {
    queryFn: async () => null
  })
  queryClient.setQueryData(presentationQuery.queryKey, presentation)
  queryClient.setQueryData(headerQuery.queryKey, header)
  queryClient.setQueryData(sceneBindingQuery.queryKey, sceneBinding)
  queryClient.setQueryData(activeEncounterQuery.queryKey, {
    encounter,
    pending: null,
    waitingOn: null,
    turnMovement: []
  })
  queryClient.setQueryData(pendingPreparedQuery.queryKey, [])
  queryClient.setQueryData(rollPreferencesQuery.queryKey, { autoRollDice: true })
  const convex = new ConvexReactClient('https://story-fixture.convex.cloud', {
    logger: false
  })
  Object.defineProperty(convex, 'query', {
    value: fn<ConvexReactClient['query']>().mockImplementation(async (...[reference, args]) => {
      const name = getFunctionName(reference)
      if (name === getFunctionName(convexApi.encounters.activeReads.active))
        return { encounter, pending: null, waitingOn: null, turnMovement: [] }
      if (name === getFunctionName(convexApi.encounters.projectionReads.pendingPrepared)) return []
      if (name === getFunctionName(convexApi.scenes.presentations.get)) return presentation
      if (name === getFunctionName(convexApi.scenes.recipientReads.header)) return header
      if (name === getFunctionName(convexApi.encounters.sceneBindings.get)) return sceneBinding
      if (name === getFunctionName(convexApi.scenes.definitionReads.listLive))
        return {
          page: [
            {
              definitionId: tabletopLiveScene.definitionId,
              id: tabletopLiveScene.id,
              name: tabletopLiveScene.name,
              version: tabletopLiveScene.version
            }
          ],
          isDone: true,
          continueCursor: ''
        }
      if (name === getFunctionName(convexApi.scenes.fogReads.layers)) {
        const input = sceneFogLayersPageInputSchema.parse(args)
        const start = input.paginationOpts.cursor === null ? 0 : Number(input.paginationOpts.cursor)
        const page = scene.fogLayers.slice(start, start + input.paginationOpts.numItems)
        const next = start + page.length
        return sceneFogLayersPageSchema.parse({
          version: scene.version,
          page: page.map((layer, ordinal) => ({
            ownerUserId: layer.ownerUserId,
            width: layer.width,
            height: layer.height,
            chunkCount: layer.chunks.length,
            ordinal: start + ordinal
          })),
          isDone: next === scene.fogLayers.length,
          continueCursor: next === scene.fogLayers.length ? '' : String(next),
          pageStatus: null,
          splitCursor: null
        })
      }
      if (name === getFunctionName(convexApi.scenes.fogReads.chunks)) {
        const input = sceneFogChunksPageInputSchema.parse(args)
        const layer = scene.fogLayers.find(
          (candidate) => candidate.ownerUserId === input.ownerUserId
        )
        if (!layer) throw new Error('Story fixture fog layer was not found.')
        const page = layer.chunks.slice(input.offset, input.offset + input.numItems)
        const nextOffset = input.offset + page.length
        return sceneFogChunksPageSchema.parse({
          version: scene.version,
          ownerUserId: layer.ownerUserId,
          width: layer.width,
          height: layer.height,
          page,
          nextOffset,
          isDone: nextOffset === layer.chunks.length
        })
      }
      throw new Error(`Unexpected story fixture query: ${name}`)
    })
  })
  Object.defineProperty(convex, 'action', {
    value: fn<ConvexReactClient['action']>().mockImplementation(async (...[reference, args]) => {
      const name = getFunctionName(reference)
      if (name === getFunctionName(convexApi.liveSessions.tickets.issue)) {
        return {
          expiresAt: '2099-08-15T23:59:00.000Z',
          ticket: 'storybook-live-session-ticket'
        }
      }
      if (name === getFunctionName(convexApi.media.vttMapActions.getDelivery)) {
        return mediaGetDelivery(args)
      }
      if (
        name === getFunctionName(convexApi.media.characterPortraitActions.getImage) ||
        name === getFunctionName(convexApi.media.authoredActions.getImage)
      )
        return null
      if (name === getFunctionName(convexApi.scenes.presentations.setLive)) {
        const input = setCampaignLiveScenePresentationInputDtoSchema.parse(args)
        return setCampaignLiveScenePresentationResultDtoSchema.parse({
          commandId: input.commandId,
          replayed: false,
          campaignId: input.campaignId,
          sceneId: input.sceneId,
          version: presentation.version + 1
        })
      }
      if (name === getFunctionName(convexApi.scenes.recipientActions.encounterBindings)) {
        const input = sceneRecipientEncounterBindingsInputSchema.parse(args)
        if (
          input.expectedRecipientRevision !== recipientRevision ||
          input.expectedEncounterVersion !== encounter.version
        )
          throw new Error('Story fixture Encounter binding fence did not match.')
        const start =
          input.afterEntityId === null
            ? 0
            : scene.tokens.findIndex((token) => token.id === input.afterEntityId) + 1
        if (start <= 0 && input.afterEntityId !== null)
          throw new Error('Story fixture Encounter binding continuation was not found.')
        const pageTokens = scene.tokens.slice(start, start + input.numItems)
        const next = start + pageTokens.length
        return sceneRecipientEncounterBindingsPageSchema.parse({
          ...sceneBinding,
          page: pageTokens.flatMap((token) => {
            const binding = nativeActorTokenBindings.find(
              (candidate) => candidate.tokenId === token.id
            )
            return binding ? [binding] : []
          }),
          recipientRevision,
          next: next === scene.tokens.length ? null : (pageTokens.at(-1)?.id ?? null),
          version: scene.version
        })
      }
      if (name !== getFunctionName(convexApi.scenes.recipientActions.entities))
        throw new Error(`Unexpected story fixture action: ${name}`)
      const input = sceneRecipientPageInputSchema.parse(args)
      if (input.expectedRecipientRevision !== recipientRevision)
        throw new Error('Story fixture recipient revision did not match.')
      const entities = scene[input.collection]
      const start =
        input.afterEntityId === null
          ? 0
          : entities.findIndex((entity) => entity.id === input.afterEntityId) + 1
      if (start <= 0 && input.afterEntityId !== null)
        throw new Error('Story fixture recipient entity was not found.')
      const page = entities.slice(start, start + input.numItems)
      const next = start + page.length
      return sceneRecipientPageSchema.parse({
        version: scene.version,
        recipientRevision,
        collection: input.collection,
        page: page.map((entity) => ({
          value: { collection: input.collection, entity },
          doorState:
            input.collection === 'barriers' && 'kind' in entity && entity.kind === 'DOOR'
              ? (scene.doorStates[entity.id] ?? null)
              : null
        })),
        next: next === entities.length ? null : (page.at(-1)?.id ?? null)
      })
    })
  })
  Object.defineProperty(convex, 'mutation', {
    value: fn<ConvexReactClient['mutation']>().mockImplementation(async (...[reference]) => {
      throw new Error(`Unexpected story fixture mutation: ${getFunctionName(reference)}`)
    })
  })
  fogBegin.mockReset()
  fogAppend.mockReset()

  const recipientState: LiveSessionRecipientStateDto = { recipientRole: campaign.role, scene }
  liveCommand.mockReset()
  return (
    <StoryLiveSessionTransport encounterResult={encounterResult} state={recipientState}>
      <StoryConvexFixture client={convex}>
        <QueryClientProvider client={queryClient}>
          <CampaignTabletopWindow campaignId={args.campaignId} currentUserId={args.currentUserId} />
        </QueryClientProvider>
      </StoryConvexFixture>
    </StoryLiveSessionTransport>
  )
}

function projectScene(role: CampaignDetailDto['role']): CampaignSceneStateDto {
  return role === 'OWNER'
    ? tabletopLiveScene
    : projectSceneForViewer(tabletopLiveScene, {
        role: 'PLAYER',
        userId: tabletopCurrentUserId
      })
}

function recipientHeader(scene: ReturnType<typeof projectScene>) {
  const {
    annotations: _annotations,
    barriers: _barriers,
    darknessZones: _darknessZones,
    doorStates: _doorStates,
    fogLayers: _fogLayers,
    lights: _lights,
    measurements: _measurements,
    tokens: _tokens,
    ...header
  } = scene
  return sceneRecipientHeaderSchema.parse({ ...header, recipientRevision })
}

function StoryConvexFixture({
  children,
  client
}: {
  children: ReactNode
  client: ConvexReactClient
}) {
  mocked(useConvex).mockReturnValue(client)
  useEffect(() => () => void client.close(), [client])
  return children
}

function StoryLiveSessionTransport({
  children,
  encounterResult,
  state
}: {
  children: ReactNode
  encounterResult: EncounterCommandResultDto
  state: LiveSessionRecipientStateDto
}) {
  const [installed, setInstalled] = useState(false)

  useEffect(() => {
    const originalWebSocket = globalThis.WebSocket
    const readyMessage = {
      campaignId: tabletopCampaignId,
      type: 'TRANSIENT_READY'
    } satisfies LiveSessionWebSocketServerMessageDto
    const stateSyncMessage = {
      authorityEpoch: crypto.randomUUID(),
      sequence: 1,
      state,
      type: 'STATE_SYNC'
    } satisfies LiveSessionWebSocketServerMessageDto
    let fogInput: SceneFogPatchInput | null = null

    class StoryWebSocket extends EventTarget {
      readyState = 0

      constructor() {
        super()
        queueMicrotask(() => {
          if (this.readyState !== 0) return
          this.readyState = 1
          this.dispatchEvent(new Event('open'))
        })
      }

      close(code = 1000, reason = ''): void {
        if (this.readyState === 3) return
        this.readyState = 3
        this.dispatchEvent(new CloseEvent('close', { code, reason }))
      }

      send(data: string): void {
        const message = liveSessionWebSocketClientMessageDtoSchema.parse(JSON.parse(data))
        // The room stages a GM fog patch and reports each step's progress (D79).
        if (message.type === 'SCENE_FOG_BEGIN' || message.type === 'SCENE_FOG_APPEND') {
          if (message.type === 'SCENE_FOG_BEGIN') {
            fogBegin(message.input)
            fogInput = message.input
          } else {
            fogAppend(message.input)
            if (message.input.saveId !== storyFogSaveId)
              throw new Error('Unexpected story fog append.')
          }
          if (!fogInput) throw new Error('Story fog append arrived before its begin.')
          const progress = {
            progress: {
              commandId: fogInput.commandId,
              receivedChunks:
                message.type === 'SCENE_FOG_APPEND'
                  ? message.input.offset + message.input.chunks.length
                  : 0,
              saveId: storyFogSaveId,
              sceneId: fogInput.sceneId,
              status: 'RECEIVING',
              totalChunks: fogInput.chunkManifest.length
            },
            type: 'SCENE_FOG_PROGRESS'
          } satisfies LiveSessionWebSocketServerMessageDto
          this.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(progress) }))
        }
        if (message.type === 'COMMAND') {
          liveCommand(message)
          // The room acknowledges an Encounter command to its initiator, which settles the command.
          if (message.command.scope === 'ENCOUNTER') {
            const committed = {
              commandId: message.command.command.commandId,
              delta: { scope: 'ENCOUNTER', result: encounterResult },
              sequence: message.expectedSessionSequence,
              type: 'COMMAND_COMMITTED'
            } satisfies LiveSessionWebSocketServerMessageDto
            this.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(committed) }))
          }
          // The GM binds an Encounter to the presented Scene through the room (D47).
          if (message.command.scope === 'ENCOUNTER_BINDING' && state.scene) {
            const { command } = message.command
            const committed = {
              commandId: command.commandId,
              delta: {
                scope: 'ENCOUNTER_BINDING',
                result: {
                  commandId: command.commandId,
                  encounterId: command.encounterId,
                  replayed: false,
                  sceneId: state.scene.id
                }
              },
              sequence: message.expectedSessionSequence + 1,
              type: 'COMMAND_COMMITTED'
            } satisfies LiveSessionWebSocketServerMessageDto
            this.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(committed) }))
          }
        }
        if (
          message.type === 'AUTHENTICATE' &&
          message.accessToken === 'story-convex-access-token'
        ) {
          this.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(readyMessage) }))
          this.dispatchEvent(
            new MessageEvent('message', { data: JSON.stringify(stateSyncMessage) })
          )
        }
        if (message.type === 'RESUME') {
          this.dispatchEvent(
            new MessageEvent('message', { data: JSON.stringify(stateSyncMessage) })
          )
        }
      }
    }

    Reflect.set(globalThis, 'WebSocket', StoryWebSocket)
    setInstalled(true)
    return () => {
      Reflect.set(globalThis, 'WebSocket', originalWebSocket)
    }
  }, [encounterResult, state])

  return installed ? children : null
}
