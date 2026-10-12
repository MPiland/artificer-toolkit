import {
  ActionIcon,
  Alert,
  Button,
  Menu,
  SegmentedControl,
  Select,
  Text,
  Tooltip
} from '@mantine/core'
import { convexQuery } from '@convex-dev/react-query'
import { useMutation, useQueries, useQuery } from '@tanstack/react-query'
import { useConvex } from 'convex/react'
import { api as convexApi } from '@artificer-toolkit/apis/convex/api'
import {
  Crosshair,
  Eye,
  EyeOff,
  Gamepad2,
  SlidersHorizontal,
  Undo2,
  ZoomIn,
  ZoomOut
} from 'lucide-react'
import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import type {
  CampaignSceneStateDto,
  SceneCommandInputDto
} from '@artificer-toolkit/schema/api/vttScenes'
import type { ImageLookupInput } from '@artificer-toolkit/schema/api/media'
import {
  createSceneFogAreaPatch,
  createUniformSceneFogLayer,
  projectSceneForViewer,
  sceneFogOwnerFailure,
  type ScenePoint,
  type SpatialPointAreaShape
} from '@artificer-toolkit/shared/vtt'
import { getCampaignLiveScenes } from '#app/data/campaigns/scenes'
import { loadCampaignSceneEncounterBindings } from '#app/data/campaigns/liveScenes'
import {
  getCampaignEncounterActionChoices,
  getEncounterDecisionSettlement,
  loadCampaignEncounterOptionalActionChoices
} from '#app/data/campaigns/encounterActions'
import { useCampaignPresentedScene } from '#app/data/campaigns/useCampaignPresentedScene'
import { useVttMapDelivery } from '#app/data/media'
import type { CampaignDetailDto } from '@artificer-toolkit/schema/api/campaignCore'
import { errorMessage } from '#app/lib/errorMessage'
import type { GetEncounterOptionalActionChoicesInputDto } from '@artificer-toolkit/schema/api/encounterActionChoices'
import {
  encounterPreparedPendingListDtoSchema,
  encounterSessionStateDtoSchema
} from '@artificer-toolkit/schema/api/encounterData'
import type { PendingEncounterRuleOccurrenceSummaryDto } from '@artificer-toolkit/schema/shared/encounterRuleOccurrence'
import type { BindEncounterToPresentedSceneInputDto } from '@artificer-toolkit/schema/api/vttScenes'
import { sceneEncounterBindingSchema } from '@artificer-toolkit/schema/api/sceneRecipient'
import { CampaignChatDrawer } from '../components/CampaignChatDrawer'
import {
  canMoveSceneToken,
  createSceneAnnotation,
  createSceneBarrier,
  createSceneDarknessZone,
  createSceneLight,
  createSceneToken,
  describeVttPing,
  editTools,
  isFogTool,
  nudgeSceneToken,
  playTools,
  readActiveTurn,
  type CampaignVttToolDefinition,
  type SceneTokenNudgeDirection
} from './CampaignVttStage.model'
import { CampaignTabletopEncounterDrawer } from './CampaignTabletopEncounterDrawer'
import { CampaignTabletopActionDrawer } from './CampaignTabletopActionDrawer'
import { CampaignTabletopDecisionDrawer } from './CampaignTabletopDecisionDrawer'
import { CampaignTabletopMovementReadout } from './CampaignTabletopMovementReadout'
import { selectMovementAllowance } from './CampaignTabletopMovementReadout.model'
import { CampaignEncounterDecision } from '../components/CampaignEncounterDecision'
import { CampaignLiveSceneObjectEditor } from './CampaignLiveSceneObjectEditor'
import * as styles from './CampaignVttStage.css'
import { useCampaignLiveSession } from './useCampaignLiveSession'
import { useLatestEvidenceRoll } from './useLatestEvidenceRoll'
import { readFromRoomOrFallback, useRoomEncounterRead } from './useRoomEncounterRead'
import {
  createVttSceneRenderer,
  type CampaignVttMode,
  type CampaignVttTool,
  type VttMapLoadStatus,
  type VttSceneRenderer,
  type VttSceneRendererUpdate
} from './vttSceneRenderer'
import { formatSceneMeasurement, pointAreaOverlay } from './vttSceneRenderer.model'
import { buildVttTokenPresentations } from './vttTokenPresentation.model'
import { isEncounterActorMine } from './encounterActorControl'

