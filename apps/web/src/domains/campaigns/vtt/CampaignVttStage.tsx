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
import { useQuery } from '@tanstack/react-query'
import { Crosshair, Gamepad2, SlidersHorizontal, Undo2, ZoomIn, ZoomOut } from 'lucide-react'
import { Fragment, useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import type { SceneCommandInputDto } from '@artificer-toolkit/schema/api/vttScenes'
import {
  createSceneFogAreaPatch,
  createUniformSceneFogLayer,
  projectSceneForViewer,
  type ScenePoint
} from '@artificer-toolkit/shared/vtt'
import { getCampaignEncounters } from '#app/data/encounters/queries'
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
  findSceneForEncounter,
  nudgeSceneToken,
  playTools,
  type CampaignVttToolDefinition,
  type SceneTokenNudgeDirection
} from './CampaignVttStage.model'
import { CampaignTabletopEncounterDrawer } from './CampaignTabletopEncounterDrawer'
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
  const renderer = useRef<VttSceneRenderer | null>(null)
  const rendererHost = useRef<HTMLDivElement | null>(null)
  const rendererUpdateRef = useRef<VttSceneRendererUpdate | null>(null)
  const sceneRef = useRef<ReturnType<typeof findSceneForEncounter>>(undefined)
  const transientSequence = useRef(0)
  const transientSentAt = useRef(new Map<string, number>())
  const [mode, setMode] = useState<CampaignVttMode>('PLAY')
  const [mapLoadStatus, setMapLoadStatus] = useState<VttMapLoadStatus | null>(null)
  const [selectedDefinitionId, setSelectedDefinitionId] = useState<string | null>(null)
  const [tool, setTool] = useState<CampaignVttTool>('SELECT')
  const [fogOwnerUserId, setFogOwnerUserId] = useState<string | null>(null)
  const [gmPreviewUserId, setGmPreviewUserId] = useState<string | null>(null)
  const fogOwnerUserIdRef = useRef<string | null>(null)
  fogOwnerUserIdRef.current = fogOwnerUserId

  const live = useCampaignLiveSession({
    campaignId: campaign.id,
    enabled: Boolean(activeEncounter),
    onTransient: (message) => renderer.current?.applyTransient(message),
    sessionId: session.id
  })
  const scene = findSceneForEncounter(live.state.scenes, activeEncounter?.id)
  sceneRef.current = scene
  const effectiveMode = campaign.role === 'OWNER' && !gmPreviewUserId ? mode : 'PLAY'
  const tools = effectiveMode === 'EDIT' ? editTools : playTools

  const definitions = useQuery({
    enabled: campaign.role === 'OWNER' && Boolean(activeEncounter) && !scene,
    queryFn: () => api.campaigns.scenes.list(campaign.id),
    queryKey: queryKeys.campaigns.scenes(campaign.id)
  })
  useEffect(() => {
    if (selectedDefinitionId || !definitions.data?.[0]) return
    setSelectedDefinitionId(definitions.data[0].id)
  }, [definitions.data, selectedDefinitionId])

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
  rendererUpdateRef.current = renderedScene
    ? {
        currentUserId: gmPreviewUserId ?? currentUserId,
        mapDelivery: mapDelivery.data ?? null,
        mode: effectiveMode,
        role: gmPreviewUserId ? 'PLAYER' : campaign.role,
        scene: renderedScene,
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
          encounterId: current.encounterId,
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
          encounterId: current.encounterId,
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
          encounterId: current.encounterId,
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
          encounterId: current.encounterId,
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
          encounterId: current.encounterId,
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
      encounterId: current.encounterId,
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
    dispatchRef.current({
      commandId: crypto.randomUUID(),
      encounterId: current.encounterId,
      expectedSceneVersion: current.version,
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
      encounterId: current.encounterId,
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
      encounterId: current.encounterId,
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
      encounterId: current.encounterId,
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
      encounterId: current.encounterId,
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
      encounterId: current.encounterId,
      expectedSceneVersion: current.version,
      sceneId: current.id,
      type: 'UNDO_LAST_SCENE_MOVE'
    })
  }

  if (encounters.isPending) {
    return <VttEmpty title='Loading live map…' />
  }
  if (!activeEncounter) {
    return (
      <VttEmpty
        title='No active encounter'
        body={
          campaign.role === 'OWNER'
            ? 'Start an encounter to open its live scene.'
            : 'The GM has not started a live encounter yet.'
        }
      />
    )
  }
  if (!scene) {
    if (campaign.role === 'PLAYER') {
      return (
        <VttEmpty
          title='The live map is being prepared'
          body='It will appear here automatically.'
        />
      )
    }
    return (
      <div className={styles.empty}>
        <div>
          <Text fw={650}>Attach a scene</Text>
          <Text c='dimmed' size='sm'>
            Choose a reusable Campaign scene for {activeEncounter.name}.
          </Text>
        </div>
        <div className={styles.attachControls}>
          <Select
            data={(definitions.data ?? []).map((definition) => ({
              label: definition.name,
              value: definition.id
            }))}
            disabled={definitions.isPending}
            label='Campaign scene'
            placeholder={definitions.isPending ? 'Loading scenes…' : 'Choose a scene'}
            value={selectedDefinitionId}
            onChange={setSelectedDefinitionId}
          />
          <Button
            disabled={!selectedDefinitionId || live.status !== 'CONNECTED'}
            onClick={() => {
              if (!selectedDefinitionId) return
              live.sendCommand({
                aggregateKind: 'SCENE',
                command: {
                  commandId: crypto.randomUUID(),
                  encounterId: activeEncounter.id,
                  sceneDefinitionId: selectedDefinitionId,
                  type: 'ATTACH_SCENE'
                }
              })
            }}
          >
            Open live scene
          </Button>
        </div>
        {definitions.isSuccess && definitions.data.length === 0 ? (
          <Text c='dimmed' size='sm'>
            Create a Campaign scene before attaching one to this encounter.
          </Text>
        ) : null}
        {live.error ? <Alert color='red'>{live.error}</Alert> : null}
      </div>
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
                    encounterId: current.encounterId,
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
          <CampaignTabletopEncounterDrawer
            connected={live.status === 'CONNECTED'}
            encounter={activeEncounter}
            pending={live.encounterCommandPending}
            role={campaign.role}
            onCommand={(command) => live.sendCommand({ aggregateKind: 'ENCOUNTER', command })}
          />
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
            <span className={styles.overlayPill}>{activeEncounter.name}</span>
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
  scene: NonNullable<ReturnType<typeof findSceneForEncounter>>
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
        classNames={{ label: styles.menuLabel }}
        position='bottom-end'
        shadow='md'
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
