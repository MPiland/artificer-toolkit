import {
  Alert,
  Button,
  FileInput,
  Group,
  NumberInput,
  Progress,
  SegmentedControl,
  Select,
  Stack,
  Text,
  TextInput,
  Title
} from '@mantine/core'
import { useMutation, useQuery } from '@tanstack/react-query'
import {
  useAction,
  useConvex,
  useMutation as useConvexMutation,
  usePaginatedQuery
} from 'convex/react'
import { api as convexApi } from '@artificer-toolkit/apis/convex/api'
import { useBlocker } from '@tanstack/react-router'
import { useCallback, useEffect, useId, useRef, useState, type MouseEvent } from 'react'
import type { SignedVttMapDeliveryDto } from '@artificer-toolkit/schema/api/media'
import type { CampaignDetailDto } from '@artificer-toolkit/schema/api/campaignCore'
import type { CreateSceneDefinitionInputDto } from '@artificer-toolkit/schema/api/vttScenes'
import {
  convertSceneDistance,
  feetInSceneUnit,
  SYSTEM_BASE_SQUARE_FEET
} from '@artificer-toolkit/shared/vtt'
import { loadSceneDefinition, saveSceneDefinition } from '#app/data/campaigns/scenes'
import { queryKeys } from '#app/lib/queryKeys'
import {
  acceptedMapType,
  acceptedMapTypes,
  asNumber,
  asPositiveNumber,
  validateMapFile
} from './CampaignScenePreparation.model'
import {
  clearVttMapUploadIdempotencyKey,
  getOrCreateVttMapUploadIdempotencyKey,
  getUploadedVttMapAssetId,
  uploadVttMap
} from './vttMapUpload'
import { CampaignSceneEditor } from './CampaignSceneEditor'
import { AuthoringLeaveConfirmation } from '#forms/layout/AuthoringLeaveConfirmation'
import * as styles from './CampaignScenePreparation.css'

