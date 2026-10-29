import { convexQuery } from '@convex-dev/react-query'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ConvexReactClient, useAction, useConvex } from 'convex/react'
import { getFunctionName } from 'convex/server'
import { useEffect, useState, type ComponentProps, type JSX, type ReactNode } from 'react'
import { fn, mocked } from 'storybook/test'
import { api as convexApi } from '@artificer-toolkit/apis/convex/api'
import type { CampaignDetailDto } from '@artificer-toolkit/schema/api/campaigns'
import type { EncounterSessionStateDto } from '@artificer-toolkit/schema/api/encounterData'
import {
  encounterCommandResultDtoSchema,
  type EncounterCommandResultDto,
  type EncounterGmProjectionDto,
  type EncounterPlayerProjectionDto
} from '@artificer-toolkit/schema/api/encounters'
import { type PendingEncounterRuleOccurrenceSummaryDto } from '@artificer-toolkit/schema/shared/encounterRuleOccurrence'
import {
  sceneFogChunksPageInputSchema,
  sceneFogChunksPageSchema,
  sceneFogLayersPageInputSchema,
  sceneFogLayersPageSchema,
  type SceneFogPatchInput
} from '@artificer-toolkit/schema/api/sceneFog'
import {
  liveSessionWebSocketClientMessageDtoSchema,
  liveSessionRecipientStateDtoSchema,
  liveSessionWebSocketServerMessageDtoSchema,
  type LiveSessionRecipientStateDto
} from '@artificer-toolkit/schema/api/liveSessions'
import {
  sceneEncounterBindingSchema,
  sceneRecipientHeaderSchema,
  sceneRecipientEncounterBindingsInputSchema,
  sceneRecipientEncounterBindingsPageSchema,
  sceneRecipientPageInputSchema,
  sceneRecipientPageSchema
} from '@artificer-toolkit/schema/api/sceneRecipient'
import {
  campaignSceneShowingDtoSchema,
  type CampaignSceneShowingDto,
  type CampaignSceneStateDto,
  setCampaignLiveScenePresentationInputDtoSchema,
  setCampaignLiveScenePresentationResultDtoSchema
} from '@artificer-toolkit/schema/api/vttScenes'
import { validated } from '../../../test/validatedFixture'
import { projectSceneForViewer } from '@artificer-toolkit/shared/vtt'
import { getCampaignDetail } from '#app/data/campaigns/queries'
import {
  tabletopCampaignId,
  seedTabletopSystem,
  tabletopCurrentUserId,
  tabletopGmEncounter,
  tabletopLiveScene,
  tabletopMapDelivery,
  tabletopPlayerEncounter
} from './CampaignTabletop.stories.fixtures'
import { CampaignTabletopWindow } from './CampaignTabletopWindow'

const recipientRevision = 'a'.repeat(64)
export const mapReadyTimeoutMs = 10_000
export const liveCommand = fn()
export const mediaGetDelivery = fn()
export const fogBegin = fn()
export const fogAppend = fn()
export const storyFogSaveId = '77777777-7777-4777-8777-777777777799'
export const showScene = fn()
export const shownScene = validated(campaignSceneShowingDtoSchema)({
  sceneId: '77777777-7777-4777-8777-777777777798',
  sceneName: 'The Ashen Stair',
  shownAt: '2099-08-15T20:00:00.000Z'
})
export type TabletopFixtures = {
  /** The auras the server lists for the rendered viewer (it omits a source the viewer cannot see). */
  auras?: EncounterSessionStateDto['auras']
  /** The placed zones the server lists for the rendered viewer (it omits one concealed from them). */
  placedZones?: EncounterSessionStateDto['placedZones']
  gmEncounter: EncounterGmProjectionDto
  liveScene: CampaignSceneStateDto
  playerEncounter: EncounterPlayerProjectionDto
  pending?: PendingEncounterRuleOccurrenceSummaryDto
}

const defaultTabletopFixtures: TabletopFixtures = {
  gmEncounter: tabletopGmEncounter,
  liveScene: tabletopLiveScene,
  playerEncounter: tabletopPlayerEncounter
}

// Replaces the room's presented Scene with a later state, as a Scene edit does mid-session.
let pushStoryScene: ((scene: CampaignSceneStateDto) => void) | null = null

export function syncStoryScene(scene: CampaignSceneStateDto): void {
  if (!pushStoryScene) throw new Error('The story live session transport is not installed.')
  pushStoryScene(scene)
}