export function CampaignVttStage({
  campaign,
  currentUserId
}: {
  campaign: CampaignDetailDto
  currentUserId: string
}) {
  const convex = useConvex()
  const [actionsOpened, setActionsOpened] = useState(false)
  // An area action's center, picked on the map, and the area's size on this Scene.
  const [areaOrigin, setAreaOrigin] = useState<ScenePoint | null>(null)
  const [areaShape, setAreaShape] = useState<SpatialPointAreaShape | null>(null)
  const [aimingArea, setAimingArea] = useState(false)
  const renderer = useRef<VttSceneRenderer | null>(null)
  const rendererHost = useRef<HTMLDivElement | null>(null)
  const rendererUpdateRef = useRef<VttSceneRendererUpdate | null>(null)
  const sceneRef = useRef<CampaignSceneStateDto | undefined>(undefined)
  const commitTokenMoveRef = useRef(commitTokenMove)
  const transientSequence = useRef(0)
  const optimisticDoorCommands = useRef(new Map<string, string>())
  const [mode, setMode] = useState<CampaignVttMode>('PLAY')
  const [mapLoadStatus, setMapLoadStatus] = useState<VttMapLoadStatus | null>(null)
  const [tool, setTool] = useState<CampaignVttTool>('SELECT')
  const [fogOwnerUserId, setFogOwnerUserId] = useState<string | null>(null)
  const [gmPreviewUserId, setGmPreviewUserId] = useState<string | null>(null)
  // GM pings, rulers, drag ghosts and fog drafts stay private unless the GM shares them.
  const [sharePreviews, setSharePreviews] = useState(false)
  // The speed type the member chose for an actor's movement; it applies to that actor only.
  const [movementSpeedChoice, setMovementSpeedChoice] = useState<{
    actorId: string
    speedId: string
  } | null>(null)
  const fogOwnerUserIdRef = useRef<string | null>(null)
  fogOwnerUserIdRef.current = fogOwnerUserId
  // Each ping replaces the announcement's content, so a repeated ping is announced again.
  const [pingAnnouncement, setPingAnnouncement] = useState({ id: 0, text: '' })
  const announcePing = (userId: string) =>
    setPingAnnouncement((previous) => ({
      id: previous.id + 1,
      text: describeVttPing(campaign.memberships, userId, currentUserId)
    }))
  const announcePingRef = useRef(announcePing)
  announcePingRef.current = announcePing

  // A Character ends its Concentration with its Sheet command, which needs its stream version, so the
  // Sheet is subscribed only while that one command waits for it.
  const [endingConcentrationOf, setEndingConcentrationOf] = useState<string | null>(null)
  const live = useCampaignLiveSession({
    campaignId: campaign.id,
    characterSheetId: endingConcentrationOf,
    enabled: true,
    encounterSession: { timeline: false },
    onTransient: (message) => {
      renderer.current?.applyTransient(message)
      if (message.envelope.kind === 'PING') announcePing(message.userId)
    }
  })
  // The room's session while it holds the Run; Convex's stored session otherwise.
  const room = live.encounterSession
  const roomVersion = room?.version ?? null
  const storedSessionState = useQuery({
    ...convexQuery(
      convexApi.encounters.activeReads.active,
      room ? 'skip' : { campaignId: campaign.id }
    ),
    select: encounterSessionStateDtoSchema.parse
  })
  const encounterSessionState = room ? room.state : storedSessionState.data
  const {
    encounter: activeEncounter,
    currentActor,
    currentActorMine,
    turnMovement: currentTurnMovement
  } = readActiveTurn(campaign, currentUserId, encounterSessionState)
  const pendingOccurrence = encounterSessionState?.pending
  useEffect(() => {
    if (
      !currentActorMine ||
      !activeEncounter?.id ||
      !currentActor?.id ||
      activeEncounter?.automationMode === 'MANUAL'
    )
      setActionsOpened(false)
  }, [activeEncounter?.automationMode, activeEncounter?.id, currentActor?.id, currentActorMine])
  const actionChoiceScope =
    actionsOpened &&
    currentActorMine &&
    activeEncounter &&
    currentActor &&
    activeEncounter.automationMode !== 'MANUAL'
      ? {
          encounterId: activeEncounter.id,
          expectedVersion: activeEncounter.version,
          actorId: currentActor.id
        }
      : null
  const roomActionChoices = useRoomEncounterRead({
    read: actionChoiceScope
      ? {
          kind: 'ACTION_CHOICES',
          input: { encounterId: actionChoiceScope.encounterId, actorId: actionChoiceScope.actorId }
        }
      : null,
    readEncounter: live.readEncounter,
    room,
    select: (result) => (result.kind === 'ACTION_CHOICES' ? result.result : undefined)
  })
  const actionChoices = useQuery(
    getCampaignEncounterActionChoices(roomActionChoices.routed ? null : actionChoiceScope)
  )
  const latestEvidenceRoll = useLatestEvidenceRoll({
    encounterId: pendingOccurrence && activeEncounter ? activeEncounter.id : null,
    readEncounter: live.readEncounter,
    room
  })
  // A player's last shown decision stays in its drawer to say whether the GM skipped it (D39).
  const [shownDecision, setShownDecision] =
    useState<PendingEncounterRuleOccurrenceSummaryDto | null>(null)
  useEffect(() => {
    if (pendingOccurrence && campaign.role !== 'OWNER') setShownDecision(pendingOccurrence)
  }, [campaign.role, pendingOccurrence])
  const settledDecision = pendingOccurrence ? null : shownDecision
  const storedDecisionSettlement = useQuery(
    getEncounterDecisionSettlement(
      settledDecision && activeEncounter && !room
        ? {
            encounterId: activeEncounter.id,
            occurrenceId: settledDecision.occurrenceId,
            occurrenceVersion: settledDecision.occurrenceVersion
          }
        : null
    )
  )
  const decisionOutcome = room ? (room.settlement?.outcome ?? null) : storedDecisionSettlement.data
  useEffect(() => {
    if (decisionOutcome === 'ANSWER') setShownDecision(null)
  }, [decisionOutcome])
  const drawerDecision = pendingOccurrence ?? settledDecision
  const loadedActionChoices = roomActionChoices.routed
    ? roomActionChoices.value
    : actionChoices.data
  const currentActionChoices =
    actionChoiceScope &&
    loadedActionChoices?.encounterId === actionChoiceScope.encounterId &&
    loadedActionChoices.encounterVersion === actionChoiceScope.expectedVersion &&
    loadedActionChoices.actorId === actionChoiceScope.actorId
      ? loadedActionChoices
      : null
  const actionChoicesLoading = roomActionChoices.routed
    ? !currentActionChoices && !roomActionChoices.error
    : actionChoices.isPending || (actionChoices.isFetching && !currentActionChoices)
  const actionChoicesError = roomActionChoices.routed
    ? (roomActionChoices.error?.message ?? null)
    : actionChoices.isError
      ? actionChoices.error instanceof Error
        ? actionChoices.error.message
        : 'Available actions could not be loaded.'
      : null
  const loadOptionalActionChoices = useCallback(
    ({ expectedVersion, ...roomInput }: GetEncounterOptionalActionChoicesInputDto) =>
      readFromRoomOrFallback({
        fallback: () =>
          loadCampaignEncounterOptionalActionChoices(convex, { expectedVersion, ...roomInput }),
        read: { kind: 'OPTIONAL_ACTION_CHOICES', input: roomInput },
        readEncounter: live.readEncounter,
        roomVersion,
        select: (result) => (result.kind === 'OPTIONAL_ACTION_CHOICES' ? result.result : undefined)
      }),
    [convex, live.readEncounter, roomVersion]
  )
  const storedPendingPrepared = useQuery({
    ...convexQuery(
      convexApi.encounters.projectionReads.pendingPrepared,
      room ? 'skip' : { campaignId: campaign.id }
    ),
    select: encounterPreparedPendingListDtoSchema.parse
  })
  const preparedPendingEncounters = room ? room.preparedPending : (storedPendingPrepared.data ?? [])
  const liveScenes = useQuery({
    ...getCampaignLiveScenes(campaign.id, convex),
    enabled: campaign.role === 'OWNER',
    staleTime: 30_000
  })
  const presented = useCampaignPresentedScene(campaign.id, live.recipientState)
  const scene = live.recipientState?.scene ?? undefined
  const sceneBindingInput =
    activeEncounter && scene ? { encounterId: activeEncounter.id, sceneId: scene.id } : null
  const roomSceneBinding = useRoomEncounterRead({
    read: sceneBindingInput ? { kind: 'SCENE_BINDING', input: sceneBindingInput } : null,
    readEncounter: live.readEncounter,
    room,
    select: (result) => (result.kind === 'SCENE_BINDING' ? result.result : undefined)
  })
  const sceneBinding = useQuery({
    ...convexQuery(
      convexApi.encounters.sceneBindings.get,
      sceneBindingInput && !roomSceneBinding.routed ? sceneBindingInput : 'skip'
    ),
    select: (binding) => (binding === null ? null : sceneEncounterBindingSchema.parse(binding))
  })
  const sceneBindingPending = roomSceneBinding.routed
    ? roomSceneBinding.value === undefined && !roomSceneBinding.error
    : sceneBinding.isPending
  const sceneBindingFailure = roomSceneBinding.routed ? roomSceneBinding.error : sceneBinding.error
  const loadedSceneBinding = roomSceneBinding.routed
    ? roomSceneBinding.value
    : !sceneBinding.error
      ? sceneBinding.data
      : null
  const currentSceneBinding =
    loadedSceneBinding &&
    activeEncounter &&
    loadedSceneBinding.encounterId === activeEncounter.id &&
    loadedSceneBinding.sceneId === scene?.id
      ? loadedSceneBinding
      : null
  const activeEncounterSceneBinding =
    currentSceneBinding &&
    activeEncounter &&
    // The binding stores Convex's Run version, which trails the room's while the room holds the Run.
    (room || currentSceneBinding.encounterVersion === activeEncounter.version)
      ? currentSceneBinding
      : null
  const roomActorTokenBindings = useRoomEncounterRead({
    read: sceneBindingInput ? { kind: 'ACTOR_TOKEN_BINDINGS', input: sceneBindingInput } : null,
    readEncounter: live.readEncounter,
    // The room answers for the tokens this viewer can see, so a token shown or hidden re-asks it.
    refreshKey: scene?.tokens.map(({ id }) => id).join(','),
    room,
    select: (result) => (result.kind === 'ACTOR_TOKEN_BINDINGS' ? result.result : undefined)
  })
  const convexActorTokenBindings = useQuery({
    retry: (failureCount, error) =>
      failureCount < 2 && error.message.includes('Connection lost while action was in flight'),
    enabled: Boolean(!roomActorTokenBindings.routed && activeEncounterSceneBinding),
    gcTime: 0,
    queryFn: ({ signal }) => {
      if (!activeEncounterSceneBinding) throw new Error('Encounter Scene binding is unavailable.')
      return loadCampaignSceneEncounterBindings(convex, activeEncounterSceneBinding, signal)
    },
    queryKey: [
      'campaigns',
      campaign.id,
      'scenes',
      scene?.id ?? null,
      'encounters',
      activeEncounter?.id ?? null,
      activeEncounterSceneBinding?.encounterVersion ?? null
    ]
  })
  const actorTokenBindings = roomActorTokenBindings.routed
    ? {
        data: roomActorTokenBindings.value,
        error: roomActorTokenBindings.error,
        isPending: roomActorTokenBindings.value === undefined && !roomActorTokenBindings.error
      }
    : convexActorTokenBindings
  sceneRef.current = scene
  const effectiveMode = campaign.role === 'OWNER' && !gmPreviewUserId ? mode : 'PLAY'
  const fogEnabled = scene?.fogMode !== 'OFF'
  const tools = (effectiveMode === 'EDIT' ? editTools : playTools).filter(
    (definition) => fogEnabled || !isFogTool(definition.value)
  )

  const actorIdByTokenId = useMemo(
    () =>
      new Map(
        (activeEncounterSceneBinding && !actorTokenBindings.error && actorTokenBindings.data
          ? actorTokenBindings.data
          : []
        ).map((binding) => [binding.tokenId, binding.actorId])
      ),
    [activeEncounterSceneBinding, actorTokenBindings.data, actorTokenBindings.error]
  )
  const viewerUserId = gmPreviewUserId ?? currentUserId
  // Bound tokens move for their actor's controllers (a GM preview checks as the previewed player).
  const boundTokenControl = useMemo(() => {
    const viewer = gmPreviewUserId
      ? {
          role: 'PLAYER' as const,
          assignedCharacter:
            campaign.memberships.find((membership) => membership.userId === gmPreviewUserId)
              ?.assignedCharacter ?? null
        }
      : campaign
    return new Map(
      [...actorIdByTokenId].map(([tokenId, actorId]) => {
        const actor = activeEncounter?.actors.find((candidate) => candidate.id === actorId)
        return [tokenId, actor ? isEncounterActorMine(viewer, viewerUserId, actor) : false]
      })
    )
  }, [activeEncounter?.actors, actorIdByTokenId, campaign, gmPreviewUserId, viewerUserId])
  const scenePresentationControl =
    campaign.role === 'OWNER' ? (
      <Select
        aria-label='Presented campaign scene'
        clearable
        data={(liveScenes.data ?? []).map((candidate) => ({
          label: candidate.name,
          value: candidate.id
        }))}
        disabled={!presented.canPresent || liveScenes.isPending}
        placeholder='Present a scene'
        size='xs'
        value={scene?.id ?? null}
        onChange={(sceneId) => presented.present(sceneId)}
      />
    ) : null

  const mapDelivery = useVttMapDelivery(scene?.map.assetId ?? null, (delivery) =>
    renderer.current?.retryMap(delivery)
  )
  const mapFailure =
    mapDelivery.error instanceof Error
      ? mapDelivery.error.message
      : mapLoadStatus === 'ERROR'
        ? 'Map artwork could not be loaded.'
        : null
  const renderedScene = useMemo(
    () =>
      scene && campaign.role === 'OWNER' && gmPreviewUserId
        ? projectSceneForViewer(scene, {
            role: 'PLAYER',
            userId: gmPreviewUserId
          })
        : scene,
    [scene, campaign.role, gmPreviewUserId]
  )
  const tokenImageLookups = useMemo(() => {
    const actorsById = new Map(
      (activeEncounter?.actors ?? []).map((actor) => [actor.id, actor] as const)
    )
    return (renderedScene?.tokens ?? []).flatMap((token) => {
      const actorId = actorIdByTokenId.get(token.id)
      const actor = actorId === undefined ? undefined : actorsById.get(actorId)
      if (!actor?.sourceId || (actor.kind !== 'CHARACTER' && actor.kind !== 'CREATURE')) return []
      const target: ImageLookupInput['target'] =
        actor.kind === 'CHARACTER'
          ? { campaignId: campaign.id, characterId: actor.sourceId, type: 'CHARACTER_PORTRAIT' }
          : {
              scope: 'ACTIVE',
              subjectId: actor.sourceId,
              subjectKind: 'CREATURE',
              type: 'AUTHORED_IMAGE'
            }
      return [{ target, tokenAssetId: token.assetId, tokenId: token.id }]
    })
  }, [activeEncounter?.actors, actorIdByTokenId, campaign.id, renderedScene?.tokens])
  const tokenArtUrls = useQueries({
    queries: tokenImageLookups.map((lookup) => ({
      queryFn: () =>
        lookup.target.type === 'CHARACTER_PORTRAIT'
          ? convex.action(convexApi.media.characterPortraitActions.getImage, {
              target: lookup.target,
              variantKind: 'THUMBNAIL'
            })
          : convex.action(convexApi.media.authoredActions.getImage, {
              target: lookup.target,
              variantKind: 'THUMBNAIL'
            }),
      queryKey: ['media', lookup.target, 'THUMBNAIL'] as const,
      refetchOnReconnect: 'always' as const,
      refetchOnWindowFocus: false,
      staleTime: 4 * 60_000
    })),
    combine: (results) =>
      Object.fromEntries(
        tokenImageLookups.flatMap((lookup, index) => {
          const image = results[index]?.data
          return image && (!lookup.tokenAssetId || lookup.tokenAssetId === image.assetId)
            ? [[lookup.tokenId, image.url]]
            : []
        })
      )
  })
  const tokenPresentations = useMemo(
    () =>
      renderedScene && activeEncounter
        ? buildVttTokenPresentations({
            actorIdByTokenId,
            artUrls: tokenArtUrls,
            boundTokenControl,
            currentUserId: viewerUserId,
            encounter: activeEncounter,
            pending: pendingOccurrence ?? null,
            scene: renderedScene
          })
        : undefined,
    [
      activeEncounter,
      actorIdByTokenId,
      boundTokenControl,
      pendingOccurrence,
      renderedScene,
      tokenArtUrls,
      viewerUserId
    ]
  )
  const areaAim = useMemo(
    () => (aimingArea && areaShape ? { shape: areaShape } : null),
    [aimingArea, areaShape]
  )
  const areaOverlays = useMemo(
    () =>
      areaShape && areaOrigin && !areaAim ? [pointAreaOverlay(areaShape, areaOrigin)] : undefined,
    [areaAim, areaOrigin, areaShape]
  )
  rendererUpdateRef.current = renderedScene
    ? {
        areaAim,
        boundTokenControl,
        currentUserId: viewerUserId,
        mapDelivery: mapDelivery.data ?? null,
        mode: effectiveMode,
        overlays: areaOverlays,
        role: gmPreviewUserId ? 'PLAYER' : campaign.role,
        scene: renderedScene,
        tokenPresentations,
        tool
      }
    : null

  // The room is the only writer of the presented Scene (D79); its broadcast updates every viewer.
  const sceneCommand = useMutation({
    mutationFn: (command: SceneCommandInputDto) =>
      command.type === 'PATCH_SCENE_FOG'
        ? live.sendSceneFog(command)
        : live.sendCommand({ command, scope: 'SCENE' })
  })
  const encounterCommand = useMutation({ mutationFn: live.sendEncounterCommand })
  const sheetCommand = useMutation({ mutationFn: live.sendCharacterSheetCommand })
  const { mutate: sendSheetCommand } = sheetCommand
  const pushedSheet = live.characterSheet
  useEffect(() => {
    if (
      !endingConcentrationOf ||
      !activeEncounter ||
      pushedSheet?.characterId !== endingConcentrationOf
    )
      return
    setEndingConcentrationOf(null)
    sendSheetCommand({
      characterId: endingConcentrationOf,
      encounterId: activeEncounter.id,
      command: {
        type: 'END_CONCENTRATION',
        commandId: crypto.randomUUID(),
        expectedVersion: pushedSheet.streamVersion
      }
    })
  }, [activeEncounter, endingConcentrationOf, pushedSheet, sendSheetCommand])
  // The room owns the presented Scene, so the GM binds through it (D47).
  const bindEncounter = useMutation({
    mutationFn: async (command: BindEncounterToPresentedSceneInputDto) => {
      const commit = await live.sendCommand({ command, scope: 'ENCOUNTER_BINDING' })
      if (commit.delta?.scope !== 'ENCOUNTER_BINDING')
        throw new Error('Live play acknowledged the Encounter binding without a result.')
      return commit.delta.result
    }
  })
  const dispatchSceneCommand = useCallback(
    (command: SceneCommandInputDto) => {
      sceneCommand.mutate(command)
      return true
    },
    [sceneCommand.mutate]
  )
  const dispatchRef = useRef(dispatchSceneCommand)
  dispatchRef.current = dispatchSceneCommand

  const sendTransient = useCallback(
    (
      envelope:
        | {
            kind: 'MEASUREMENT_PREVIEW'
            path: ScenePoint[]
          }
        | {
            kind: 'TOKEN_DRAG_PREVIEW'
            position: ScenePoint
            previewUserId?: string
            tokenId: string
          }
        | {
            kind: 'PING'
            position: ScenePoint
          }
        | {
            explored: boolean
            kind: 'FOG_AREA_PREVIEW'
            ownerUserId: string | null
            rectangle: { a: ScenePoint; b: ScenePoint }
          }
    ): boolean => {
      const current = sceneRef.current
      if (!current) return false
      transientSequence.current += 1
      const metadata = {
        audience:
          campaign.role === 'OWNER' && !sharePreviews ? ('GM' as const) : ('TABLE' as const),
        baselineVersion: current.version,
        sceneId: current.id,
        sequence: transientSequence.current
      }
      return live.sendTransient(
        envelope.kind === 'TOKEN_DRAG_PREVIEW'
          ? {
              ...envelope,
              ...metadata,
              previewUserId: gmPreviewUserId ?? undefined
            }
          : { ...envelope, ...metadata }
      )
    },
    [campaign.role, gmPreviewUserId, live, sharePreviews]
  )
  const transientRef = useRef(sendTransient)
  transientRef.current = sendTransient

  useEffect(() => {
    const host = rendererHost.current
    if (!host || !scene) return
    let disposed = false
    void createVttSceneRenderer(host, {
      onAreaAimCancel: () => {
        setAimingArea(false)
        setActionsOpened(true)
      },
      onAreaPoint: (point) => {
        setAreaOrigin(point)
        setAimingArea(false)
        setActionsOpened(true)
      },
      onMapLoadStatus: (status) => {
        setMapLoadStatus(status)
        mapDelivery.onMapLoadStatus(status)
      },
      onCreateAnnotation: (position) => {
        const current = sceneRef.current
        if (!current || campaign.role !== 'OWNER') return
        dispatchRef.current({
          annotation: createSceneAnnotation(current.annotations.length, position),
          commandId: crypto.randomUUID(),
          expectedSceneVersion: current.version,
          sceneId: current.id,
          type: 'UPSERT_SCENE_ANNOTATION'
        })
      },
      onCreateBarrier: (kind, a, b) => {
        const current = sceneRef.current
        if (!current || campaign.role !== 'OWNER' || (a.x === b.x && a.y === b.y)) return
        dispatchRef.current({
          barrier: createSceneBarrier(kind, a, b),
          commandId: crypto.randomUUID(),
          expectedSceneVersion: current.version,
          sceneId: current.id,
          type: 'UPSERT_SCENE_BARRIER'
        })
      },
      onCreateDarkness: (a, b) => {
        const current = sceneRef.current
        const zone = createSceneDarknessZone(a, b)
        if (!current || campaign.role !== 'OWNER' || !zone) return
        dispatchRef.current({
          commandId: crypto.randomUUID(),
          expectedSceneVersion: current.version,
          sceneId: current.id,
          type: 'UPSERT_SCENE_DARKNESS',
          zone
        })
      },
      onCreateLight: (position) => {
        const current = sceneRef.current
        if (!current || campaign.role !== 'OWNER') return
        dispatchRef.current({
          commandId: crypto.randomUUID(),
          expectedSceneVersion: current.version,
          light: createSceneLight(position),
          sceneId: current.id,
          type: 'UPSERT_SCENE_LIGHT'
        })
      },
      onCreateToken: (position) => {
        const current = sceneRef.current
        if (!current || campaign.role !== 'OWNER') return
        dispatchRef.current({
          commandId: crypto.randomUUID(),
          expectedSceneVersion: current.version,
          sceneId: current.id,
          token: createSceneToken(current.grid, current.tokens.length, position),
          type: 'UPSERT_SCENE_TOKEN'
        })
      },
      onDoorState: (barrierId, state) => setDoorState(barrierId, state),
      onFogArea: (explored, a, b) => patchFogArea(explored, a, b),
      onFogAreaPreview: (explored, a, b) => {
        const current = sceneRef.current
        if (!current || campaign.role !== 'OWNER') return
        const ownerUserId = current.fogMode === 'SHARED_PARTY' ? null : fogOwnerUserIdRef.current
        if (sceneFogOwnerFailure(current.fogMode, ownerUserId)) return
        transientRef.current({
          explored,
          kind: 'FOG_AREA_PREVIEW',
          ownerUserId,
          rectangle: { a, b }
        })
      },
      onMeasurementCommit: (path) => commitMeasurement(path),
      onMeasurementPreview: (path) => transientRef.current({ kind: 'MEASUREMENT_PREVIEW', path }),
      onPing: (position) => {
        const sent = transientRef.current({ kind: 'PING', position })
        if (sent) announcePingRef.current(currentUserId)
        return sent
      },
      onTokenCommit: (tokenId, position) => commitTokenMoveRef.current(tokenId, position),
      onTokenPreview: (tokenId, position) =>
        transientRef.current({ kind: 'TOKEN_DRAG_PREVIEW', position, tokenId })
    }).then((nextRenderer) => {
      if (disposed) {
        nextRenderer.destroy()
        return
      }
      renderer.current = nextRenderer
      const latestUpdate = rendererUpdateRef.current
      if (latestUpdate?.scene.id === scene.id) nextRenderer.update(latestUpdate)
    })
    return () => {
      disposed = true
      renderer.current?.destroy()
      renderer.current = null
    }
  }, [campaign.role, currentUserId, scene?.id])

  useEffect(() => {
    const latestUpdate = rendererUpdateRef.current
    if (latestUpdate) renderer.current?.update(latestUpdate)
  }, [
    areaAim,
    areaOverlays,
    boundTokenControl,
    campaign.role,
    currentUserId,
    effectiveMode,
    gmPreviewUserId,
    live.error,
    mapDelivery.data,
    scene,
    tokenPresentations,
    tool
  ])

  useEffect(() => {
    setMapLoadStatus(null)
  }, [scene?.id])

  function retryMap(): void {
    setMapLoadStatus('LOADING')
    mapDelivery.refresh()
  }

  function commitMeasurement(path: ScenePoint[]): void {
    const current = sceneRef.current
    if (!current || path.length < 2) return
    dispatchRef.current({
      commandId: crypto.randomUUID(),
      expectedSceneVersion: current.version,
      measurement: {
        createdByUserId: currentUserId,
        id: crypto.randomUUID(),
        label: null,
        path
      },
      sceneId: current.id,
      type: 'UPSERT_SCENE_MEASUREMENT'
    })
  }

  /** The speed type the token's actor moves at: the readout's selection, which a move names. */
  function movingSpeedId(tokenId: string): string | null {
    const actorId = actorIdByTokenId.get(tokenId)
    const movement = encounterSessionState?.turnMovement.find((entry) => entry.actorId === actorId)
    return movement
      ? (selectMovementAllowance(
          movement,
          movementSpeedChoice && movementSpeedChoice.actorId === actorId
            ? movementSpeedChoice.speedId
            : null
        )?.speedId ?? null)
      : null
  }

  function commitTokenMove(tokenId: string, path: ScenePoint[]): void {
    const current = sceneRef.current
    if (!current || path.length < 2) return
    if (
      activeEncounter &&
      (sceneBindingPending ||
        sceneBindingFailure ||
        bindEncounter.isPending ||
        (currentSceneBinding && !activeEncounterSceneBinding) ||
        (currentSceneBinding && (actorTokenBindings.isPending || actorTokenBindings.error)))
    )
      return
    const mechanicsEncounter =
      activeEncounterSceneBinding && actorIdByTokenId.has(tokenId) ? activeEncounter : null
    const command: SceneCommandInputDto = {
      commandId: crypto.randomUUID(),
      correlationId: null,
      expectedEncounterVersion: mechanicsEncounter?.version ?? null,
      expectedSceneVersion: current.version,
      movementKind: 'VOLUNTARY',
      path,
      sceneId: current.id,
      speedId: mechanicsEncounter ? movingSpeedId(tokenId) : null,
      tokenId,
      type: 'MOVE_SCENE_TOKEN'
    }
    void live.sendCommand({ command, scope: 'SCENE' }).catch(() => undefined)
  }

  commitTokenMoveRef.current = commitTokenMove

  function removeMeasurement(measurementId: string): void {
    const current = sceneRef.current
    if (!current) return
    dispatchRef.current({
      commandId: crypto.randomUUID(),
      expectedSceneVersion: current.version,
      measurementId,
      sceneId: current.id,
      type: 'REMOVE_SCENE_MEASUREMENT'
    })
  }

  function setFogLayer(ownerUserId: string | null, explored: boolean): void {
    const current = sceneRef.current
    if (!current) return
    dispatchRef.current({
      commandId: crypto.randomUUID(),
      expectedSceneVersion: current.version,
      layer: createUniformSceneFogLayer(current, { explored, ownerUserId }),
      sceneId: current.id,
      type: 'PATCH_SCENE_FOG'
    })
  }

  function patchFogArea(explored: boolean, a: ScenePoint, b: ScenePoint): void {
    const current = sceneRef.current
    if (!current || campaign.role !== 'OWNER') return
    const ownerUserId = current.fogMode === 'SHARED_PARTY' ? null : fogOwnerUserIdRef.current
    if (sceneFogOwnerFailure(current.fogMode, ownerUserId)) return
    const layer = createSceneFogAreaPatch(current, {
      explored,
      ownerUserId,
      rectangle: { a, b }
    })
    if (!layer) return
    dispatchRef.current({
      commandId: crypto.randomUUID(),
      expectedSceneVersion: current.version,
      layer,
      sceneId: current.id,
      type: 'PATCH_SCENE_FOG'
    })
  }

  function setDoorState(barrierId: string, state: 'CLOSED' | 'LOCKED' | 'OPEN'): void {
    const current = sceneRef.current
    if (!current) return
    const commandId = crypto.randomUUID()
    optimisticDoorCommands.current.set(barrierId, commandId)
    renderer.current?.previewDoorState(barrierId, state)
    const command = {
      barrierId,
      commandId,
      expectedSceneVersion: current.version,
      sceneId: current.id,
      state,
      type: 'SET_SCENE_DOOR_STATE' as const
    }
    void live
      .sendCommand({ command, scope: 'SCENE' })
      .then(() => {
        if (optimisticDoorCommands.current.get(barrierId) === commandId)
          optimisticDoorCommands.current.delete(barrierId)
      })
      .catch(() => {
        if (optimisticDoorCommands.current.get(barrierId) !== commandId) return
        optimisticDoorCommands.current.delete(barrierId)
        renderer.current?.previewDoorState(barrierId, null)
      })
  }

  function undoLastTokenMove(): void {
    const current = sceneRef.current
    if (!current || campaign.role !== 'OWNER') return
    const command: SceneCommandInputDto = {
      commandId: crypto.randomUUID(),
      expectedSceneVersion: current.version,
      sceneId: current.id,
      type: 'UNDO_LAST_SCENE_MOVE'
    }
    void live.sendCommand({ command, scope: 'SCENE' }).catch(() => undefined)
  }

  if (presented.error) {
    return <VttEmpty title='Scene could not be loaded' body={presented.error.message} />
  }
  if (
    (!room && storedSessionState.isPending) ||
    presented.isLoading ||
    (Boolean(presented.sceneId) && !scene)
  ) {
    return <VttEmpty title='Loading live map…' />
  }
  if (!scene) {
    return (
      <section className={styles.shell} aria-label='Campaign tabletop'>
        {scenePresentationControl ? (
          <div className={styles.header}>
            <div className={styles.identity}>
              <Gamepad2 aria-hidden size={20} />
              <span className={styles.title}>Campaign tabletop</span>
            </div>
            <div className={styles.headerActions}>{scenePresentationControl}</div>
          </div>
        ) : null}
        <VttEmpty
          title='No scene is being presented'
          body={
            campaign.role === 'OWNER'
              ? 'Choose a Campaign scene to show at the table.'
              : 'The GM has not presented a scene yet.'
          }
        />
        {presented.presentationError ? (
          <Alert className={styles.error} color='red'>
            {presented.presentationError.message}
          </Alert>
        ) : null}
      </section>
    )
  }

  const requestFailure =
    bindEncounter.error ??
    encounterCommand.error ??
    sceneCommand.error ??
    actorTokenBindings.error ??
    sceneBindingFailure ??
    presented.presentationError
  const stageError = requestFailure
    ? errorMessage(requestFailure)
    : (live.rejection?.message ?? live.error)

  return (
    <section className={styles.shell} aria-label={`Live scene: ${scene.name}`}>
      <div className={styles.header}>
        <div className={styles.identity}>
          <span
            className={styles.status}
            data-connected={live.status === 'CONNECTED' || undefined}
          />
          <Gamepad2 aria-hidden size={20} />
          <span className={styles.title}>{scene.name}</span>
          <Text c='dimmed' component='span' size='xs'>
            v{scene.version}
          </Text>
        </div>
        <div className={styles.headerActions}>
          {scenePresentationControl}
          {campaign.role === 'OWNER' ? (
            <>
              <Select
                aria-label='GM vision preview'
                data={[
                  { label: 'Full GM view', value: 'GM' },
                  ...campaign.memberships
                    .filter((membership) => membership.role === 'PLAYER')
                    .map((membership) => ({
                      label: `Preview ${membership.username}`,
                      value: membership.userId
                    }))
                ]}
                size='xs'
                value={gmPreviewUserId ?? 'GM'}
                onChange={(value) => {
                  setGmPreviewUserId(value && value !== 'GM' ? value : null)
                  setMode('PLAY')
                  setTool('SELECT')
                }}
              />
              <Select
                aria-label='Fog of war'
                data={[
                  { label: 'Fog off', value: 'OFF' },
                  { label: 'Shared party fog', value: 'SHARED_PARTY' },
                  { label: 'Per-player fog', value: 'PER_PLAYER' }
                ]}
                disabled={live.status !== 'CONNECTED'}
                size='xs'
                value={scene.fogMode}
                onChange={(value) => {
                  if (value !== 'OFF' && value !== 'SHARED_PARTY' && value !== 'PER_PLAYER') return
                  const current = sceneRef.current
                  if (!current) return
                  if (value === 'OFF' && isFogTool(tool)) setTool('SELECT')
                  dispatchRef.current({
                    commandId: crypto.randomUUID(),
                    expectedSceneVersion: current.version,
                    mode: value,
                    sceneId: current.id,
                    type: 'SET_SCENE_FOG_MODE'
                  })
                }}
              />
              {fogEnabled ? (
                <Select
                  aria-label='Vision reveal timing'
                  data={[
                    { label: 'Reveal while dragging', value: 'ON_DRAG' },
                    { label: 'Reveal on drop', value: 'ON_DROP' }
                  ]}
                  disabled={live.status !== 'CONNECTED'}
                  size='xs'
                  value={scene.visionRevealMode}
                  onChange={(value) => {
                    if (value !== 'ON_DRAG' && value !== 'ON_DROP') return
                    const current = sceneRef.current
                    if (!current) return
                    dispatchRef.current({
                      commandId: crypto.randomUUID(),
                      expectedSceneVersion: current.version,
                      mode: value,
                      sceneId: current.id,
                      type: 'SET_SCENE_VISION_REVEAL_MODE'
                    })
                  }}
                />
              ) : null}
              <Tooltip
                label={
                  sharePreviews
                    ? 'Players see your previews and pings'
                    : 'Previews and pings are private'
                }
              >
                <ActionIcon
                  aria-label='Show my previews to players'
                  aria-pressed={sharePreviews}
                  variant={sharePreviews ? 'filled' : 'default'}
                  onClick={() => setSharePreviews((current) => !current)}
                >
                  {sharePreviews ? <Eye aria-hidden size={18} /> : <EyeOff aria-hidden size={18} />}
                </ActionIcon>
              </Tooltip>
              <Tooltip label='Undo last token move'>
                <ActionIcon
                  aria-label='Undo last token move'
                  disabled={live.status !== 'CONNECTED'}
                  variant='default'
                  onClick={undoLastTokenMove}
                >
                  <Undo2 aria-hidden size={18} />
                </ActionIcon>
              </Tooltip>
              <SegmentedControl
                aria-label='Tabletop mode'
                data={[
                  { label: 'Play', value: 'PLAY' },
                  { label: 'Edit', value: 'EDIT' }
                ]}
                disabled={Boolean(gmPreviewUserId)}
                size='xs'
                value={effectiveMode}
                onChange={(value) => {
                  setMode(value === 'EDIT' ? 'EDIT' : 'PLAY')
                  setTool('SELECT')
                }}
              />
            </>
          ) : null}
          {campaign.role === 'OWNER' && activeEncounter && !activeEncounterSceneBinding ? (
            <Button
              disabled={
                !live.commandReady ||
                bindEncounter.isPending ||
                sceneBindingPending ||
                Boolean(sceneBindingFailure) ||
                Boolean(currentSceneBinding && !activeEncounterSceneBinding)
              }
              size='xs'
              variant='light'
              onClick={() =>
                bindEncounter.mutate({
                  commandId: crypto.randomUUID(),
                  encounterId: activeEncounter.id,
                  type: 'BIND_ENCOUNTER_TO_PRESENTED_SCENE'
                })
              }
            >
              Use this scene for combat
            </Button>
          ) : null}
          {activeEncounter ? (
            <CampaignTabletopEncounterDrawer
              actorIdByTokenId={actorIdByTokenId}
              connected={live.status === 'CONNECTED'}
              currentActorMine={currentActorMine}
              encounter={activeEncounter}
              memberships={campaign.memberships}
              pending={
                encounterCommand.isPending ||
                sheetCommand.isPending ||
                sceneBindingPending ||
                Boolean(activeEncounterSceneBinding && actorTokenBindings.isPending)
              }
              role={campaign.role}
              scene={activeEncounterSceneBinding?.sceneId === scene.id ? scene : null}
              onCommand={(command) => encounterCommand.mutate(command)}
              onEndCharacterConcentration={setEndingConcentrationOf}
            />
          ) : null}
          {activeEncounter && currentTurnMovement ? (
            <CampaignTabletopMovementReadout
              automationMode={activeEncounter.automationMode}
              chosenSpeedId={
                movementSpeedChoice?.actorId === currentTurnMovement.actorId
                  ? movementSpeedChoice.speedId
                  : null
              }
              movement={currentTurnMovement}
              onChooseSpeed={(speedId) =>
                setMovementSpeedChoice({ actorId: currentTurnMovement.actorId, speedId })
              }
            />
          ) : null}
          {currentActorMine &&
          activeEncounter &&
          currentActor &&
          activeEncounter.automationMode !== 'MANUAL' ? (
            <CampaignTabletopActionDrawer
              actions={currentActionChoices?.actions ?? []}
              basicActions={currentActionChoices?.basicActions ?? []}
              basicActionChoices={currentActionChoices?.basicActionChoices ?? []}
              escapes={currentActionChoices?.escapes ?? []}
              openAttackAction={currentActionChoices?.openAttackAction ?? null}
              actionsLoading={actionChoicesLoading}
              actionChoicesError={actionChoicesError}
              connected={live.status === 'CONNECTED'}
              encounter={activeEncounter}
              isGm={campaign.role === 'OWNER'}
              opened={actionsOpened && !aimingArea}
              onOpen={() => setActionsOpened(true)}
              onClose={() => setActionsOpened(false)}
              unavailableActions={currentActionChoices?.unavailableActions ?? []}
              optionalRules={currentActionChoices?.optionalRules ?? []}
              pending={encounterCommand.isPending || pendingOccurrence !== null}
              scene={activeEncounterSceneBinding?.sceneId === scene.id ? scene : null}
              areaOrigin={areaOrigin}
              waitingOn={encounterSessionState?.waitingOn ?? null}
              actorIdByTokenId={actorIdByTokenId}
              onAreaOriginChange={setAreaOrigin}
              onAreaShapeChange={setAreaShape}
              onPickAreaOrigin={() => setAimingArea(true)}
              onResolve={(command) => encounterCommand.mutateAsync(command)}
              onUseBasicAction={(command) => encounterCommand.mutateAsync(command)}
              onEscape={(command) => encounterCommand.mutateAsync(command)}
              onLoadOptionalChoices={loadOptionalActionChoices}
            />
          ) : null}
          {drawerDecision && activeEncounter ? (
            <CampaignTabletopDecisionDrawer
              canVoid={campaign.role === 'OWNER'}
              connected
              encounter={activeEncounter}
              latestRoll={latestEvidenceRoll}
              pending={drawerDecision}
              skipped={
                !pendingOccurrence && decisionOutcome === 'GM_SKIP'
                  ? { onDismiss: () => setShownDecision(null) }
                  : null
              }
              submitting={encounterCommand.isPending || !pendingOccurrence}
              onResolve={(command) => encounterCommand.mutateAsync(command)}
            />
          ) : null}
          {preparedPendingEncounters.map(({ encounter, pending }) => (
            <CampaignEncounterDecision
              canVoid={campaign.role === 'OWNER'}
              connected={campaign.status === 'ACTIVE' && live.commandReady}
              encounter={encounter}
              key={encounter.id}
              pending={pending}
              readEncounter={live.readEncounter}
              room={room}
              sendCommand={live.sendEncounterCommand}
            />
          ))}
          {campaign.capabilities.readTableChat ? (
            <CampaignChatDrawer
              campaignId={campaign.id}
              currentUserId={currentUserId}
              trigger='icon'
            />
          ) : null}
          {campaign.role === 'OWNER' && effectiveMode === 'EDIT' ? (
            <CampaignLiveSceneObjectEditor
              connected={live.status === 'CONNECTED'}
              memberships={campaign.memberships}
              renderer={renderer}
              scene={scene}
              onCommand={dispatchSceneCommand}
            />
          ) : null}
          <SceneObjectMenu
            boundTokenControl={boundTokenControl}
            currentUserId={currentUserId}
            memberships={campaign.memberships}
            role={campaign.role}
            scene={scene}
            renderer={renderer}
            onDoorState={setDoorState}
            onFogLayer={setFogLayer}
            onMeasurement={commitMeasurement}
            onMeasurementRemove={removeMeasurement}
            onTokenMove={(tokenId, position) => {
              const token = scene.tokens.find((candidate) => candidate.id === tokenId)
              if (token) commitTokenMove(tokenId, [token.position, position])
            }}
          />
          <Tooltip label='Zoom out'>
            <ActionIcon
              aria-label='Zoom out'
              variant='default'
              onClick={() => renderer.current?.zoomOut()}
            >
              <ZoomOut aria-hidden size={18} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label='Fit map to view'>
            <ActionIcon
              aria-label='Fit map to view'
              variant='default'
              onClick={() => renderer.current?.fit()}
            >
              <Crosshair aria-hidden size={18} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label='Zoom in'>
            <ActionIcon
              aria-label='Zoom in'
              variant='default'
              onClick={() => renderer.current?.zoomIn()}
            >
              <ZoomIn aria-hidden size={18} />
            </ActionIcon>
          </Tooltip>
        </div>
      </div>
      {stageError ? (
        <Alert className={styles.error} color='red'>
          {stageError}
        </Alert>
      ) : null}
      {mapLoadStatus ? (
        <span aria-live='polite' className={styles.visuallyHidden} role='status'>
          {mapLoadStatus === 'READY'
            ? 'Scene map ready.'
            : mapLoadStatus === 'ERROR'
              ? 'Scene map failed to load.'
              : 'Scene map loading.'}
        </span>
      ) : null}
      <span aria-atomic='true' aria-live='polite' className={styles.visuallyHidden}>
        <span key={pingAnnouncement.id}>{pingAnnouncement.text}</span>
      </span>
      {mapFailure ? (
        <Alert className={styles.error} color='red'>
          {mapFailure}
          <Button loading={mapDelivery.isFetching} size='xs' variant='light' onClick={retryMap}>
            Retry map
          </Button>
        </Alert>
      ) : null}
      <div className={styles.stageLayout}>
        <div
          className={styles.toolbar}
          aria-label={`${effectiveMode === 'EDIT' ? 'Edit' : 'Play'} tools`}
          role='toolbar'
        >
          {tools.map((definition) => (
            <VttToolButton
              definition={definition}
              key={definition.value}
              selected={tool === definition.value}
              onSelect={setTool}
            />
          ))}
          {effectiveMode === 'EDIT' &&
          (tool === 'FOG_REVEAL' || tool === 'FOG_HIDE') &&
          scene.fogMode === 'PER_PLAYER' ? (
            <Select
              aria-label='Fog player'
              data={campaign.memberships
                .filter((membership) => membership.role === 'PLAYER')
                .map((membership) => ({
                  label: membership.username,
                  value: membership.userId
                }))}
              placeholder='Choose player'
              size='xs'
              value={fogOwnerUserId}
              onChange={setFogOwnerUserId}
            />
          ) : null}
        </div>
        <div className={styles.canvasFrame} ref={rendererHost}>
          <div className={styles.overlay} aria-hidden>
            <span className={styles.overlayPill}>{activeEncounter?.name ?? 'Campaign scene'}</span>
            <span className={styles.overlayPill}>
              {scene.grid.kind === 'SQUARE' ? 'Square grid' : 'Gridless'}
            </span>
          </div>
          {effectiveMode === 'EDIT' && tool === 'WALL' ? (
            <Text className={styles.canvasInstruction} role='status' size='xs'>
              Click to add wall segments. Enter or right-click finishes; Escape cancels.
            </Text>
          ) : null}
          {effectiveMode === 'EDIT' && (tool === 'FOG_REVEAL' || tool === 'FOG_HIDE') ? (
            <Text className={styles.canvasInstruction} role='status' size='xs'>
              {scene.fogMode === 'PER_PLAYER' && !fogOwnerUserId
                ? 'Choose a player before editing their fog.'
                : 'Drag an area on the map to edit fog.'}
            </Text>
          ) : null}
        </div>
      </div>
    </section>
  )
}

