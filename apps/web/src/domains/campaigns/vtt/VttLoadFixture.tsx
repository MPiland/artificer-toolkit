import { useCallback, useEffect, useRef, useState } from 'react'
import type { CampaignSceneStateDto } from '@artificer-toolkit/schema/api/vttScenes'
import { SRD_SYSTEM_ID } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import {
  applySceneDelta,
  createSceneFogAreaPatch,
  projectSceneForViewer
} from '@artificer-toolkit/shared/vtt'
import { createVttSceneRenderer, type VttSceneRenderer } from './vttSceneRenderer'
import {
  moveLoadFixtureScene,
  vttLoadFixtureMapDelivery,
  vttLoadFixtureCommitIntervalMs,
  vttLoadFixtureScene,
  vttLoadFixtureExercise,
  vttLoadFixtureExerciseMode,
  vttLoadFixtureSoakMs,
  vttLoadFixtureUserId
} from './vttLoadFixture.data'

interface VttLoadJourney {
  fogEdit: boolean
  measurementCommit: boolean
  panZoom: boolean
  playerPreview: boolean
  tokenDragCommit: boolean
}

const emptyJourney: VttLoadJourney = {
  fogEdit: false,
  measurementCommit: false,
  panZoom: false,
  playerPreview: false,
  tokenDragCommit: false
}

const maxTimingTelemetryRecords = 50

interface VttForegroundTransition {
  focusState: boolean
  source: 'FOCUS' | 'INITIAL' | 'VISIBILITY'
  timestampMs: number
  visibilityState: DocumentVisibilityState
}

interface VttFrameGapRecord {
  durationMs: number
  focusState: boolean
  maxLongTaskMs: number
  timestampMs: number
  updateCount: number
  visibilityState: DocumentVisibilityState
}