export function renderWindow(
  args: ComponentProps<typeof CampaignTabletopWindow>,
  campaign: CampaignDetailDto,
  showing: CampaignSceneShowingDto | null = null,
  fixtures: TabletopFixtures = defaultTabletopFixtures,
  sceneCommandRejection: string | null = null
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
  queryClient.setQueryDefaults(
    ['convexQuery', getFunctionName(convexApi.characters.sheetSlices.get)],
    {
      queryFn: async () => null
    }
  )
  queryClient.setQueryData(getCampaignDetail(tabletopCampaignId).queryKey, campaign)
  const encounter = campaign.role === 'OWNER' ? fixtures.gmEncounter : fixtures.playerEncounter
  const scene = projectScene(campaign.role, fixtures.liveScene)
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
  const sceneBinding = validated(sceneEncounterBindingSchema)({
    encounterId: encounter.id,
    encounterVersion: encounter.version,
    sceneId: scene.id
  })
  const presentationVersion = 0
  mediaGetDelivery.mockReset().mockResolvedValue(tabletopMapDelivery)
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
  queryClient.setQueryDefaults(sceneBindingQuery.queryKey.slice(0, 2), {
    queryFn: async () => sceneBinding
  })
  const activeState = {
    encounter,
    pending: fixtures.pending ?? null,
    waitingOn: null,
    turnMovement: [],
    halfSpeedFields: [],
    auras: fixtures.auras ?? [],
    movementCostZones: [],
    placedZones: fixtures.placedZones ?? [],
    pendingZoneSightings: []
  }
  queryClient.setQueryDefaults(activeEncounterQuery.queryKey, {
    queryFn: async () => activeState
  })
  queryClient.setQueryDefaults(pendingPreparedQuery.queryKey, { queryFn: async () => [] })
  const rollPreferencesQuery = convexQuery(convexApi.account.rollPreferences, {})
  const rollPreferences = { autoRollDice: true, gmRollVisibility: 'PUBLIC' as const }
  queryClient.setQueryDefaults(rollPreferencesQuery.queryKey, {
    queryFn: async () => rollPreferences
  })
  queryClient.setQueryDefaults(skippedActionChoicesQuery.queryKey, {
    queryFn: async () => null
  })
  const showingQuery = convexQuery(convexApi.scenes.showings.current, {
    campaignId: tabletopCampaignId
  })
  const presentationQuery = convexQuery(convexApi.scenes.presentations.get, {
    campaignId: tabletopCampaignId
  })
  const shownHeaderQuery = convexQuery(convexApi.scenes.recipientReads.header, {
    sceneId: shownScene.sceneId,
    includeSnapshot: false
  })
  queryClient.setQueryDefaults(showingQuery.queryKey, { queryFn: async () => showing })
  queryClient.setQueryDefaults(presentationQuery.queryKey, {
    queryFn: async () => ({
      campaignId: tabletopCampaignId,
      sceneId: scene.id,
      version: presentationVersion
    })
  })
  queryClient.setQueryDefaults(shownHeaderQuery.queryKey, {
    queryFn: async () => ({ ...header, id: shownScene.sceneId, name: shownScene.sceneName })
  })
  queryClient.setQueryData(sceneBindingQuery.queryKey, sceneBinding)
  seedTabletopSystem(queryClient, campaign)
  queryClient.setQueryData(activeEncounterQuery.queryKey, activeState)
  queryClient.setQueryData(pendingPreparedQuery.queryKey, [])
  queryClient.setQueryData(rollPreferencesQuery.queryKey, rollPreferences)
  const convex = new ConvexReactClient('https://story-fixture.convex.cloud', {
    logger: false
  })
  Object.defineProperty(convex, 'query', {
    value: fn<ConvexReactClient['query']>().mockImplementation(async (...[reference, args]) => {
      const name = getFunctionName(reference)
      if (name === getFunctionName(convexApi.encounters.activeReads.active)) return activeState
      if (name === getFunctionName(convexApi.encounters.projectionReads.pendingPrepared)) return []
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
            },
            {
              definitionId: shownScene.sceneId,
              id: shownScene.sceneId,
              name: shownScene.sceneName,
              version: 0
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
        return validated(sceneFogLayersPageSchema)({
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
        return validated(sceneFogChunksPageSchema)({
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
        return validated(setCampaignLiveScenePresentationResultDtoSchema)({
          commandId: input.commandId,
          replayed: false,
          campaignId: input.campaignId,
          sceneId: input.sceneId,
          version: presentationVersion + 1
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
        return validated(sceneRecipientEncounterBindingsPageSchema)({
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
    value: fn<ConvexReactClient['mutation']>().mockImplementation(async (...[reference, args]) => {
      const name = getFunctionName(reference)
      if (name === getFunctionName(convexApi.scenes.showings.show)) {
        showScene(args)
        return null
      }
      throw new Error(`Unexpected story fixture mutation: ${name}`)
    })
  })
  showScene.mockReset()
  fogBegin.mockReset()
  fogAppend.mockReset()

  const recipientState = validated(liveSessionRecipientStateDtoSchema)({
    presentationVersion,
    recipientRole: campaign.role,
    scene
  })
  liveCommand.mockReset()
  return (
    <StoryLiveSessionTransport
      encounterResult={encounterResult}
      sceneCommandRejection={sceneCommandRejection}
      state={recipientState}
    >
      <StoryConvexFixture client={convex}>
        <QueryClientProvider client={queryClient}>
          <CampaignTabletopWindow campaignId={args.campaignId} currentUserId={args.currentUserId} />
        </QueryClientProvider>
      </StoryConvexFixture>
    </StoryLiveSessionTransport>
  )
}

export function projectScene(
  role: CampaignDetailDto['role'],
  liveScene: CampaignSceneStateDto = tabletopLiveScene
): CampaignSceneStateDto {
  return role === 'OWNER'
    ? liveScene
    : projectSceneForViewer(
        liveScene,
        {
          role: 'PLAYER',
          userId: tabletopCurrentUserId
        },
        new Map()
      )
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
  return validated(sceneRecipientHeaderSchema)({ ...header, recipientRevision })
}

function StoryConvexFixture({
  children,
  client
}: {
  children: ReactNode
  client: ConvexReactClient
}) {
  mocked(useConvex).mockReturnValue(client)
  mocked(useAction).mockImplementation(
    (reference) =>
      (...args) =>
        client.action(reference, ...args)
  )
  useEffect(() => () => void client.close(), [client])
  return children
}

function StoryLiveSessionTransport({
  children,
  encounterResult,
  sceneCommandRejection,
  state
}: {
  children: ReactNode
  encounterResult: EncounterCommandResultDto
  /** When set, the room rejects every Scene command as stale with this message. */
  sceneCommandRejection: string | null
  state: LiveSessionRecipientStateDto
}) {
  const [installed, setInstalled] = useState(false)

  useEffect(() => {
    const originalWebSocket = globalThis.WebSocket
    const readyMessage = validated(liveSessionWebSocketServerMessageDtoSchema)({
      campaignId: tabletopCampaignId,
      type: 'TRANSIENT_READY'
    })
    const stateSyncMessage = validated(liveSessionWebSocketServerMessageDtoSchema)({
      authorityEpoch: crypto.randomUUID(),
      sequence: 1,
      state,
      type: 'STATE_SYNC'
    })
    let fogInput: SceneFogPatchInput | null = null
    class StoryWebSocket extends EventTarget {
      readyState = 0

      constructor() {
        super()
        pushStoryScene = (scene) =>
          this.dispatchEvent(
            new MessageEvent('message', {
              data: JSON.stringify(
                validated(liveSessionWebSocketServerMessageDtoSchema)({
                  ...stateSyncMessage,
                  sequence: stateSyncMessage.sequence + 1,
                  state: { ...state, scene }
                })
              )
            })
          )
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
          const progress = validated(liveSessionWebSocketServerMessageDtoSchema)({
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
          })
          this.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(progress) }))
        }
        if (message.type === 'COMMAND') {
          liveCommand(message)
          if (message.command.scope === 'SCENE' && sceneCommandRejection) {
            const rejected = validated(liveSessionWebSocketServerMessageDtoSchema)({
              code: 'STALE_STATE',
              commandId: message.command.command.commandId,
              currentSequence: message.expectedSessionSequence,
              message: sceneCommandRejection,
              reason: null,
              type: 'COMMAND_REJECTED',
              warnings: null
            })
            this.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(rejected) }))
          }
          // The room acknowledges an Encounter command to its initiator, which settles the command.
          if (message.command.scope === 'ENCOUNTER') {
            const committed = validated(liveSessionWebSocketServerMessageDtoSchema)({
              commandId: message.command.command.commandId,
              delta: { scope: 'ENCOUNTER', result: encounterResult },
              sequence: message.expectedSessionSequence,
              type: 'COMMAND_COMMITTED'
            })
            this.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(committed) }))
          }
          // The GM binds an Encounter to the presented Scene through the room (D47).
          if (message.command.scope === 'ENCOUNTER_BINDING' && state.scene) {
            const { command } = message.command
            const committed = validated(liveSessionWebSocketServerMessageDtoSchema)({
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
            })
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
      pushStoryScene = null
      Reflect.set(globalThis, 'WebSocket', originalWebSocket)
    }
  }, [encounterResult, sceneCommandRejection, state])

  return installed ? children : null
}