function VttEmpty({ body, title }: { body?: string; title: string }) {
  return (
    <section className={styles.empty} aria-label='Live scene'>
      <div>
        <Text fw={650}>{title}</Text>
        {body ? (
          <Text c='dimmed' size='sm'>
            {body}
          </Text>
        ) : null}
      </div>
    </section>
  )
}

function VttToolButton({
  definition,
  onSelect,
  selected
}: {
  definition: CampaignVttToolDefinition
  onSelect: (tool: CampaignVttTool) => void
  selected: boolean
}) {
  const Icon = definition.icon
  return (
    <Tooltip label={definition.label} position='right'>
      <ActionIcon
        aria-label={definition.label}
        aria-pressed={selected}
        color={selected ? 'brand' : undefined}
        size='lg'
        variant={selected ? 'filled' : 'subtle'}
        onClick={() => onSelect(definition.value)}
      >
        <Icon aria-hidden size={19} />
      </ActionIcon>
    </Tooltip>
  )
}

function SceneObjectMenu({
  boundTokenControl,
  currentUserId,
  memberships,
  onDoorState,
  onFogLayer,
  onMeasurement,
  onMeasurementRemove,
  onTokenMove,
  renderer,
  role,
  scene
}: {
  boundTokenControl: ReadonlyMap<string, boolean>
  currentUserId: string
  memberships: CampaignDetailDto['memberships']
  onDoorState: (barrierId: string, state: 'CLOSED' | 'LOCKED' | 'OPEN') => void
  onFogLayer: (ownerUserId: string | null, explored: boolean) => void
  onMeasurement: (path: ScenePoint[]) => void
  onMeasurementRemove: (measurementId: string) => void
  onTokenMove: (tokenId: string, position: ScenePoint) => void
  renderer: RefObject<VttSceneRenderer | null>
  role: 'OWNER' | 'PLAYER'
  scene: CampaignSceneStateDto
}) {
  const [measurementOriginId, setMeasurementOriginId] = useState<string | null>(null)
  const [measurementAnnouncement, setMeasurementAnnouncement] = useState('')
  const doors = scene.barriers.filter((barrier) => barrier.kind === 'DOOR')
  const fogOwners = memberships.filter((membership) => membership.role === 'PLAYER')
  const measurementOrigin = scene.tokens.find((token) => token.id === measurementOriginId)

  function moveToken(
    token: (typeof scene.tokens)[number],
    direction: SceneTokenNudgeDirection
  ): void {
    onTokenMove(token.id, nudgeSceneToken(scene, token, direction))
  }

  return (
    <>
      <span aria-atomic='true' aria-live='polite' className={styles.visuallyHidden}>
        {measurementAnnouncement}
      </span>
      <Menu
        classNames={{ dropdown: styles.menuDropdown, label: styles.menuLabel }}
        position='bottom-end'
        shadow='none'
        width={260}
        withInitialFocusPlaceholder={false}
      >
        <Menu.Target>
          <Button
            leftSection={<SlidersHorizontal aria-hidden size={16} />}
            size='xs'
            variant='default'
          >
            Scene controls
          </Button>
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Label>Tokens</Menu.Label>
          {scene.tokens.length ? (
            scene.tokens.map((token) => (
              <Fragment key={token.id}>
                <Menu.Item onClick={() => renderer.current?.focusPoint(token.position)}>
                  Focus {token.label}
                </Menu.Item>
                {canMoveSceneToken(token, { boundTokenControl, currentUserId, role })
                  ? (
                      [
                        ['UP', 'up'],
                        ['DOWN', 'down'],
                        ['LEFT', 'left'],
                        ['RIGHT', 'right']
                      ] as const
                    ).map(([direction, label]) => (
                      <Menu.Item key={direction} onClick={() => moveToken(token, direction)}>
                        Move {token.label} {label}
                      </Menu.Item>
                    ))
                  : null}
                {scene.tokens.length > 1 ? (
                  <Menu.Item onClick={() => setMeasurementOriginId(token.id)}>
                    Measure from {token.label}
                  </Menu.Item>
                ) : null}
              </Fragment>
            ))
          ) : (
            <Menu.Item disabled>No visible tokens</Menu.Item>
          )}
          {measurementOrigin ? (
            <>
              <Menu.Divider />
              <Menu.Label>Measure from {measurementOrigin.label}</Menu.Label>
              {scene.tokens
                .filter((token) => token.id !== measurementOrigin.id)
                .map((token) => (
                  <Menu.Item
                    key={token.id}
                    onClick={() => {
                      const distance = formatSceneMeasurement(scene.grid, [
                        measurementOrigin.position,
                        token.position
                      ])
                      onMeasurement([measurementOrigin.position, token.position])
                      setMeasurementAnnouncement(
                        `Measured from ${measurementOrigin.label} to ${token.label}: ${distance}.`
                      )
                      setMeasurementOriginId(null)
                    }}
                  >
                    To {token.label} ·{' '}
                    {formatSceneMeasurement(scene.grid, [
                      measurementOrigin.position,
                      token.position
                    ])}
                  </Menu.Item>
                ))}
              <Menu.Item color='dimmed' onClick={() => setMeasurementOriginId(null)}>
                Cancel measurement
              </Menu.Item>
            </>
          ) : null}
          <Menu.Divider />
          <Menu.Label>Measurements</Menu.Label>
          {scene.measurements.length ? (
            scene.measurements.map((measurement, index) => {
              const label = measurement.label ?? `Measurement ${index + 1}`
              const removable = role === 'OWNER' || measurement.createdByUserId === currentUserId
              return (
                <Menu.Item
                  disabled={!removable}
                  key={measurement.id}
                  onClick={() => onMeasurementRemove(measurement.id)}
                >
                  {removable ? `Remove ${label}` : label} ·{' '}
                  {formatSceneMeasurement(scene.grid, measurement.path)}
                </Menu.Item>
              )
            })
          ) : (
            <Menu.Item disabled>No measurements</Menu.Item>
          )}
          <Menu.Divider />
          <Menu.Label>Doors</Menu.Label>
          {doors.length ? (
            doors.map((door, index) => {
              const state = scene.doorStates[door.id] ?? door.initialState
              return (
                <Fragment key={door.id}>
                  <Menu.Item
                    disabled={state === 'LOCKED' && role === 'PLAYER'}
                    onClick={() =>
                      onDoorState(
                        door.id,
                        state === 'OPEN' ? 'CLOSED' : state === 'LOCKED' ? 'CLOSED' : 'OPEN'
                      )
                    }
                  >
                    Door {index + 1}:{' '}
                    {state === 'OPEN'
                      ? 'Close'
                      : state === 'LOCKED'
                        ? role === 'OWNER'
                          ? 'Unlock'
                          : 'Locked'
                        : 'Open'}
                  </Menu.Item>
                  {role === 'OWNER' && state !== 'LOCKED' ? (
                    <Menu.Item onClick={() => onDoorState(door.id, 'LOCKED')}>
                      Door {index + 1}: Lock
                    </Menu.Item>
                  ) : null}
                </Fragment>
              )
            })
          ) : (
            <Menu.Item disabled>No doors</Menu.Item>
          )}
          {role === 'OWNER' && scene.fogMode !== 'OFF' ? (
            <>
              <Menu.Divider />
              <Menu.Label>Fog</Menu.Label>
              {scene.fogMode === 'SHARED_PARTY' ? (
                <>
                  <Menu.Item onClick={() => onFogLayer(null, true)}>Reveal entire map</Menu.Item>
                  <Menu.Item onClick={() => onFogLayer(null, false)}>
                    Reset all exploration
                  </Menu.Item>
                </>
              ) : fogOwners.length ? (
                fogOwners.map((membership) => (
                  <Menu.Sub key={membership.userId} position='left-start'>
                    <Menu.Sub.Target>
                      <Menu.Sub.Item>Fog for @{membership.username}</Menu.Sub.Item>
                    </Menu.Sub.Target>
                    <Menu.Sub.Dropdown>
                      <Menu.Item onClick={() => onFogLayer(membership.userId, true)}>
                        Reveal entire map
                      </Menu.Item>
                      <Menu.Item onClick={() => onFogLayer(membership.userId, false)}>
                        Reset exploration
                      </Menu.Item>
                    </Menu.Sub.Dropdown>
                  </Menu.Sub>
                ))
              ) : (
                <Menu.Item disabled>No active players</Menu.Item>
              )}
            </>
          ) : null}
        </Menu.Dropdown>
      </Menu>
    </>
  )
}