export function VttLoadFixture() {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const rendererRef = useRef<VttSceneRenderer | null>(null)
  const sceneRef = useRef<CampaignSceneStateDto>(vttLoadFixtureScene)
  const cancelExerciseRef = useRef<(() => void) | null>(null)
  const [ready, setReady] = useState(false)
  const [running, setRunning] = useState(false)
  const [journey, setJourney] = useState<VttLoadJourney>(emptyJourney)
  const [status, setStatus] = useState('Loading 8K map tiles…')
  const [report, setReport] = useState<string | null>(null)

  const startExercise = useCallback(() => {
    const renderer = rendererRef.current
    if (!renderer || running || cancelExerciseRef.current) return
    const mode = vttLoadFixtureExerciseMode(window.location.search)
    const soakMs = vttLoadFixtureSoakMs(window.location.search)
    const commitIntervalMs = vttLoadFixtureCommitIntervalMs(window.location.search)
    let cancelled = false
    let frameCount = 0
    let lastFrameAt = performance.now()
    let maxFrameGapMs = 0
    let maxForegroundFrameGapMs = 0
    let maxLongTaskMs = 0
    let updateCount = 0
    let nextCommitAt = lastFrameAt
    let nextTransientAt = lastFrameAt
    let scene = sceneRef.current
    const startedAt = lastFrameAt + vttLoadFixtureExercise.warmupMs
    const frameGapRecords: VttFrameGapRecord[] = []
    const foregroundTransitions: VttForegroundTransition[] = []
    const isForeground = () => document.visibilityState === 'visible' && document.hasFocus()
    let foregroundInterrupted = !isForeground()
    let foregroundInterruptedSinceLastFrame = !isForeground()
    let previousFrameWasForeground = isForeground()
    const recordForegroundTransition = (source: VttForegroundTransition['source']) => {
      if (foregroundTransitions.length >= maxTimingTelemetryRecords) return
      foregroundTransitions.push({
        focusState: document.hasFocus(),
        source,
        timestampMs: performance.now() - startedAt,
        visibilityState: document.visibilityState
      })
    }
    const observeForegroundTransition = (source: VttForegroundTransition['source']) => {
      if (!isForeground()) {
        foregroundInterrupted = true
        foregroundInterruptedSinceLastFrame = true
      }
      recordForegroundTransition(source)
    }
    const onFocus = () => observeForegroundTransition('FOCUS')
    const onVisibilityChange = () => observeForegroundTransition('VISIBILITY')
    recordForegroundTransition('INITIAL')
    window.addEventListener('focus', onFocus)
    window.addEventListener('blur', onFocus)
    document.addEventListener('visibilitychange', onVisibilityChange)
    const observer = new PerformanceObserver((entries) => {
      for (const entry of entries.getEntries())
        maxLongTaskMs = Math.max(maxLongTaskMs, entry.duration)
    })

    try {
      observer.observe({ entryTypes: ['longtask'] })
    } catch {
      observer.disconnect()
    }

    setRunning(true)
    setReport(null)
    setStatus(`Running ${(soakMs / 1_000).toFixed(1)} second ${mode} load exercise…`)

    const finish = () => {
      observer.disconnect()
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('blur', onFocus)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      const elapsedMs = performance.now() - startedAt
      const exerciseReport = {
        averageFps: (frameCount * 1_000) / elapsedMs,
        elapsedMs,
        foregroundInterrupted,
        foregroundTransitions,
        frameGapRecords,
        maxFrameGapMs,
        maxForegroundFrameGapMs,
        maxLongTaskMs,
        mode,
        updateCount
      }
      window.setTimeout(() => {
        if (cancelled) return
        const diagnostics = renderer.getDiagnostics()
        setReport(
          JSON.stringify({
            ...exerciseReport,
            ...diagnostics,
            journey,
            ...getWebGlDiagnostics(hostRef.current)
          })
        )
        setRunning(false)
        setStatus('Load exercise complete.')
        cancelExerciseRef.current = null
      }, vttLoadFixtureExercise.transientExpiryWaitMs)
    }

    const frame = (now: number) => {
      if (cancelled) return
      if (now < startedAt) {
        lastFrameAt = now
        requestAnimationFrame(frame)
        return
      }
      frameCount += 1
      const frameGapMs = now - lastFrameAt
      const foreground = isForeground()
      maxFrameGapMs = Math.max(maxFrameGapMs, frameGapMs)
      if (foreground && previousFrameWasForeground && !foregroundInterruptedSinceLastFrame)
        maxForegroundFrameGapMs = Math.max(maxForegroundFrameGapMs, frameGapMs)
      if (frameGapMs >= 100 && frameGapRecords.length < maxTimingTelemetryRecords) {
        frameGapRecords.push({
          durationMs: frameGapMs,
          focusState: document.hasFocus(),
          maxLongTaskMs,
          timestampMs: now - startedAt,
          updateCount,
          visibilityState: document.visibilityState
        })
      }
      if (!foreground) foregroundInterrupted = true
      previousFrameWasForeground = foreground
      foregroundInterruptedSinceLastFrame = !foreground
      lastFrameAt = now
      if (mode !== 'RAF_ONLY' && now >= nextTransientAt) {
        renderer.applyTransient({
          envelope: {
            baselineVersion: scene.version,
            audience: 'TABLE',
            kind: 'TOKEN_DRAG_PREVIEW',
            position: { x: 480 + (frameCount % 600), y: 520 + ((frameCount * 2) % 600) },
            sceneId: scene.id,
            sequence: frameCount,
            tokenId: scene.tokens[1]!.id
          },
          userId: vttLoadFixtureExercise.remoteUserId
        })
        renderer.applyTransient({
          envelope: {
            baselineVersion: scene.version,
            audience: 'TABLE',
            kind: 'PING',
            position: { x: 1_400 + ((frameCount * 3) % 1_000), y: 1_200 + (frameCount % 900) },
            sceneId: scene.id,
            sequence: frameCount
          },
          userId: vttLoadFixtureExercise.remoteUserId
        })
        renderer.applyTransient({
          envelope: {
            baselineVersion: scene.version,
            audience: 'TABLE',
            kind: 'MEASUREMENT_PREVIEW',
            path: [
              { x: 2_800, y: 2_500 },
              { x: 3_400 + (frameCount % 300), y: 2_900 + ((frameCount * 2) % 300) }
            ],
            sceneId: scene.id,
            sequence: frameCount
          },
          userId: vttLoadFixtureExercise.remoteUserId
        })
        nextTransientAt = now + vttLoadFixtureExercise.transientIntervalMs
      }

      if (mode === 'FULL' && now >= nextCommitAt) {
        updateCount += 1
        scene = moveLoadFixtureScene(scene, updateCount)
        renderer.update({
          boundTokenControl: new Map(),
          currentUserId: vttLoadFixtureUserId,
          mapDelivery: vttLoadFixtureMapDelivery,
          mode: 'PLAY',
          role: 'OWNER',
          scene,
          tool: 'SELECT'
        })
        nextCommitAt = now + commitIntervalMs
      }

      if (now - startedAt >= soakMs) {
        finish()
        return
      }
      requestAnimationFrame(frame)
    }

    requestAnimationFrame(frame)
    cancelExerciseRef.current = () => {
      cancelled = true
      observer.disconnect()
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('blur', onFocus)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [journey, running])

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    let disposed = false
    let readyFrame = 0
    void createVttSceneRenderer(host, SRD_SYSTEM_ID, {
      onCreateBarrier: () => undefined,
      onCreateDarkness: () => undefined,
      onCreateLight: () => undefined,
      onCreateToken: () => undefined,
      onDoorState: () => undefined,
      onMeasurementCommit: (path) => {
        const renderer = rendererRef.current
        if (!renderer) return
        sceneRef.current = {
          ...sceneRef.current,
          measurements: [
            ...sceneRef.current.measurements,
            {
              createdByUserId: vttLoadFixtureUserId,
              id: crypto.randomUUID(),
              label: 'Committed load-gate measurement',
              path
            }
          ],
          version: sceneRef.current.version + 1
        }
        renderer.update(ownerUpdate(sceneRef.current, 'MEASURE'))
        setJourney((current) => ({ ...current, measurementCommit: true }))
      },
      onMeasurementPreview: () => undefined,
      onPing: () => false,
      onTokenCommit: (tokenId, path) => {
        const renderer = rendererRef.current
        const position = path.at(-1)
        if (!renderer || !position) return
        sceneRef.current = {
          ...sceneRef.current,
          tokens: sceneRef.current.tokens.map((token) =>
            token.id === tokenId ? { ...token, position } : token
          ),
          version: sceneRef.current.version + 1
        }
        renderer.update(ownerUpdate(sceneRef.current, 'SELECT'))
        setJourney((current) => ({ ...current, tokenDragCommit: true }))
      },
      onTokenPreview: () => undefined
    }).then((renderer) => {
      if (disposed) {
        renderer.destroy()
        return
      }
      rendererRef.current = renderer
      renderer.update(ownerUpdate(sceneRef.current, 'SELECT'))
      const waitForMap = () => {
        const diagnostics = renderer.getDiagnostics()
        if (
          diagnostics.mapLoadComplete &&
          diagnostics.loadedMapAssetCount === vttLoadFixtureExercise.expectedMapAssetCount
        ) {
          setReady(true)
          setStatus('8K map fixture ready.')
          return
        }
        readyFrame = requestAnimationFrame(waitForMap)
      }
      readyFrame = requestAnimationFrame(waitForMap)
    })
    return () => {
      disposed = true
      cancelAnimationFrame(readyFrame)
      cancelExerciseRef.current?.()
      cancelExerciseRef.current = null
      rendererRef.current?.destroy()
      rendererRef.current = null
    }
  }, [])

  return (
    <section aria-label='VTT 8K load fixture' style={{ display: 'grid', gap: 12, padding: 16 }}>
      <div
        data-testid='vtt-load-canvas'
        ref={hostRef}
        style={{ blockSize: 720, minInlineSize: 0, overflow: 'hidden' }}
      />
      <div aria-label='VTT load interaction journey' role='group'>
        <button
          disabled={!ready || running}
          type='button'
          onClick={() => {
            const renderer = rendererRef.current
            if (!renderer) return
            renderer.fit()
            renderer.zoomIn()
            renderer.focusPoint(sceneRef.current.tokens[0]!.position)
            renderer.zoomOut()
            setJourney((current) => ({ ...current, panZoom: true }))
          }}
        >
          Exercise pan and zoom
        </button>
        <button
          disabled={!ready || running}
          type='button'
          onClick={() => {
            const renderer = rendererRef.current
            if (!renderer) return
            const patch = createSceneFogAreaPatch(sceneRef.current, {
              explored: false,
              ownerUserId: null,
              rectangle: {
                a: { x: 2_048, y: 2_048 },
                b: { x: 6_144, y: 6_144 }
              }
            })
            if (!patch) return
            sceneRef.current = applySceneDelta(
              sceneRef.current,
              { kind: 'FOG_CHUNKS_PATCHED', layer: patch },
              sceneRef.current.version + 1
            )
            const playerScene = projectSceneForViewer(
              sceneRef.current,
              {
                role: 'PLAYER',
                userId: vttLoadFixtureUserId
              },
              new Map()
            )
            renderer.update({
              ...ownerUpdate(playerScene, 'SELECT'),
              role: 'PLAYER'
            })
            setJourney((current) => ({ ...current, fogEdit: true, playerPreview: true }))
          }}
        >
          Exercise fog and player preview
        </button>
        <button
          disabled={!ready || running}
          type='button'
          onClick={() => {
            const renderer = rendererRef.current
            const token = sceneRef.current.tokens[0]
            if (!renderer || !token) return
            renderer.update(ownerUpdate(sceneRef.current, 'SELECT'))
            renderer.fit()
            for (let index = 0; index < 8; index += 1) renderer.zoomIn()
            renderer.focusPoint(token.position)
            setStatus('Token centered for the local drag check.')
          }}
        >
          Prepare local token drag
        </button>
        <button
          disabled={!ready || running}
          type='button'
          onClick={() => {
            const renderer = rendererRef.current
            if (!renderer) return
            renderer.update(ownerUpdate(sceneRef.current, 'MEASURE'))
            renderer.fit()
            setStatus('Measurement tool ready for the local commit check.')
          }}
        >
          Prepare local measurement
        </button>
      </div>
      <output aria-live='polite' data-testid='vtt-load-journey'>
        {JSON.stringify(journey)}
      </output>
      <button
        disabled={!ready || running || !journeyComplete(journey)}
        type='button'
        onClick={startExercise}
      >
        Start load exercise
      </button>
      <output aria-live='polite' data-testid='vtt-load-status'>
        {status}
      </output>
      {report ? (
        <output aria-label='VTT load report' data-testid='vtt-load-report'>
          {report}
        </output>
      ) : null}
    </section>
  )
}

function ownerUpdate(
  scene: CampaignSceneStateDto,
  tool: 'MEASURE' | 'SELECT'
): Parameters<VttSceneRenderer['update']>[0] {
  return {
    boundTokenControl: new Map(),
    currentUserId: vttLoadFixtureUserId,
    mapDelivery: vttLoadFixtureMapDelivery,
    mode: 'PLAY',
    role: 'OWNER',
    scene,
    tool
  }
}

function journeyComplete(journey: VttLoadJourney): boolean {
  return Object.values(journey).every(Boolean)
}

function getWebGlDiagnostics(host: HTMLDivElement | null): {
  webglRenderer: string | null
  webglVendor: string | null
} {
  const canvas = host?.querySelector('canvas')
  const context = canvas?.getContext('webgl2') ?? canvas?.getContext('webgl')
  if (!context) return { webglRenderer: null, webglVendor: null }
  const debugInfo = context.getExtension('WEBGL_debug_renderer_info')
  if (!debugInfo) return { webglRenderer: null, webglVendor: null }
  return {
    webglRenderer: String(context.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)),
    webglVendor: String(context.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL))
  }
}
