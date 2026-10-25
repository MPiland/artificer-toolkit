import {
  ActionIcon,
  Alert,
  Button,
  List,
  Menu,
  SegmentedControl,
  Select,
  Text,
  Tooltip
} from '@mantine/core'
import { convexQuery } from '@convex-dev/react-query'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useConvex } from 'convex/react'
import { api as convexApi } from '@artificer-toolkit/apis/convex/api'
import { Check, Crosshair, Eye, EyeOff, Gamepad2, SlidersHorizontal, Undo2 } from 'lucide-react'
import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import type {
  CampaignSceneStateDto,
  SceneCommandInputDto
} from '@artificer-toolkit/schema/api/vttScenes'
import {
  createSceneFogAreaPatch,
  createUniformSceneFogLayer,
  projectSceneForViewer,
  sceneFogOwnerFailure,
  type ScenePoint
} from '@artificer-toolkit/shared/vtt'
import { getCampaignLiveScenes } from '#app/data/campaigns/scenes'
import { loadCampaignSceneEncounterBindings } from '#app/data/campaigns/liveScenes'
import {
  getCampaignEncounterActionChoices,
  getEncounterDecisionSettlement,
  loadCampaignEncounterActionItemChoices,
  loadCampaignEncounterOptionalActionChoices
} from '#app/data/campaigns/encounterActions'
import { useCampaignPresentedScene } from '#app/data/campaigns/useCampaignPresentedScene'
import { useVttMapDelivery } from '#app/data/media'
import type { CampaignDetailDto } from '@artificer-toolkit/schema/api/campaignCore'
import { errorMessage } from '#app/lib/errorMessage'
import type {
  GetEncounterActionItemChoicesInputDto,
  GetEncounterOptionalActionChoicesInputDto
} from '@artificer-toolkit/schema/api/encounterActionChoices'
import {
  encounterPreparedPendingListDtoSchema,
  encounterSessionStateDtoSchema
} from '@artificer-toolkit/schema/api/encounterData'
import type { PendingEncounterRuleOccurrenceSummaryDto } from '@artificer-toolkit/schema/shared/encounterRuleOccurrence'
import type { EncounterRuleWarningDto } from '@artificer-toolkit/schema/shared/encounterRuleWarnings'
import type { BindEncounterToPresentedSceneInputDto } from '@artificer-toolkit/schema/api/vttScenes'
import { sceneEncounterBindingSchema } from '@artificer-toolkit/schema/api/sceneRecipient'
import { CampaignChatDrawer } from '../components/CampaignChatDrawer'
import { withCharacterControllers } from '@artificer-toolkit/shared/campaign/characterControl'
import {
  assignedCharacterTokenId,
  canMoveSceneToken,
  characterControlAssignments,
  controlledCharacters,
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
  resolveMainCharacterId,
  type CampaignVttToolDefinition,
  type SceneTokenNudgeDirection
} from './CampaignVttStage.model'
import { CampaignLiveLootPanel } from '../loot/CampaignLiveLootPanel'
import { useCampaignLiveLoot } from '../loot/useCampaignLiveLoot'
import { useVttTokenArtUrls } from './useVttTokenArtUrls'
import { CampaignTabletopEncounterDrawer } from './CampaignTabletopEncounterDrawer'
import { CampaignTabletopActionDrawer } from './CampaignTabletopActionDrawer'
import { CampaignTabletopActionConfirmation } from './CampaignTabletopActionConfirmation'
import { LiveSessionCommandRejectedError } from './liveSessionClient'
import { CampaignTabletopDecisionDrawer } from './CampaignTabletopDecisionDrawer'
import { CampaignTabletopMovementReadout } from './CampaignTabletopMovementReadout'
import { selectMovementAllowance } from './CampaignTabletopMovementReadout.model'
import { CampaignEncounterDecision } from '../components/CampaignEncounterDecision'
import { CampaignLiveSceneObjectEditor } from './CampaignLiveSceneObjectEditor'
import { CampaignVttSceneEnvironmentControls } from './CampaignVttSceneEnvironmentControls'
import { VttZoomControl } from './VttZoomControl'
import { readStoredVttZoom, vttZoomStorageKey, writeStoredVttZoom } from './vttZoom.model'
import * as styles from './CampaignVttStage.css'
import { useActionTargetModifiers } from './useActionTargetModifiers'
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
import {
  formatSceneMeasurement,
  resolveViewTokenId,
  stageOverlays,
  type VttActionPreview,
  type VttAreaAim,
  type VttAreaSize
} from './vttSceneRenderer.model'
import { useVttTokenPresentations } from './useVttTokenPresentations'
import {
  buildTargetEntries,
  describeTargetEntry,
  type VttTargetingRequest
} from './vttTargeting.model'
import { CampaignVttTokenStatusList } from './CampaignVttTokenStatusList'
import { halfSpeedFieldsEntered, type HalfSpeedField } from './CampaignVttCarefulMove.model'
import { CampaignVttCarefulMoveChoice } from './CampaignVttCarefulMoveChoice'
import { CampaignVttForcedMovementPick } from './CampaignVttForcedMovementPick'
import {
  forcedMovementDestinationOverlays,
  forcedMovementDestinationPick
} from './vttForcedMovementPick.model'
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
  // Where the caster aimed an area action on the map, and the area's size on this Scene.
  const [areaAim, setAreaAim] = useState<VttAreaAim | null>(null)
  const [areaSize, setAreaSize] = useState<VttAreaSize | null>(null)
  const [aimingArea, setAimingArea] = useState(false)
  const [actionPreview, setActionPreview] = useState<VttActionPreview | null>(null)
  // The action the caster is picking a target for on the map or in the turn-order list (ATTACK-17.1).
  const [targetingRequest, setTargetingRequest] = useState<VttTargetingRequest | null>(null)
  // `undefined` is untouched (the open Attack action's last target applies); `null` is cleared.
  const [pickedTargetActorId, setPickedTargetActorId] = useState<string | null | undefined>(
    undefined
  )
  // The legal square the keyboard focuses while a forced movement waits on its source (D157).
  const [focusedDestination, setFocusedDestination] = useState<ScenePoint | null>(null)
  const pickDestinationRef = useRef<((position: ScenePoint) => void) | null>(null)
  const renderer = useRef<VttSceneRenderer | null>(null)
  const rendererHost = useRef<HTMLDivElement | null>(null)
  const rendererUpdateRef = useRef<VttSceneRendererUpdate | null>(null)
  const sceneRef = useRef<CampaignSceneStateDto | undefined>(undefined)
  const commitTokenMoveRef = useRef(commitTokenMove)
  const pickTargetTokenRef = useRef(pickTargetToken)
  const transientSequence = useRef(0)
  const optimisticDoorCommands = useRef(new Map<string, string>())
  const [mode, setMode] = useState<CampaignVttMode>('PLAY')
  const [mapLoadStatus, setMapLoadStatus] = useState<VttMapLoadStatus | null>(null)
  const [zoomScale, setZoomScale] = useState(1)
  const [tool, setTool] = useState<CampaignVttTool>('SELECT')
  const [fogOwnerUserId, setFogOwnerUserId] = useState<string | null>(null)
  const [gmPreviewUserId, setGmPreviewUserId] = useState<string | null>(null)
  // The token whose view the GM previews, and the token whose statuses are listed on screen.
  const [chosenPreviewTokenId, setChosenPreviewTokenId] = useState<string | null>(null)
  const [inspectedTokenId, setInspectedTokenId] = useState<string | null>(null)
  const [selectedTokenId, setSelectedTokenId] = useState<string | null>(null)
  const [pickedMainCharacterId, setPickedMainCharacterId] = useState<string | null>(null)
  // GM pings, rulers, drag ghosts and fog drafts stay private unless the GM shares them.
  const [sharePreviews, setSharePreviews] = useState(false)
  // The speed type the member chose for an actor's movement; it applies to that actor only.
  const [movementSpeedChoice, setMovementSpeedChoice] = useState<{
    actorId: string
    speedId: string
  } | null>(null)
  // The cast whose teleport the member turned off, so their drags walk instead.
  const [declinedTeleportCastId, setDeclinedTeleportCastId] = useState<string | null>(null)
  // A dragged path waiting for its mover to cross a half-speed field carefully or normally.
  const [carefulChoice, setCarefulChoice] = useState<{
    tokenId: string
    path: ScenePoint[]
    fields: HalfSpeedField[]
  } | null>(null)
  // A move the room refused for the rule warnings it breaks, waiting on "Do it anyway" (ADR 0034).
  const [moveWarning, setMoveWarning] = useState<{
    command: Extract<SceneCommandInputDto, { type: 'MOVE_SCENE_TOKEN' }>
    warnings: EncounterRuleWarningDto[]
  } | null>(null)
  const fogOwnerUserIdRef = useRef<string | null>(null)
  // Each ping replaces the announcement's content, so a repeated ping is announced again.
  const [pingAnnouncement, setPingAnnouncement] = useState({ id: 0, text: '' })
  const announcePing = (userId: string) =>
    setPingAnnouncement((previous) => ({
      id: previous.id + 1,
      text: describeVttPing(campaign.memberships, userId, currentUserId)
    }))
  const announcePingRef = useRef(announcePing)

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
  const [trackedActingTurn, setTrackedActingTurn] = useState({
    automationMode: activeEncounter?.automationMode,
    encounterId: activeEncounter?.id,
    actorId: currentActor?.id,
    mine: currentActorMine
  })
  if (
    trackedActingTurn.automationMode !== activeEncounter?.automationMode ||
    trackedActingTurn.encounterId !== activeEncounter?.id ||
    trackedActingTurn.actorId !== currentActor?.id ||
    trackedActingTurn.mine !== currentActorMine
  ) {
    setTrackedActingTurn({
      automationMode: activeEncounter?.automationMode,
      encounterId: activeEncounter?.id,
      actorId: currentActor?.id,
      mine: currentActorMine
    })
    if (
      !currentActorMine ||
      !activeEncounter?.id ||
      !currentActor?.id ||
      activeEncounter?.automationMode === 'MANUAL'
    ) {
      setActionsOpened(false)
      setTargetingRequest(null)
    }
  }
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
  // Release is a room command, so only the room offers the holds a member may release (D152).
  const heldRelationships = useRoomEncounterRead({
    read:
      activeEncounter && activeEncounter.automationMode !== 'MANUAL'
        ? { kind: 'HELD_RELATIONSHIPS', input: { encounterId: activeEncounter.id } }
        : null,
    readEncounter: live.readEncounter,
    room,
    select: (result) => (result.kind === 'HELD_RELATIONSHIPS' ? result.result : undefined)
  })
  const latestEvidenceRoll = useLatestEvidenceRoll({
    encounterId: pendingOccurrence && activeEncounter ? activeEncounter.id : null,
    readEncounter: live.readEncounter,
    room
  })
  // A player's last shown decision stays in its drawer to say whether the GM skipped it (D39).
  const [shownDecision, setShownDecision] =
    useState<PendingEncounterRuleOccurrenceSummaryDto | null>(
      campaign.role !== 'OWNER' ? (pendingOccurrence ?? null) : null
    )
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
  const [trackedDecision, setTrackedDecision] = useState({
    outcome: decisionOutcome,
    pending: pendingOccurrence,
    role: campaign.role
  })
  if (
    trackedDecision.outcome !== decisionOutcome ||
    trackedDecision.pending !== pendingOccurrence ||
    trackedDecision.role !== campaign.role
  ) {
    setTrackedDecision({
      outcome: decisionOutcome,
      pending: pendingOccurrence,
      role: campaign.role
    })
    if (
      pendingOccurrence &&
      campaign.role !== 'OWNER' &&
      (trackedDecision.pending !== pendingOccurrence || trackedDecision.role !== campaign.role)
    )
      setShownDecision(pendingOccurrence)
    if (trackedDecision.outcome !== decisionOutcome && decisionOutcome === 'ANSWER')
      setShownDecision(null)
  }
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
  const loadActionItemChoices = useCallback(
    ({ expectedVersion, ...roomInput }: GetEncounterActionItemChoicesInputDto) =>
      readFromRoomOrFallback({
        fallback: () =>
          loadCampaignEncounterActionItemChoices(convex, { expectedVersion, ...roomInput }),
        read: { kind: 'ACTION_ITEM_CHOICES', input: roomInput },
        readEncounter: live.readEncounter,
        roomVersion,
        select: (result) => (result.kind === 'ACTION_ITEM_CHOICES' ? result.result : undefined)
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
  // The chosen preview applies only while that Token is on the presented Scene.
  const previewTokenId = scene?.tokens.some((token) => token.id === chosenPreviewTokenId)
    ? chosenPreviewTokenId
    : null
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
  // The Scene the Encounter's tokens and ranges are measured on; null when the presented one is not it.
  const encounterScene = scene && activeEncounterSceneBinding?.sceneId === scene.id ? scene : null
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
  // A grappler whose drag of a creature on this Scene doubles its movement (D105). Sizes are read
  // with the holds, so a size change mid-hold can lag here; settlement recomputes the cost.
  const holds = heldRelationships.routed ? heldRelationships.value : undefined
  const dragDoublingActorIds = useMemo(() => {
    const boundActorIds = new Set(actorIdByTokenId.values())
    return new Set(
      (holds ?? [])
        .filter(({ heldActorId, drag }) => drag?.doublesCost && boundActorIds.has(heldActorId))
        .map(({ sourceActorId }) => sourceActorId)
    )
  }, [actorIdByTokenId, holds])
  const targeting = actionsOpened ? targetingRequest : null
  const targetModifiers = useActionTargetModifiers({
    input:
      targeting?.actionId && activeEncounter && currentActor
        ? {
            encounterId: activeEncounter.id,
            expectedVersion: activeEncounter.version,
            actorId: currentActor.id,
            actionId: targeting.actionId,
            scene: encounterScene
              ? { sceneId: encounterScene.id, expectedSceneVersion: encounterScene.version }
              : null
          }
        : null,
    readEncounter: live.readEncounter,
    roomVersion
  })
  const targetEntries = useMemo(
    () =>
      targeting && activeEncounter
        ? buildTargetEntries({
            actorIdByTokenId,
            actors: activeEncounter.actors,
            currentActorId: currentActor?.id ?? null,
            modifiers: targetModifiers,
            range: actionPreview?.range,
            scene: encounterScene,
            selfRefused: targeting.selfRefused,
            onlyActorIds: targeting.onlyActorIds,
            sourceTokenId: actionPreview?.sourceTokenId ?? null
          })
        : null,
    [
      actionPreview?.range,
      actionPreview?.sourceTokenId,
      activeEncounter,
      actorIdByTokenId,
      currentActor?.id,
      encounterScene,
      targetModifiers,
      targeting
    ]
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
  // The token of an actor that left the Encounter is not on the field (D128); editing still shows it.
  const presentScene = useMemo(() => {
    if (!scene || effectiveMode === 'EDIT' || !activeEncounter) return scene
    const absentActorIds = new Set(
      activeEncounter.actors.filter((actor) => actor.absence !== null).map((actor) => actor.id)
    )
    if (absentActorIds.size === 0) return scene
    return {
      ...scene,
      tokens: scene.tokens.filter(
        (token) => !absentActorIds.has(actorIdByTokenId.get(token.id) ?? '')
      )
    }
  }, [scene, effectiveMode, activeEncounter, actorIdByTokenId])
  // A Character's grantees control its linked tokens as its player does (D162).
  const controlledScene = useMemo(
    () =>
      presentScene && (campaign.role !== 'OWNER' || gmPreviewUserId)
        ? withCharacterControllers(presentScene, characterControlAssignments(campaign.memberships))
        : presentScene,
    [presentScene, campaign.role, campaign.memberships, gmPreviewUserId]
  )
  const renderedScene = useMemo(
    () =>
      controlledScene && campaign.role === 'OWNER' && gmPreviewUserId
        ? projectSceneForViewer(
            controlledScene,
            {
              role: 'PLAYER',
              userId: gmPreviewUserId
            },
            boundTokenControl
          )
        : controlledScene,
    [controlledScene, campaign.role, gmPreviewUserId, boundTokenControl]
  )
  // A forced movement waiting on its source is picked on the board by whoever acts for it (D157).
  const destinationPending =
    pendingOccurrence?.kind === 'FORCED_MOVEMENT_DESTINATION' ? pendingOccurrence : null
  const destinationSource = activeEncounter?.actors.find(
    ({ id }) => id === destinationPending?.sourceActorId
  )
  const destinationTokenId = [...actorIdByTokenId].find(
    ([, actorId]) => actorId === destinationPending?.targetActorId
  )?.[0]
  const destinationPick = useMemo(
    () =>
      destinationPending &&
      renderedScene &&
      destinationTokenId &&
      destinationSource &&
      isEncounterActorMine(campaign, currentUserId, destinationSource)
        ? forcedMovementDestinationPick({
            pending: destinationPending,
            scene: renderedScene,
            targetTokenId: destinationTokenId
          })
        : null,
    [
      campaign,
      currentUserId,
      destinationPending,
      destinationSource,
      destinationTokenId,
      renderedScene
    ]
  )
  const tokenArtUrls = useVttTokenArtUrls({
    actorIdByTokenId,
    campaignId: campaign.id,
    encounter: activeEncounter,
    scene: renderedScene
  })
  const liveLoot = useCampaignLiveLoot({
    campaignId: campaign.id,
    encounter: activeEncounter,
    gmView: campaign.role === 'OWNER' && !gmPreviewUserId,
    sceneDefinitionId: scene?.definitionId
  })
  const tokenPresentations = useVttTokenPresentations({
    actorIdByTokenId,
    artUrls: tokenArtUrls,
    boundTokenControl,
    currentUserId: viewerUserId,
    encounter: activeEncounter,
    gameSystemId: campaign.gameSystemId,
    lootActorIds: liveLoot.lootActorIds,
    pending: pendingOccurrence ?? null,
    scene: renderedScene,
    targetEntries
  })
  const rendererAreaAim = useMemo(
    () =>
      aimingArea && areaSize
        ? { casterTokenId: actionPreview?.sourceTokenId ?? null, size: areaSize }
        : null,
    [actionPreview?.sourceTokenId, aimingArea, areaSize]
  )
  // The preview shows while the drawer is open, including while the caster aims an area's center.
  const overlays = useMemo(() => {
    const staged = stageOverlays({
      actionPreview,
      aimingArea: rendererAreaAim !== null,
      areaAim,
      areaSize,
      drawerOpened: actionsOpened,
      scene: renderedScene ?? null
    })
    return destinationPick
      ? [
          ...(staged ?? []),
          ...forcedMovementDestinationOverlays(destinationPick, focusedDestination)
        ]
      : staged
  }, [
    actionPreview,
    actionsOpened,
    areaAim,
    areaSize,
    destinationPick,
    focusedDestination,
    rendererAreaAim,
    renderedScene
  ])
  // A selection whose token left the Scene counts as no selection.
  const selectedSceneTokenId = scene?.tokens.some((token) => token.id === selectedTokenId)
    ? selectedTokenId
    : null
  // Hover or focus lists a token's statuses; otherwise the selected token's are listed.
  const listedTokenId = inspectedTokenId ?? selectedSceneTokenId
  const listedPresentation = listedTokenId ? tokenPresentations?.[listedTokenId] : undefined
  const listedLabel = scene?.tokens.find((token) => token.id === listedTokenId)?.label ?? ''
  const hoveredTarget = inspectedTokenId
    ? targetEntries?.find((entry) => entry.tokenId === inspectedTokenId)
    : undefined
  const effectiveRole = gmPreviewUserId ? 'PLAYER' : campaign.role
  const effectivePreviewTokenId =
    campaign.role === 'OWNER' && !gmPreviewUserId ? previewTokenId : null
  // The tabletop is seen through one main Character's senses; selecting a controlled token overrides it.
  const controlled = useMemo(
    () => controlledCharacters(campaign.memberships, viewerUserId),
    [campaign.memberships, viewerUserId]
  )
  const mainCharacterId = resolveMainCharacterId(controlled, pickedMainCharacterId)
  const viewTokenId = renderedScene
    ? resolveViewTokenId({
        assignedTokenId: assignedCharacterTokenId({
          actorIdByTokenId,
          actors: activeEncounter?.actors ?? [],
          assignedCharacterId: mainCharacterId,
          tokens: renderedScene.tokens
        }),
        boundTokenControl,
        currentUserId: viewerUserId,
        previewTokenId: effectivePreviewTokenId,
        role: effectiveRole,
        selectedTokenId: selectedSceneTokenId,
        tokens: renderedScene.tokens
      })
    : null
  const rendererUpdate: VttSceneRendererUpdate | null = renderedScene
    ? {
        areaAim: rendererAreaAim,
        boundTokenControl,
        currentUserId: viewerUserId,
        mapDelivery: mapDelivery.data ?? null,
        mode: effectiveMode,
        movementCost:
          activeEncounterSceneBinding && encounterSessionState
            ? {
                actorIdByTokenId,
                zones: encounterSessionState.movementCostZones,
                dragDoublingActorIds
              }
            : null,
        overlays,
        previewTokenId: effectivePreviewTokenId,
        role: effectiveRole,
        scene: renderedScene,
        selectedTokenId: selectedSceneTokenId,
        squarePick: destinationPick?.squares ?? null,
        targeting: targeting !== null,
        tokenPresentations,
        tool,
        viewTokenId
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
  // The sheet's subscription ends once its one command is on its way.
  const sheetCommand = useMutation({
    mutationFn: live.sendCharacterSheetCommand,
    onMutate: () => setEndingConcentrationOf(null)
  })
  const { mutate: sendSheetCommand } = sheetCommand
  const pushedSheet = live.characterSheet
  useEffect(() => {
    if (
      !endingConcentrationOf ||
      !activeEncounter ||
      pushedSheet?.characterId !== endingConcentrationOf
    )
      return
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

  // Renderer and DOM callbacks read the latest values through these refs; they are written after
  // commit, before the renderer effects below read them.
  useEffect(() => {
    fogOwnerUserIdRef.current = fogOwnerUserId
    announcePingRef.current = announcePing
    sceneRef.current = scene
    rendererUpdateRef.current = rendererUpdate
    dispatchRef.current = dispatchSceneCommand
    transientRef.current = sendTransient
    pickTargetTokenRef.current = pickTargetToken
    pickDestinationRef.current = destinationPick ? pickDestination : null
    commitTokenMoveRef.current = commitTokenMove
  })

  useEffect(() => {
    const host = rendererHost.current
    if (!host || !scene) return
    let disposed = false
    void createVttSceneRenderer(host, campaign.gameSystemId, {
      onAreaAimCancel: () => {
        setAimingArea(false)
        setActionsOpened(true)
      },
      onAreaPoint: (point) => {
        setAreaAim({ origin: point, toward: null })
        setAimingArea(false)
        setActionsOpened(true)
      },
      onAreaDirection: (aim) => {
        setAreaAim(aim)
        setAimingArea(false)
        setActionsOpened(true)
      },
      onSquarePick: (center) => pickDestinationRef.current?.(center),
      onZoomChange: (scale, origin) => {
        setZoomScale(scale)
        const sceneId = sceneRef.current?.id
        if (origin === 'USER' && sceneId) {
          writeStoredVttZoom(vttZoomStorageKey(campaign.id, sceneId), scale)
        }
      },
      resolveSceneZoom: (sceneId) => readStoredVttZoom(vttZoomStorageKey(campaign.id, sceneId)),
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
      onTargetingCancel: () => setTargetingRequest(null),
      onTokenHover: setInspectedTokenId,
      onTokenPick: (tokenId) => pickTargetTokenRef.current(tokenId),
      onTokenSelect: setSelectedTokenId,
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
  }, [campaign.gameSystemId, campaign.role, currentUserId, scene?.id])

  useEffect(() => {
    const latestUpdate = rendererUpdateRef.current
    if (latestUpdate) renderer.current?.update(latestUpdate)
  }, [
    rendererAreaAim,
    boundTokenControl,
    campaign.role,
    currentUserId,
    effectiveMode,
    gmPreviewUserId,
    live.error,
    mapDelivery.data,
    overlays,
    previewTokenId,
    scene,
    selectedSceneTokenId,
    targeting,
    tokenPresentations,
    tool,
    viewTokenId
  ])

  const [mapLoadSceneId, setMapLoadSceneId] = useState(scene?.id)
  if (mapLoadSceneId !== scene?.id) {
    setMapLoadSceneId(scene?.id)
    setMapLoadStatus(null)
  }

  // A pick on the map or in the list ends targeting and hands the creature back to the action drawer.
  function pickTarget(actorId: string): void {
    setPickedTargetActorId(actorId)
    setTargetingRequest(null)
  }

  function pickTargetToken(tokenId: string): void {
    const actorId = actorIdByTokenId.get(tokenId)
    if (actorId) pickTarget(actorId)
  }

  function pickDestination(position: ScenePoint): void {
    if (!destinationPending || !activeEncounter || encounterCommand.isPending) return
    encounterCommand.mutate({
      type: 'RESOLVE_RULE_OCCURRENCE',
      encounterId: activeEncounter.id,
      commandId: crypto.randomUUID(),
      expectedVersion: destinationPending.encounterVersion,
      occurrenceId: destinationPending.occurrenceId,
      expectedOccurrenceVersion: destinationPending.occurrenceVersion,
      correlationId: null,
      resolution: { kind: 'FORCED_MOVEMENT', requestId: destinationPending.requestId, position }
    })
  }

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

  /**
   * Whether a drag of this token teleports: it is the active turn's actor the member controls, and it
   * holds a cast's allowance the member kept on (the readout's switch shows for that actor only).
   */
  function teleportsOnDrop(tokenId: string): boolean {
    const [allowance] = currentTurnMovement?.teleport ?? []
    return (
      allowance !== undefined &&
      currentTurnMovement?.actorId === actorIdByTokenId.get(tokenId) &&
      allowance.castCommandId !== declinedTeleportCastId
    )
  }

  /**
   * Sends a move: a teleport from the origin to the drop while the mover holds a cast's allowance,
   * otherwise a voluntary walk. A walked path that enters a field allowing passage at half speed waits
   * for the mover's choice to move carefully or normally, which re-enters with `carefully` set.
   */
  function commitTokenMove(tokenId: string, path: ScenePoint[], carefully?: boolean): void {
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
    const teleporting = mechanicsEncounter !== null && teleportsOnDrop(tokenId)
    const mover = current.tokens.find((token) => token.id === tokenId)
    const fields =
      mechanicsEncounter && mover && !teleporting && carefully === undefined
        ? halfSpeedFieldsEntered({
            fields: encounterSessionState?.halfSpeedFields ?? [],
            path,
            token: mover
          })
        : []
    if (fields.length) {
      setCarefulChoice({ tokenId, path, fields })
      return
    }
    sendTokenMove({
      ...(carefully === undefined ? {} : { carefully }),
      acknowledgedWarnings: [],
      commandId: crypto.randomUUID(),
      correlationId: null,
      expectedEncounterVersion: mechanicsEncounter?.version ?? null,
      expectedSceneVersion: current.version,
      movementKind: teleporting ? 'TELEPORT' : 'VOLUNTARY',
      path: teleporting ? [path[0]!, path.at(-1)!] : path,
      sceneId: current.id,
      speedId: mechanicsEncounter && !teleporting ? movingSpeedId(tokenId) : null,
      tokenId,
      type: 'MOVE_SCENE_TOKEN'
    })
  }

  /** Sends a move; one the room refuses for rule warnings waits on the mover's "Do it anyway". */
  function sendTokenMove(command: Extract<SceneCommandInputDto, { type: 'MOVE_SCENE_TOKEN' }>) {
    void live.sendCommand({ command, scope: 'SCENE' }).catch((error: unknown) => {
      if (error instanceof LiveSessionCommandRejectedError && error.rejection.warnings)
        setMoveWarning({ command, warnings: error.rejection.warnings })
    })
  }

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
          {effectiveRole === 'PLAYER' && controlled.length > 1 ? (
            <Select
              aria-label='Main Character'
              allowDeselect={false}
              data={controlled.map((character) => ({
                label: character.label,
                value: character.id
              }))}
              size='xs'
              value={mainCharacterId}
              onChange={setPickedMainCharacterId}
            />
          ) : null}
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
              <CampaignVttSceneEnvironmentControls
                disabled={live.status !== 'CONNECTED'}
                dispatch={(command) => dispatchRef.current(command)}
                scene={scene}
                sceneRef={sceneRef}
                onFogOff={() => {
                  if (isFogTool(tool)) setTool('SELECT')
                }}
              />
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
          {liveLoot.available ? (
            <CampaignLiveLootPanel
              creatures={liveLoot.creatures}
              gameSystemId={campaign.gameSystemId}
              sceneTables={liveLoot.sceneTables}
            />
          ) : null}
          {activeEncounter ? (
            <CampaignTabletopEncounterDrawer
              actorIdByTokenId={actorIdByTokenId}
              connected={live.status === 'CONNECTED'}
              currentActorMine={currentActorMine}
              encounter={activeEncounter}
              holds={holds ?? []}
              memberships={campaign.memberships}
              pending={
                encounterCommand.isPending ||
                sheetCommand.isPending ||
                sceneBindingPending ||
                Boolean(activeEncounterSceneBinding && actorTokenBindings.isPending)
              }
              role={campaign.role}
              scene={encounterScene}
              targeting={
                targeting && targetEntries
                  ? {
                      entries: targetEntries,
                      pickedActorId:
                        pickedTargetActorId ??
                        (actionPreview?.targetTokenId
                          ? (actorIdByTokenId.get(actionPreview.targetTokenId) ?? null)
                          : null),
                      onCancel: () => setTargetingRequest(null),
                      onPick: pickTarget
                    }
                  : null
              }
              onCommand={(command) => encounterCommand.mutate(command)}
              onEndCharacterConcentration={setEndingConcentrationOf}
              onRelease={(command) => encounterCommand.mutateAsync(command)}
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
              teleportOn={
                currentTurnMovement.teleport[0]
                  ? currentTurnMovement.teleport[0].castCommandId !== declinedTeleportCastId
                  : null
              }
              onChooseSpeed={(speedId) =>
                setMovementSpeedChoice({ actorId: currentTurnMovement.actorId, speedId })
              }
              onTeleportChange={(on) =>
                setDeclinedTeleportCastId(
                  on ? null : currentTurnMovement.teleport[0]!.castCommandId
                )
              }
            />
          ) : null}
          {currentActorMine &&
          activeEncounter &&
          currentActor &&
          activeEncounter.automationMode !== 'MANUAL' ? (
            <CampaignTabletopActionDrawer
              actions={currentActionChoices?.actions ?? []}
              basicActionChoices={currentActionChoices?.basicActionChoices ?? []}
              escapes={currentActionChoices?.escapes ?? []}
              heldGrantEnds={currentActionChoices?.heldGrantEnds ?? []}
              effectOffers={currentActionChoices?.effectOffers ?? []}
              releases={currentActionChoices?.releases ?? []}
              openAttackAction={currentActionChoices?.openAttackAction ?? null}
              defaultActionId={currentActionChoices?.defaultActionId ?? null}
              actionsLoading={actionChoicesLoading}
              actionChoicesError={actionChoicesError}
              connected={live.status === 'CONNECTED'}
              encounter={activeEncounter}
              isGm={campaign.role === 'OWNER'}
              opened={actionsOpened && !aimingArea && !targeting}
              onOpen={() => setActionsOpened(true)}
              onClose={() => setActionsOpened(false)}
              unavailableActions={currentActionChoices?.unavailableActions ?? []}
              optionalRules={currentActionChoices?.optionalRules ?? []}
              pending={encounterCommand.isPending || pendingOccurrence !== null}
              scene={encounterScene}
              areaAim={areaAim}
              waitingOn={encounterSessionState?.waitingOn ?? null}
              actorIdByTokenId={actorIdByTokenId}
              onAreaAimChange={setAreaAim}
              onAreaSizeChange={setAreaSize}
              onActionPreviewChange={setActionPreview}
              onPickAreaOrigin={() => setAimingArea(true)}
              pickedTargetActorId={pickedTargetActorId}
              onPickTargetOnMap={setTargetingRequest}
              onTargetPick={setPickedTargetActorId}
              onResolve={(command) => encounterCommand.mutateAsync(command)}
              onEscape={(command) => encounterCommand.mutateAsync(command)}
              onEndHeldGrant={(command) => encounterCommand.mutateAsync(command)}
              onMoveHeldEffect={(command) => encounterCommand.mutateAsync(command)}
              onRelease={(command) => encounterCommand.mutateAsync(command)}
              onLoadOptionalChoices={loadOptionalActionChoices}
              onLoadItemChoices={loadActionItemChoices}
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
            previewTokenId={previewTokenId}
            role={campaign.role}
            scene={scene}
            selectedTokenId={selectedSceneTokenId}
            renderer={renderer}
            onDoorState={setDoorState}
            onFogLayer={setFogLayer}
            onMeasurement={commitMeasurement}
            onMeasurementRemove={removeMeasurement}
            onInspectToken={setInspectedTokenId}
            onSelectToken={setSelectedTokenId}
            onPreviewToken={setChosenPreviewTokenId}
            onTokenMove={(tokenId, position) => {
              const token = scene.tokens.find((candidate) => candidate.id === tokenId)
              if (token) commitTokenMove(tokenId, [token.position, position])
            }}
          />
          <VttZoomControl
            scale={zoomScale}
            onChange={(scale) => renderer.current?.setZoomScale(scale)}
          />
          <Tooltip label='Fit map to view'>
            <ActionIcon
              aria-label='Fit map to view'
              variant='default'
              onClick={() => renderer.current?.fit()}
            >
              <Crosshair aria-hidden size={18} />
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
          {hoveredTarget ? (
            <Text aria-live='polite' role='status' size='sm'>
              {hoveredTarget.label}: {describeTargetEntry(hoveredTarget)}
            </Text>
          ) : null}
          {listedPresentation?.dispositionLabel || listedPresentation?.statuses.length ? (
            <CampaignVttTokenStatusList
              dispositionLabel={listedPresentation.dispositionLabel}
              label={listedLabel}
              statuses={listedPresentation.statuses}
            />
          ) : null}
          {carefulChoice ? (
            <CampaignVttCarefulMoveChoice
              fields={carefulChoice.fields}
              onCancel={() => setCarefulChoice(null)}
              onChoose={(carefully) => {
                setCarefulChoice(null)
                commitTokenMove(carefulChoice.tokenId, carefulChoice.path, carefully)
              }}
            />
          ) : null}
          {destinationPick && destinationPending ? (
            <CampaignVttForcedMovementPick
              disabled={encounterCommand.isPending}
              key={`${destinationPending.occurrenceId}:${destinationPending.occurrenceVersion}`}
              pick={destinationPick}
              onFocusSquare={setFocusedDestination}
              onPick={pickDestination}
            />
          ) : null}
          {moveWarning ? (
            <CampaignTabletopActionConfirmation
              confirmIsPrimary={false}
              confirmLabel='Do it anyway'
              disabled={false}
              title='This breaks a rule'
              onCancel={() => setMoveWarning(null)}
              onConfirm={() => {
                setMoveWarning(null)
                sendTokenMove({
                  ...moveWarning.command,
                  acknowledgedWarnings: moveWarning.warnings.map((warning) => warning.code),
                  commandId: crypto.randomUUID()
                })
              }}
            >
              <List size='sm'>
                {moveWarning.warnings.map((warning) => (
                  <List.Item key={warning.code}>{warning.message}</List.Item>
                ))}
              </List>
            </CampaignTabletopActionConfirmation>
          ) : null}
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
  onInspectToken,
  onMeasurementRemove,
  onPreviewToken,
  onSelectToken,
  onTokenMove,
  previewTokenId,
  renderer,
  role,
  scene,
  selectedTokenId
}: {
  boundTokenControl: ReadonlyMap<string, boolean>
  currentUserId: string
  memberships: CampaignDetailDto['memberships']
  onDoorState: (barrierId: string, state: 'CLOSED' | 'LOCKED' | 'OPEN') => void
  onFogLayer: (ownerUserId: string | null, explored: boolean) => void
  onMeasurement: (path: ScenePoint[]) => void
  onInspectToken: (tokenId: string | null) => void
  onMeasurementRemove: (measurementId: string) => void
  onPreviewToken: (tokenId: string | null) => void
  onSelectToken: (tokenId: string | null) => void
  onTokenMove: (tokenId: string, position: ScenePoint) => void
  previewTokenId: string | null
  selectedTokenId: string | null
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
          <div aria-label='Scene objects' className={styles.menuScroller} role='group' tabIndex={0}>
            <Menu.Label>Tokens</Menu.Label>
            {scene.tokens.length ? (
              scene.tokens.map((token) => (
                <Fragment key={token.id}>
                  <Menu.Item
                    onBlur={() => onInspectToken(null)}
                    rightSection={
                      selectedTokenId === token.id ? <Check aria-hidden size={14} /> : null
                    }
                    onClick={() => {
                      onSelectToken(token.id)
                      renderer.current?.focusToken(token)
                    }}
                    onFocus={() => onInspectToken(token.id)}
                    onMouseEnter={() => onInspectToken(token.id)}
                    onMouseLeave={() => onInspectToken(null)}
                  >
                    Focus {token.label}
                  </Menu.Item>
                  {role === 'OWNER' ? (
                    <Menu.Item
                      closeMenuOnClick={false}
                      rightSection={
                        previewTokenId === token.id ? <Check aria-hidden size={14} /> : null
                      }
                      onClick={() => onPreviewToken(previewTokenId === token.id ? null : token.id)}
                    >
                      {previewTokenId === token.id ? 'Stop previewing' : 'Preview view'}{' '}
                      {token.label}
                    </Menu.Item>
                  ) : null}
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
          </div>
        </Menu.Dropdown>
      </Menu>
    </>
  )
}
