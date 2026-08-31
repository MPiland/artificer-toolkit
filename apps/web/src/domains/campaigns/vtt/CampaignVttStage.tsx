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
import { useQueries, useQuery } from '@tanstack/react-query'
import { Crosshair, Gamepad2, SlidersHorizontal, Undo2, ZoomIn, ZoomOut } from 'lucide-react'
import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import type { SceneCommandInputDto } from '@artificer-toolkit/schema/api/vttScenes'
import type { ImageLookupInput } from '@artificer-toolkit/schema/api/media'
import {
  createSceneFogAreaPatch,
  createUniformSceneFogLayer,
  projectSceneForViewer,
  type ScenePoint
} from '@artificer-toolkit/shared/vtt'
import {
  getCampaignEncounters,
  getPendingEncounterRuleOccurrence
} from '#app/data/encounters/queries'
import { getCharacterSheet } from '#app/data/characters/queries'
import { api, type CampaignDetailDto, type CampaignSessionDto } from '#app/lib/api'
import { queryKeys } from '#app/lib/queryKeys'
import { CampaignChatDrawer } from '../components/CampaignChatDrawer'
import {
  canMoveSceneToken,
  createSceneAnnotation,
  createSceneBarrier,
  createSceneDarknessZone,
  createSceneLight,
  createSceneToken,
  editTools,
  findPresentedScene,
  nudgeSceneToken,
  playTools,
  type CampaignVttToolDefinition,
  type SceneTokenNudgeDirection
} from './CampaignVttStage.model'
import { CampaignTabletopEncounterDrawer } from './CampaignTabletopEncounterDrawer'
import { CampaignTabletopActionDrawer } from './CampaignTabletopActionDrawer'
import { CampaignTabletopDecisionDrawer } from './CampaignTabletopDecisionDrawer'
import { CampaignLiveSceneObjectEditor } from './CampaignLiveSceneObjectEditor'
import * as styles from './CampaignVttStage.css'
import { useCampaignLiveSession } from './useCampaignLiveSession'
import {
  createVttSceneRenderer,
  type CampaignVttMode,
  type CampaignVttTool,
  type VttMapLoadStatus,
  type VttSceneRenderer,
  type VttSceneRendererUpdate
} from './vttSceneRenderer'
import { formatSceneMeasurement } from './vttSceneRenderer.model'
import { buildVttTokenPresentations } from './vttTokenPresentation.model'

