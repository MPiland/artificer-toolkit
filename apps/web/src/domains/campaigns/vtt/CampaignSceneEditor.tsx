import { ActionIcon, Alert, Button, Group, Switch, Text, Tooltip } from '@mantine/core'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useConvex } from 'convex/react'
import { Crosshair, Eye, RotateCcw, Save, ZoomIn, ZoomOut } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { SceneDefinitionDto } from '@artificer-toolkit/schema/api/vttScenes'
import type { CampaignDetailDto } from '@artificer-toolkit/schema/api/campaignCore'
import { saveSceneDefinition } from '#app/data/campaigns/scenes'
import { useVttMapDelivery } from '#app/data/media'
import { queryKeys } from '#app/lib/queryKeys'
import { createEditorSceneState, updateSceneEditorDraft } from './CampaignSceneEditor.model'
import {
  createSceneAnnotation,
  createSceneBarrier,
  createSceneDarknessZone,
  createSceneLight,
  createSceneToken,
  editTools,
  isFogTool,
  type CampaignVttToolDefinition
} from './CampaignVttStage.model'
import { CampaignSceneLootEditor } from './CampaignSceneLootEditor'
import { CampaignSceneObjectInspector } from './CampaignSceneObjectInspector'
import { SceneObjectCreator } from './SceneObjectCreator'
import * as preparationStyles from './CampaignScenePreparation.css'
import * as stageStyles from './CampaignVttStage.css'
import {
  createVttSceneRenderer,
  type CampaignVttTool,
  type VttMapLoadStatus,
  type VttSceneRenderer,
  type VttSceneRendererUpdate
} from './vttSceneRenderer'

