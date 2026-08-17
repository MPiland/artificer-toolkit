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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useBlocker } from '@tanstack/react-router'
import { useCallback, useEffect, useId, useRef, useState, type MouseEvent } from 'react'
import type { SignedVttMapDeliveryDto } from '@artificer-toolkit/schema/api/media'
import { api, type CampaignDetailDto } from '#app/lib/api'
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
  uploadVttMap
} from './vttMapUpload'
import { CampaignSceneEditor } from './CampaignSceneEditor'
import { AuthoringLeaveConfirmation } from '#forms/layout/AuthoringLeaveConfirmation'
import * as styles from './CampaignScenePreparation.css'

export function CampaignScenePreparation({
  campaignId,
  currentUserId,
  memberships
}: {
  campaignId: string
  currentUserId: string
  memberships: CampaignDetailDto['memberships']
}) {
  const queryClient = useQueryClient()
  const gridPatternId = useId()
  const scenes = useQuery({
    queryFn: () => api.campaigns.scenes.list(campaignId),
    queryKey: queryKeys.campaigns.scenes(campaignId)
  })
  const [file, setFile] = useState<File | null>(null)
  const [name, setName] = useState('')
  const [gridKind, setGridKind] = useState<'GRIDLESS' | 'SQUARE'>('SQUARE')
  const [cellSize, setCellSize] = useState(70)
  const [distancePerCell, setDistancePerCell] = useState(5)
  const [originX, setOriginX] = useState(0)
  const [originY, setOriginY] = useState(0)
  const [calibrationStep, setCalibrationStep] = useState<'CELL' | 'ORIGIN' | null>(null)
  const calibrationOrigin = useRef<{ x: number; y: number } | null>(null)
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
  const selectedScene =
    scenes.data?.find((scene) => scene.id === selectedSceneId) ?? scenes.data?.[0] ?? null

  const upload = useMutation({
    mutationFn: async () => {
      if (!file || fileError) throw new Error(fileError ?? 'Choose a map image.')
      const mimeType = acceptedMapType(file.type)
      if (!mimeType) throw new Error('Maps must be JPEG, PNG, or WebP images.')
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      if (!supabaseUrl) throw new Error('Supabase Storage is not configured.')
      setUploadProgress(0)
      const intent = await api.media.createVttMapUpload({
        declaredBytes: file.size,
        declaredMimeType: mimeType,
        idempotencyKey: getOrCreateVttMapUploadIdempotencyKey(campaignId, file),
        originalFileName: file.name,
        profile: 'VTT_MAP',
        target: { campaignId, type: 'VTT_MAP' }
      })
      await uploadVttMap({
        file,
        intent,
        onProgress: setUploadProgress,
        supabaseUrl
      })
      const finalized = await api.media.finalizeVttMapUpload({ assetId: intent.assetId })
      clearVttMapUploadIdempotencyKey(campaignId, file)
      if (finalized.status !== 'READY') {
        throw new Error('That map could not be processed. Check its dimensions and try again.')
      }
      return api.media.getVttMapDelivery({ assetId: intent.assetId })
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
      return api.campaigns.scenes.create({
        annotations: [],
        barriers: [],
        campaignId,
        darknessZones: [],
        fogMode: 'SHARED_PARTY',
        visionRevealMode: 'ON_DRAG',
        grid:
          gridKind === 'SQUARE'
            ? {
                cellSize,
                diagonalPolicy: 'ALTERNATING',
                distancePerCell,
                kind: 'SQUARE',
                origin: { x: originX, y: originY },
                unit
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
      })
    },
    onSuccess: async () => {
      setFile(null)
      setName('')
      setUploadProgress(0)
      setUploadedMap(null)
      await queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.scenes(campaignId) })
    }
  })

  useEffect(() => {
    if (!calibrationStep) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        calibrationOrigin.current = null
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
      calibrationOrigin.current = point
      setOriginX(Math.round(point.x))
      setOriginY(Math.round(point.y))
      setCalibrationStep('CELL')
      return
    }
    const origin = calibrationOrigin.current
    if (!origin) {
      setCalibrationStep('ORIGIN')
      return
    }
    setCellSize(
      Math.max(1, Math.round(Math.max(Math.abs(point.x - origin.x), Math.abs(point.y - origin.y))))
    )
    calibrationOrigin.current = null
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
          {scenes.data?.length ?? 0} scene{scenes.data?.length === 1 ? '' : 's'}
        </Text>
      </div>

      {scenes.data?.length ? (
        <div className={styles.sceneList} aria-label='Prepared scenes'>
          {scenes.data.map((scene) => (
            <button
              aria-pressed={selectedScene?.id === scene.id}
              className={styles.sceneRow}
              data-selected={selectedScene?.id === scene.id || undefined}
              disabled={editorDirty && selectedScene?.id !== scene.id}
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
      {editorDirty ? (
        <Text c='dimmed' size='xs'>
          Save or reset the current scene before switching maps.
        </Text>
      ) : null}

      {selectedScene ? (
        <CampaignSceneEditor
          campaignId={campaignId}
          currentUserId={currentUserId}
          memberships={memberships}
          key={selectedScene.id}
          scene={selectedScene}
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
        {upload.error ? <Alert color='red'>{upload.error.message}</Alert> : null}

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
                    calibrationOrigin.current = null
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
                  if (value === 'FEET' || value === 'METERS' || value === 'SQUARES') setUnit(value)
                }}
              />
              {gridKind === 'SQUARE' ? (
                <>
                  <NumberInput
                    decimalScale={2}
                    label='Distance per cell'
                    min={0.01}
                    value={distancePerCell}
                    onChange={(value) => setDistancePerCell(asPositiveNumber(value, 5))}
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
              {calibrationStep === 'CELL' && calibrationOrigin.current ? (
                <span
                  aria-hidden
                  className={styles.calibrationMarker}
                  style={{
                    left: `${(calibrationOrigin.current.x / uploadedMap.width) * 100}%`,
                    top: `${(calibrationOrigin.current.y / uploadedMap.height) * 100}%`
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