export function CampaignVttStage({
  campaign,
  currentUserId,
  session
}: {
  campaign: CampaignDetailDto
  currentUserId: string
  session: CampaignSessionDto
}) {
  const encounters = useQuery(getCampaignEncounters(campaign.id))
  const activeEncounter = encounters.data?.find(
    (encounter) => encounter.sessionId === session.id && encounter.status === 'ACTIVE'
  )
  const currentActor = activeEncounter?.actors.find(
    (actor) => actor.id === activeEncounter.currentActorId
  )
  const actionCharacterId =
    currentActor?.kind === 'CHARACTER' &&
    currentActor.sourceId &&
    (campaign.role === 'OWNER' || campaign.assignedCharacter?.id === currentActor.sourceId)
      ? currentActor.sourceId
      : null
  const actionSheet = useQuery({
    ...getCharacterSheet(actionCharacterId ?? 'unavailable'),
    enabled: Boolean(actionCharacterId)
  })
  const pendingOccurrence = useQuery({
    ...getPendingEncounterRuleOccurrence(activeEncounter?.id ?? 'unavailable'),
    enabled: Boolean(activeEncounter)
  })
  const renderer = useRef<VttSceneRenderer | null>(null)
  const rendererHost = useRef<HTMLDivElement | null>(null)
  const rendererUpdateRef = useRef<VttSceneRendererUpdate | null>(null)
  const sceneRef = useRef<ReturnType<typeof findPresentedScene>>(undefined)
  const transientSequence = useRef(0)
  const transientSentAt = useRef(new Map<string, number>())
  const [mode, setMode] = useState<CampaignVttMode>('PLAY')
  const [mapLoadStatus, setMapLoadStatus] = useState<VttMapLoadStatus | null>(null)
  const [tool, setTool] = useState<CampaignVttTool>('SELECT')
  const [fogOwnerUserId, setFogOwnerUserId] = useState<string | null>(null)
  const [gmPreviewUserId, setGmPreviewUserId] = useState<string | null>(null)
  const fogOwnerUserIdRef = useRef<string | null>(null)
  fogOwnerUserIdRef.current = fogOwnerUserId

  const live = useCampaignLiveSession({
    campaignId: campaign.id,
    enabled: true,
    onTransient: (message) => renderer.current?.applyTransient(message),
    sessionId: session.id
  })
  const liveScenes = useQuery({
    enabled: campaign.role === 'OWNER',
    queryFn: () => api.campaigns.scenes.listLive(campaign.id),
    queryKey: queryKeys.campaigns.liveScenes(campaign.id),
    staleTime: 30_000
  })
  const scene = findPresentedScene(live.state.scenes)
  sceneRef.current = scene
  const effectiveMode = campaign.role === 'OWNER' && !gmPreviewUserId ? mode : 'PLAY'
  const tools = effectiveMode === 'EDIT' ? editTools : playTools

  const actorIdByTokenId = useMemo(
    () =>
      new Map(
        live.state.encounterActorTokenBindings
          .filter(
            (binding) =>
              binding.encounterId === activeEncounter?.id && binding.sceneId === scene?.id
          )
          .map((binding) => [binding.tokenId, binding.actorId])
      ),
    [activeEncounter?.id, live.state.encounterActorTokenBindings, scene?.id]
  )
  const activeEncounterSceneBinding = live.state.encounterSceneBindings.find(
    (binding) => binding.encounterId === activeEncounter?.id
  )
  const scenePresentationControl =
    campaign.role === 'OWNER' ? (
      <Select
        aria-label='Presented campaign scene'
        clearable
        data={(liveScenes.data ?? []).map((candidate) => ({
          label: candidate.name,
          value: candidate.id
        }))}
        disabled={live.status !== 'CONNECTED' || liveScenes.isPending}
        placeholder='Present a scene'
        size='xs'
        value={scene?.id ?? null}
        onChange={(sceneId) =>
          live.sendCommand({
            aggregateKind: 'SESSION',
            command: {
              commandId: crypto.randomUUID(),
              expectedPresentationVersion: live.getAggregateVersion('SESSION', session.id),
              sceneId,
              sessionId: session.id,
              type: 'SET_CAMPAIGN_LIVE_SCENE_PRESENTATION'
            }
          })
        }
      />
    ) : null

  const mapDelivery = useQuery({
    enabled: Boolean(scene?.map.assetId),
    queryFn: () => api.media.getVttMapDelivery({ assetId: scene!.map.assetId }),
    queryKey: queryKeys.media.vttMap(scene?.map.assetId ?? 'unavailable'),
    refetchOnReconnect: 'always',
    refetchOnWindowFocus: false,
    staleTime: 4 * 60_000
  })
  const mapFailure =
    mapDelivery.error instanceof Error
      ? mapDelivery.error.message
      : mapLoadStatus === 'ERROR'
        ? 'Map artwork could not be loaded.'
        : null
  const renderedScene =
    scene && campaign.role === 'OWNER' && gmPreviewUserId
      ? projectSceneForViewer(scene, { role: 'PLAYER', userId: gmPreviewUserId })
      : scene
  const tokenImageLookups = useMemo(
    () =>
      (renderedScene?.tokens ?? []).flatMap((token) => {
        const actorId = actorIdByTokenId.get(token.id)
        const actor = activeEncounter?.actors.find((candidate) => candidate.id === actorId)
        if (!actor?.sourceId || (actor.kind !== 'CHARACTER' && actor.kind !== 'CREATURE')) return []
        const target: ImageLookupInput['target'] =
          actor.kind === 'CHARACTER'
            ? { characterId: actor.sourceId, type: 'CHARACTER_PORTRAIT' }
            : {
                scope: 'ACTIVE',
                subjectId: actor.sourceId,
                subjectKind: 'CREATURE',
                type: 'AUTHORED_IMAGE'
              }
        return [{ target, tokenAssetId: token.assetId, tokenId: token.id }]
      }),
    [activeEncounter?.actors, actorIdByTokenId, renderedScene?.tokens]
  )
  const tokenImageQueries = useQueries({
    queries: tokenImageLookups.map((lookup) => ({
      queryFn: () => api.media.getImage({ target: lookup.target, variantKind: 'THUMBNAIL' }),
      queryKey: ['media', lookup.target, 'THUMBNAIL'] as const,
      refetchOnReconnect: 'always' as const,
      refetchOnWindowFocus: false,
      staleTime: 4 * 60_000
    }))
  })
  const tokenArtUrls = useMemo(
    () =>
      Object.fromEntries(
        tokenImageLookups.flatMap((lookup, index) => {
          const image = tokenImageQueries[index]?.data
          return image && (!lookup.tokenAssetId || lookup.tokenAssetId === image.assetId)
            ? [[lookup.tokenId, image.url]]
            : []
        })
      ),
    [tokenImageLookups, tokenImageQueries]
  )
  const tokenPresentations = useMemo(
    () =>
      renderedScene && activeEncounter
        ? buildVttTokenPresentations({
            actorIdByTokenId,
            artUrls: tokenArtUrls,
            currentUserId: gmPreviewUserId ?? currentUserId,
            encounter: activeEncounter,
            pending: pendingOccurrence.data ?? null,
            scene: renderedScene
          })
        : undefined,
    [
      activeEncounter,
      actorIdByTokenId,
      currentUserId,
      gmPreviewUserId,
      pendingOccurrence.data,
      renderedScene,
      tokenArtUrls
    ]
  )
  rendererUpdateRef.current = renderedScene
    ? {
        currentUserId: gmPreviewUserId ?? currentUserId,
        mapDelivery: mapDelivery.data ?? null,
        mode: effectiveMode,
        role: gmPreviewUserId ? 'PLAYER' : campaign.role,
        scene: renderedScene,
        tokenPresentations,
        tool
      }
    : null

  const dispatchSceneCommand = useCallback(
    (command: SceneCommandInputDto) => live.sendCommand({ aggregateKind: 'SCENE', command }),
    [live]
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
            kind: 'POINTER_PREVIEW'
            position: ScenePoint
          }
        | {
            explored: boolean
            kind: 'FOG_AREA_PREVIEW'
            ownerUserId: string | null
            rectangle: { a: ScenePoint; b: ScenePoint }
          }
    ) => {
      const current = sceneRef.current
      if (!current) return
      const streamKey =
        envelope.kind === 'TOKEN_DRAG_PREVIEW'
          ? `${envelope.kind}:${envelope.tokenId}`
          : envelope.kind === 'FOG_AREA_PREVIEW'
            ? `${envelope.kind}:${envelope.ownerUserId ?? 'SHARED_PARTY'}`
            : envelope.kind
      const now = performance.now()
      if (now - (transientSentAt.current.get(streamKey) ?? 0) < 32) return
      transientSentAt.current.set(streamKey, now)
      transientSequence.current += 1
      const metadata = {
        baselineVersion: current.version,
        sceneId: current.id,
        sequence: transientSequence.current
      }
      live.sendTransient(
        envelope.kind === 'TOKEN_DRAG_PREVIEW'
          ? { ...envelope, ...metadata, previewUserId: gmPreviewUserId ?? undefined }
          : { ...envelope, ...metadata }
      )
    },
    [gmPreviewUserId, live]
  )
  const transientRef = useRef(sendTransient)
  transientRef.current = sendTransient

  useEffect(() => {
    const host = rendererHost.current
    if (!host || !scene) return
    let disposed = false
    void createVttSceneRenderer(host, {
      onMapLoadStatus: setMapLoadStatus,
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
        if (current.fogMode === 'PER_PLAYER' && !ownerUserId) return
        transientRef.current({
          explored,
          kind: 'FOG_AREA_PREVIEW',
          ownerUserId,
          rectangle: { a, b }
        })
      },
      onMeasurementCommit: (path) => commitMeasurement(path),
      onMeasurementPreview: (path) => transientRef.current({ kind: 'MEASUREMENT_PREVIEW', path }),
      onPointerPreview: (position) => transientRef.current({ kind: 'POINTER_PREVIEW', position }),
      onTokenCommit: (tokenId, position) => commitTokenMove(tokenId, position),
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
    void mapDelivery.refetch().then((result) => {
      if (result.isSuccess) renderer.current?.retryMap(result.data)
    })
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

  function commitTokenMove(tokenId: string, path: ScenePoint[]): void {
    const current = sceneRef.current
    if (!current || path.length < 2) return
    const encounterBinding = live.state.encounterSceneBindings.find(
      (binding) => binding.encounterId === activeEncounter?.id && binding.sceneId === current.id
    )
    const mechanicsEncounter = encounterBinding ? activeEncounter : null
    if (campaign.role === 'PLAYER' && !mechanicsEncounter) return
    dispatchRef.current({
      commandId: crypto.randomUUID(),
      correlationId: null,
      expectedEncounterVersion: mechanicsEncounter?.version ?? null,
      expectedSceneVersion: current.version,
      movementKind: 'VOLUNTARY',
      path,
      sceneId: current.id,
      tokenId,
      type: 'MOVE_SCENE_TOKEN'
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
    if (current.fogMode === 'PER_PLAYER' && !ownerUserId) return
    const layer = createSceneFogAreaPatch(current, { explored, ownerUserId, rectangle: { a, b } })
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
    dispatchRef.current({
      barrierId,
      commandId: crypto.randomUUID(),
      expectedSceneVersion: current.version,
      sceneId: current.id,
      state,
      type: 'SET_SCENE_DOOR_STATE'
    })
  }

  function undoLastTokenMove(): void {
    const current = sceneRef.current
    if (!current || campaign.role !== 'OWNER') return
    dispatchRef.current({
      commandId: crypto.randomUUID(),
      expectedSceneVersion: current.version,
      sceneId: current.id,
      type: 'UNDO_LAST_SCENE_MOVE'
    })
  }

  if (encounters.isPending) {
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
      </section>
    )
  }

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
              disabled={live.status !== 'CONNECTED'}
              size='xs'
              variant='light'
              onClick={() =>
                live.sendCommand({
                  aggregateKind: 'ENCOUNTER',
                  command: {
                    commandId: crypto.randomUUID(),
                    encounterId: activeEncounter.id,
                    type: 'BIND_ENCOUNTER_TO_PRESENTED_SCENE'
                  }
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
              encounter={activeEncounter}
              pending={live.encounterCommandPending}
              role={campaign.role}
              scene={activeEncounterSceneBinding?.sceneId === scene.id ? scene : null}
              onCommand={(command) => live.sendCommand({ aggregateKind: 'ENCOUNTER', command })}
            />
          ) : null}
          {actionCharacterId && activeEncounter ? (
            <CampaignTabletopActionDrawer
              actions={actionSheet.data?.actions.items ?? []}
              connected={live.status === 'CONNECTED'}
              encounter={activeEncounter}
              pending={live.encounterCommandPending}
              scene={scene}
              actorIdByTokenId={actorIdByTokenId}
              onResolve={(command) => live.executeCommand({ aggregateKind: 'ENCOUNTER', command })}
            />
          ) : null}
          {pendingOccurrence.data && activeEncounter ? (
            <CampaignTabletopDecisionDrawer
              connected={live.status === 'CONNECTED'}
              encounter={activeEncounter}
              pending={pendingOccurrence.data}
              submitting={live.encounterCommandPending}
              onResolve={(command) => live.executeCommand({ aggregateKind: 'ENCOUNTER', command })}
            />
          ) : null}
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
      {live.error ? (
        <Alert className={styles.error} color='red'>
          {live.error}
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
                .map((membership) => ({ label: membership.username, value: membership.userId }))}
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
  currentUserId: string
  memberships: CampaignDetailDto['memberships']
  onDoorState: (barrierId: string, state: 'CLOSED' | 'LOCKED' | 'OPEN') => void
  onFogLayer: (ownerUserId: string | null, explored: boolean) => void
  onMeasurement: (path: ScenePoint[]) => void
  onMeasurementRemove: (measurementId: string) => void
  onTokenMove: (tokenId: string, position: ScenePoint) => void
  renderer: RefObject<VttSceneRenderer | null>
  role: 'OWNER' | 'PLAYER'
  scene: NonNullable<ReturnType<typeof findPresentedScene>>
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
                {canMoveSceneToken(token, currentUserId, role)
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
          {role === 'OWNER' ? (
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