export function CampaignSceneEditor({
  campaignId,
  currentUserId,
  gameSystemId,
  memberships,
  onDirtyChange,
  scene
}: {
  campaignId: string
  currentUserId: string
  gameSystemId: string
  memberships: CampaignDetailDto['memberships']
  onDirtyChange: (dirty: boolean) => void
  scene: SceneDefinitionDto
}) {
  const queryClient = useQueryClient()
  const convex = useConvex()
  const saveCommandId = useRef<string | null>(null)
  const renderer = useRef<VttSceneRenderer | null>(null)
  const rendererHost = useRef<HTMLDivElement | null>(null)
  const rendererUpdateRef = useRef<VttSceneRendererUpdate | null>(null)
  const savingRef = useRef(false)
  const previewRef = useRef(false)
  const [draft, setDraft] = useState(() => structuredClone(scene))
  const [dirty, setDirty] = useState(false)
  const [mapLoadStatus, setMapLoadStatus] = useState<VttMapLoadStatus | null>(null)
  const [playerPreview, setPlayerPreview] = useState(false)
  const [tool, setTool] = useState<CampaignVttTool>('SELECT')

  const save = useMutation({
    mutationFn: (submitted: SceneDefinitionDto) => {
      const { id, version, ...definition } = submitted
      saveCommandId.current ??= crypto.randomUUID()
      return saveSceneDefinition(
        convex,
        {
          ...definition,
          expectedVersion: version,
          sceneId: id
        },
        saveCommandId.current
      )
    },
    onSuccess: async (saved) => {
      saveCommandId.current = null
      setDraft(structuredClone(saved))
      setDirty(false)
      await queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.scenes(campaignId) })
    },
    onSettled: () => {
      savingRef.current = false
    }
  })

  const [syncedScene, setSyncedScene] = useState({ id: scene.id, version: scene.version })
  if (syncedScene.id !== scene.id || syncedScene.version !== scene.version) {
    setSyncedScene({ id: scene.id, version: scene.version })
    if (!dirty && !save.isPending) {
      setDraft(structuredClone(scene))
      setPlayerPreview(false)
      setTool('SELECT')
    }
  }

  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange])
  useEffect(() => () => onDirtyChange(false), [onDirtyChange])

  const mapDelivery = useVttMapDelivery(draft.map.assetId, (delivery) =>
    renderer.current?.retryMap(delivery)
  )
  const mapFailure =
    mapDelivery.error instanceof Error
      ? mapDelivery.error.message
      : mapLoadStatus === 'ERROR'
        ? 'Map artwork could not be loaded.'
        : null
  const previewUserId =
    draft.tokens.flatMap((token) => token.controlledByUserIds)[0] ?? currentUserId
  const rendererUpdate: VttSceneRendererUpdate = {
    // Scene preparation has no Encounter, so no token is bound to an actor.
    boundTokenControl: new Map(),
    currentUserId,
    mapDelivery: mapDelivery.data ?? null,
    mode: playerPreview ? 'PLAY' : 'EDIT',
    role: playerPreview ? 'PLAYER' : 'OWNER',
    scene: createEditorSceneState(draft, playerPreview ? previewUserId : null),
    tool: playerPreview ? 'PAN' : tool
  }

  // Latest values for renderer callbacks and the renderer's creation; written after commit.
  useEffect(() => {
    previewRef.current = playerPreview
    rendererUpdateRef.current = rendererUpdate
  })

  const changeDraft = useCallback((change: (current: SceneDefinitionDto) => SceneDefinitionDto) => {
    if (savingRef.current) return
    saveCommandId.current = null
    setDraft((current) => updateSceneEditorDraft(current, change, savingRef.current))
    setDirty(true)
  }, [])

  useEffect(() => {
    const host = rendererHost.current
    if (!host) return
    let disposed = false
    void createVttSceneRenderer(host, {
      onMapLoadStatus: (status) => {
        setMapLoadStatus(status)
        mapDelivery.onMapLoadStatus(status)
      },
      onCreateAnnotation: (position) => {
        if (previewRef.current) return
        changeDraft((current) => ({
          ...current,
          annotations: [
            ...current.annotations,
            createSceneAnnotation(current.annotations.length, position)
          ]
        }))
      },
      onCreateBarrier: (kind, a, b) => {
        if (previewRef.current || (a.x === b.x && a.y === b.y)) return
        changeDraft((current) => ({
          ...current,
          barriers: [...current.barriers, createSceneBarrier(kind, a, b)]
        }))
      },
      onCreateDarkness: (a, b) => {
        if (previewRef.current) return
        const zone = createSceneDarknessZone(a, b)
        if (!zone) return
        changeDraft((current) => ({
          ...current,
          darknessZones: [...current.darknessZones, zone]
        }))
      },
      onCreateLight: (position) => {
        if (previewRef.current) return
        changeDraft((current) => ({
          ...current,
          lights: [...current.lights, createSceneLight(position)]
        }))
      },
      onCreateToken: (position) => {
        if (previewRef.current) return
        changeDraft((current) => ({
          ...current,
          tokens: [
            ...current.tokens,
            createSceneToken(current.grid, current.tokens.length, position)
          ]
        }))
      },
      onDoorState: (barrierId, state) => {
        if (previewRef.current) return
        changeDraft((current) => ({
          ...current,
          barriers: current.barriers.map((barrier) =>
            barrier.kind === 'DOOR' && barrier.id === barrierId
              ? { ...barrier, initialState: state }
              : barrier
          )
        }))
      },
      onMeasurementCommit: () => undefined,
      onMeasurementPreview: () => undefined,
      onPing: () => false,
      onTokenCommit: (tokenId, path) => {
        if (previewRef.current) return
        const position = path.at(-1)
        if (!position) return
        changeDraft((current) => ({
          ...current,
          tokens: current.tokens.map((token) =>
            token.id === tokenId ? { ...token, position } : token
          )
        }))
      },
      onTokenPreview: () => undefined
    }).then((nextRenderer) => {
      if (disposed) {
        nextRenderer.destroy()
        return
      }
      renderer.current = nextRenderer
      const latestUpdate = rendererUpdateRef.current
      if (latestUpdate) nextRenderer.update(latestUpdate)
    })
    return () => {
      disposed = true
      renderer.current?.destroy()
      renderer.current = null
    }
  }, [changeDraft, currentUserId, scene.id])

  useEffect(() => {
    const latestUpdate = rendererUpdateRef.current
    if (latestUpdate) renderer.current?.update(latestUpdate)
  }, [currentUserId, draft, mapDelivery.data, playerPreview, tool])

  const [mapLoadKey, setMapLoadKey] = useState({ assetId: draft.map.assetId, sceneId: scene.id })
  if (mapLoadKey.sceneId !== scene.id || mapLoadKey.assetId !== draft.map.assetId) {
    setMapLoadKey({ assetId: draft.map.assetId, sceneId: scene.id })
    setMapLoadStatus(null)
  }

  function retryMap(): void {
    setMapLoadStatus('LOADING')
    mapDelivery.refresh()
  }

  return (
    <section className={preparationStyles.editor} aria-label={`Scene editor: ${draft.name}`}>
      <div className={preparationStyles.editorHeader}>
        <div>
          <Text fw={650}>{draft.name}</Text>
          <Text c='dimmed' size='xs'>
            Structural edits stay in Prepare. Players receive the clean live scene.
          </Text>
        </div>
        <Group gap='xs'>
          <Switch
            checked={playerPreview}
            label='Player preview'
            size='sm'
            thumbIcon={<Eye aria-hidden size={12} />}
            onChange={(event) => setPlayerPreview(event.currentTarget.checked)}
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
          <Button
            disabled={!dirty || save.isPending}
            leftSection={<RotateCcw aria-hidden size={16} />}
            size='xs'
            variant='default'
            onClick={() => {
              saveCommandId.current = null
              setDraft(structuredClone(scene))
              setDirty(false)
            }}
          >
            Reset
          </Button>
          <Button
            disabled={!dirty || save.isPending}
            leftSection={<Save aria-hidden size={16} />}
            loading={save.isPending}
            size='xs'
            onClick={() => {
              savingRef.current = true
              save.mutate(structuredClone(draft))
            }}
          >
            Save scene
          </Button>
        </Group>
      </div>
      {save.error ? <Alert color='red'>{save.error.message}</Alert> : null}
      {mapFailure ? (
        <Alert color='red'>
          {mapFailure}
          <Button loading={mapDelivery.isFetching} size='xs' variant='light' onClick={retryMap}>
            Retry map
          </Button>
        </Alert>
      ) : null}
      <div className={preparationStyles.editorLayout}>
        <div className={stageStyles.toolbar} aria-label='Scene editor tools' role='toolbar'>
          {editTools
            .filter((definition) => !isFogTool(definition.value))
            .map((definition) => (
              <EditorToolButton
                definition={definition}
                disabled={playerPreview || save.isPending}
                key={definition.value}
                selected={tool === definition.value}
                onSelect={setTool}
              />
            ))}
        </div>
        <div className={stageStyles.canvasFrame} ref={rendererHost}>
          {!playerPreview && tool === 'WALL' ? (
            <Text className={stageStyles.canvasInstruction} role='status' size='xs'>
              Click to add wall segments. Enter or right-click finishes; Escape cancels.
            </Text>
          ) : null}
        </div>
        <CampaignSceneObjectInspector
          creationSlot={
            !playerPreview ? (
              <SceneObjectCreator
                disabled={save.isPending}
                scene={draft}
                onCreate={(next) => changeDraft(() => next)}
              />
            ) : null
          }
          disabled={playerPreview || save.isPending}
          memberships={memberships}
          scene={draft}
          onChange={(next) => changeDraft(() => next)}
          onFocus={(point) => renderer.current?.focusPoint(point)}
        />
      </div>
      <CampaignSceneLootEditor
        campaignId={campaignId}
        gameSystemId={gameSystemId}
        sceneId={scene.id}
      />
    </section>
  )
}

function EditorToolButton({
  definition,
  disabled,
  onSelect,
  selected
}: {
  definition: CampaignVttToolDefinition
  disabled: boolean
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
        disabled={disabled}
        size='lg'
        variant={selected ? 'filled' : 'subtle'}
        onClick={() => onSelect(definition.value)}
      >
        <Icon aria-hidden size={19} />
      </ActionIcon>
    </Tooltip>
  )
}