export function CampaignScenePreparation({
  campaignId,
  currentUserId,
  gameSystemId,
  memberships
}: {
  campaignId: string
  currentUserId: string
  gameSystemId: string
  memberships: CampaignDetailDto['memberships']
}) {
  const convex = useConvex()
  const createUpload = useConvexMutation(convexApi.media.vttMapAssets.createUpload)
  const finalizeMap = useAction(convexApi.media.vttMapActions.finalize)
  const getMapDelivery = useAction(convexApi.media.vttMapActions.getDelivery)
  const gridPatternId = useId()
  const scenes = usePaginatedQuery(
    convexApi.scenes.definitionReads.list,
    { campaignId },
    { initialNumItems: 8 }
  )
  const createAttempt = useRef<{ input: string; commandId: string } | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [name, setName] = useState('')
  const [gridKind, setGridKind] = useState<'GRIDLESS' | 'SQUARE'>('SQUARE')
  const [cellSize, setCellSize] = useState(70)
  const [distancePerCell, setDistancePerCell] = useState(SYSTEM_BASE_SQUARE_FEET)
  const [originX, setOriginX] = useState(0)
  const [originY, setOriginY] = useState(0)
  const [calibrationStep, setCalibrationStep] = useState<'CELL' | 'ORIGIN' | null>(null)
  const [calibrationOrigin, setCalibrationOrigin] = useState<{ x: number; y: number } | null>(null)
  const [unit, setUnit] = useState<'FEET' | 'METERS' | 'SQUARES'>('FEET')
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadedMap, setUploadedMap] = useState<SignedVttMapDeliveryDto | null>(null)
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null)
  const [editorDirty, setEditorDirty] = useState(false)
  const shouldBlockNavigation = useCallback(() => editorDirty, [editorDirty])
  const navigationBlocker = useBlocker({
    disabled: !editorDirty,
    enableBeforeUnload: shouldBlockNavigation,
    shouldBlockFn: shouldBlockNavigation,
    withResolver: true
  })
  const fileError = validateMapFile(file)
  const activeSceneId = selectedSceneId ?? scenes.results[0]?.id ?? null
  const selectedScene = scenes.results.find((scene) => scene.id === activeSceneId) ?? null
  const definition = useQuery({
    queryKey: queryKeys.campaigns.sceneDefinition(campaignId, activeSceneId),
    queryFn: ({ signal }) => {
      if (!activeSceneId) throw new Error('Choose a Scene.')
      return loadSceneDefinition(convex, { campaignId, sceneId: activeSceneId }, signal)
    },
    enabled: activeSceneId !== null,
    staleTime: Number.POSITIVE_INFINITY
  })
  if (activeSceneId && selectedSceneId === null) setSelectedSceneId(activeSceneId)
  useEffect(() => {
    if (definition.data && selectedScene && definition.data.version !== selectedScene.version)
      void definition.refetch()
  }, [selectedScene?.version, definition.data?.version, definition.refetch])

  const upload = useMutation({
    mutationFn: async () => {
      if (!file || fileError) throw new Error(fileError ?? 'Choose a map image.')
      const mimeType = acceptedMapType(file.type)
      if (!mimeType) throw new Error('Maps must be JPEG, PNG, or WebP images.')
      setUploadProgress(0)
      let assetId = getUploadedVttMapAssetId(campaignId, file)
      if (!assetId) {
        const intent = await createUpload({
          declaredBytes: file.size,
          declaredMimeType: mimeType,
          idempotencyKey: getOrCreateVttMapUploadIdempotencyKey(campaignId, file),
          originalFileName: file.name,
          profile: 'VTT_MAP',
          target: { campaignId, type: 'VTT_MAP' }
        })
        await uploadVttMap({
          campaignId,
          file,
          intent,
          onProgress: setUploadProgress
        })
        assetId = intent.assetId
      }
      const finalized = await finalizeMap({ assetId })
      if (finalized.status !== 'READY') {
        if (finalized.status === 'REJECTED') clearVttMapUploadIdempotencyKey(campaignId, file)
        throw new Error('That map could not be processed. Check its dimensions and try again.')
      }
      // A map the owner already uploaded finalizes to that existing asset.
      const delivery = await getMapDelivery({ assetId: finalized.assetId })
      clearVttMapUploadIdempotencyKey(campaignId, file)
      return delivery
    },
    onSuccess: (delivery) => {
      setUploadedMap(delivery)
      if (!name.trim() && file) setName(file.name.replace(/\.[^.]+$/, ''))
    }
  })

  const save = useMutation({
    mutationFn: async () => {
      if (!uploadedMap) throw new Error('Upload and calibrate a map first.')
      if (!name.trim()) throw new Error('Name this scene.')
      const input: CreateSceneDefinitionInputDto = {
        annotations: [],
        ambientIllumination: 'BRIGHT',
        barriers: [],
        campaignId,
        daylight: false,
        darknessZones: [],
        fogMode: 'OFF',
        visionRevealMode: 'ON_DRAG',
        grid:
          gridKind === 'SQUARE'
            ? {
                cellSize,
                diagonalPolicy: 'ALTERNATING',
                kind: 'SQUARE',
                origin: { x: originX, y: originY },
                ...(unit === 'SQUARES' ? { distancePerCell: 1, unit } : { distancePerCell, unit })
              }
            : { kind: 'GRIDLESS', pixelsPerUnit: cellSize, unit },
        lights: [],
        map: {
          assetId: uploadedMap.assetId,
          height: uploadedMap.height,
          tileManifestAssetId: null,
          width: uploadedMap.width
        },
        name: name.trim(),
        tokens: []
      }
      const inputKey = JSON.stringify(input)
      if (createAttempt.current?.input !== inputKey)
        createAttempt.current = { input: inputKey, commandId: crypto.randomUUID() }
      return saveSceneDefinition(convex, input, createAttempt.current.commandId)
    },
    onSuccess: (saved) => {
      createAttempt.current = null
      if (!editorDirty) setSelectedSceneId(saved.id)
      setFile(null)
      setName('')
      setUploadProgress(0)
      setUploadedMap(null)
    }
  })

  useEffect(() => {
    if (!calibrationStep) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setCalibrationOrigin(null)
        setCalibrationStep(null)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [calibrationStep])

  function calibrateAt(event: MouseEvent<HTMLDivElement>): void {
    if (!uploadedMap || !calibrationStep) return
    const bounds = event.currentTarget.getBoundingClientRect()
    const point = {
      x: ((event.clientX - bounds.left) / bounds.width) * uploadedMap.width,
      y: ((event.clientY - bounds.top) / bounds.height) * uploadedMap.height
    }
    if (calibrationStep === 'ORIGIN') {
      setCalibrationOrigin(point)
      setOriginX(Math.round(point.x))
      setOriginY(Math.round(point.y))
      setCalibrationStep('CELL')
      return
    }
    const origin = calibrationOrigin
    if (!origin) {
      setCalibrationStep('ORIGIN')
      return
    }
    setCellSize(
      Math.max(1, Math.round(Math.max(Math.abs(point.x - origin.x), Math.abs(point.y - origin.y))))
    )
    setCalibrationOrigin(null)
    setCalibrationStep(null)
  }
  return (
    <section className={styles.panel} aria-labelledby='campaign-scenes-title'>
      <div className={styles.header}>
        <div>
          <Title id='campaign-scenes-title' order={2}>
            Live maps
          </Title>
          <Text c='dimmed' size='sm'>
            Prepare reusable maps here. Players only see the clean live-play surface.
          </Text>
        </div>
        <Text c='dimmed' size='sm'>
          {scenes.results.length} scene{scenes.results.length === 1 ? '' : 's'}
        </Text>
      </div>

      {scenes.results.length ? (
        <div className={styles.sceneList} aria-label='Prepared scenes'>
          {scenes.results.map((scene) => (
            <button
              aria-pressed={activeSceneId === scene.id}
              className={styles.sceneRow}
              data-selected={activeSceneId === scene.id || undefined}
              disabled={editorDirty && activeSceneId !== scene.id}
              key={scene.id}
              type='button'
              onClick={() => setSelectedSceneId(scene.id)}
            >
              <div>
                <Text fw={600}>{scene.name}</Text>
                <Text c='dimmed' size='xs'>
                  {scene.map.width} × {scene.map.height} ·{' '}
                  {scene.grid.kind === 'SQUARE' ? 'Square grid' : 'Gridless'}
                </Text>
              </div>
              <Text c='dimmed' size='xs'>
                v{scene.version}
              </Text>
            </button>
          ))}
        </div>
      ) : null}
      {scenes.status === 'CanLoadMore' || scenes.status === 'LoadingMore' ? (
        <Button
          variant='subtle'
          loading={scenes.status === 'LoadingMore'}
          onClick={() => scenes.loadMore(8)}
        >
          Load more scenes
        </Button>
      ) : null}
      {scenes.status === 'LoadingFirstPage' || (activeSceneId && definition.isPending) ? (
        <Text role='status' size='sm'>
          Loading scene…
        </Text>
      ) : null}
      {definition.error ? <Alert color='red'>{definition.error.message}</Alert> : null}
      {editorDirty ? (
        <Text c='dimmed' size='xs'>
          Save or reset the current scene before switching maps.
        </Text>
      ) : null}

      {definition.data ? (
        <CampaignSceneEditor
          campaignId={campaignId}
          currentUserId={currentUserId}
          gameSystemId={gameSystemId}
          memberships={memberships}
          key={definition.data.id}
          scene={definition.data}
          onDirtyChange={setEditorDirty}
        />
      ) : null}

      <div className={styles.form}>
        <div>
          <Text fw={650}>Create scene</Text>
          <Text c='dimmed' size='sm'>
            JPEG, PNG, or WebP up to 25 MiB, 8192 px per side, and 64 megapixels.
          </Text>
        </div>
        <div className={styles.formGrid}>
          <FileInput
            accept={acceptedMapTypes.join(',')}
            clearable
            disabled={upload.isPending || Boolean(uploadedMap)}
            error={fileError}
            label='Map image'
            value={file}
            onChange={(next) => {
              if (file && file !== next) clearVttMapUploadIdempotencyKey(campaignId, file)
              setFile(next)
              setUploadedMap(null)
              setUploadProgress(0)
            }}
          />
          <Button
            disabled={!file || Boolean(fileError) || Boolean(uploadedMap)}
            loading={upload.isPending}
            variant='default'
            onClick={() => upload.mutate()}
          >
            Upload map
          </Button>
        </div>
        {upload.isPending ? (
          <Stack gap={4}>
            <Progress aria-label='Map upload progress' value={uploadProgress} />
            <Text c='dimmed' size='xs'>
              Uploading {Math.round(uploadProgress)}%
            </Text>
          </Stack>
        ) : null}
        {upload.error ? (
          <Alert color='red'>
            {upload.error.message}
            <Text size='sm'>To start over, clear the map file and select it again.</Text>
          </Alert>
        ) : null}

        {uploadedMap ? (
          <>
            <div className={styles.formGrid}>
              <TextInput
                label='Scene name'
                maxLength={160}
                value={name}
                onChange={(event) => setName(event.currentTarget.value)}
              />
              <SegmentedControl
                aria-label='Grid type'
                data={[
                  { label: 'Square', value: 'SQUARE' },
                  { label: 'Gridless', value: 'GRIDLESS' }
                ]}
                value={gridKind}
                onChange={(value) => setGridKind(value === 'GRIDLESS' ? 'GRIDLESS' : 'SQUARE')}
              />
              {gridKind === 'SQUARE' ? (
                <Button
                  variant={calibrationStep ? 'light' : 'default'}
                  onClick={() => {
                    setCalibrationOrigin(null)
                    setCalibrationStep(calibrationStep ? null : 'ORIGIN')
                  }}
                >
                  {calibrationStep ? 'Cancel calibration' : 'Calibrate on map'}
                </Button>
              ) : null}
              <NumberInput
                decimalScale={2}
                label={gridKind === 'SQUARE' ? 'Cell size (pixels)' : 'Pixels per unit'}
                max={8192}
                min={1}
                value={cellSize}
                onChange={(value) => setCellSize(asPositiveNumber(value, 70))}
              />
              <Select
                data={[
                  { label: 'Feet', value: 'FEET' },
                  { label: 'Meters', value: 'METERS' },
                  { label: 'Squares', value: 'SQUARES' }
                ]}
                label='Distance unit'
                value={unit}
                onChange={(value) => {
                  if (value !== 'FEET' && value !== 'METERS' && value !== 'SQUARES') return
                  setDistancePerCell(
                    value === 'SQUARES' ? 1 : convertSceneDistance(distancePerCell, unit, value)
                  )
                  setUnit(value)
                }}
              />
              {gridKind === 'SQUARE' ? (
                <>
                  <NumberInput
                    decimalScale={3}
                    disabled={unit === 'SQUARES'}
                    label='Distance per cell'
                    min={0.01}
                    value={distancePerCell}
                    onChange={(value) =>
                      setDistancePerCell(
                        asPositiveNumber(value, feetInSceneUnit(SYSTEM_BASE_SQUARE_FEET, unit))
                      )
                    }
                  />
                  <NumberInput
                    decimalScale={2}
                    label='Grid origin X'
                    value={originX}
                    onChange={(value) => setOriginX(asNumber(value, 0))}
                  />
                  <NumberInput
                    decimalScale={2}
                    label='Grid origin Y'
                    value={originY}
                    onChange={(value) => setOriginY(asNumber(value, 0))}
                  />
                </>
              ) : null}
            </div>
            <div
              aria-label='Map calibration preview'
              className={styles.preview}
              data-calibrating={calibrationStep || undefined}
              onClick={calibrateAt}
            >
              <img
                alt='Uploaded map calibration preview'
                className={styles.previewImage}
                height={uploadedMap.overview.height}
                src={uploadedMap.overview.url}
                width={uploadedMap.overview.width}
              />
              {gridKind === 'SQUARE' ? (
                <svg
                  aria-hidden
                  className={styles.gridOverlay}
                  preserveAspectRatio='none'
                  viewBox={`0 0 ${uploadedMap.width} ${uploadedMap.height}`}
                >
                  <defs>
                    <pattern
                      height={cellSize}
                      id={gridPatternId}
                      patternUnits='userSpaceOnUse'
                      width={cellSize}
                      x={originX}
                      y={originY}
                    >
                      <path
                        d={`M ${cellSize} 0 L 0 0 0 ${cellSize}`}
                        fill='none'
                        stroke='rgba(107, 216, 203, 0.6)'
                        strokeWidth={1}
                        vectorEffect='non-scaling-stroke'
                      />
                    </pattern>
                  </defs>
                  <rect fill={`url(#${gridPatternId})`} height='100%' width='100%' />
                </svg>
              ) : null}
              {calibrationStep === 'CELL' && calibrationOrigin ? (
                <span
                  aria-hidden
                  className={styles.calibrationMarker}
                  style={{
                    left: `${(calibrationOrigin.x / uploadedMap.width) * 100}%`,
                    top: `${(calibrationOrigin.y / uploadedMap.height) * 100}%`
                  }}
                />
              ) : null}
              {calibrationStep ? (
                <Text className={styles.calibrationInstruction} role='status' size='xs'>
                  {calibrationStep === 'ORIGIN'
                    ? 'Click a grid intersection to set the origin.'
                    : 'Click an adjacent grid intersection to set the cell size.'}
                </Text>
              ) : null}
            </div>
            {save.error ? <Alert color='red'>{save.error.message}</Alert> : null}
            <Group>
              <Button loading={save.isPending} onClick={() => save.mutate()}>
                Save scene
              </Button>
              <Button
                variant='subtle'
                onClick={() => {
                  setUploadedMap(null)
                  setUploadProgress(0)
                }}
              >
                Choose another map
              </Button>
            </Group>
          </>
        ) : null}
      </div>
      <AuthoringLeaveConfirmation
        opened={navigationBlocker.status === 'blocked'}
        onStay={() => {
          if (navigationBlocker.status === 'blocked') navigationBlocker.reset()
        }}
        onLeave={() => {
          if (navigationBlocker.status !== 'blocked') return
          navigationBlocker.proceed()
        }}
      />
    </section>
  )
}
