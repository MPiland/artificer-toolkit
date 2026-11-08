import type { ScenePoint } from '@artificer-toolkit/shared/vtt'
import { CLIENT_PERFORMANCE_MEASURE } from '#app/lib/clientPerformanceMeasures'

type RenderedPreview = {
  target: ScenePoint
  tokenId: string
  sequence: number
  renderedSequence: number | null
}

/**
 * Performance entries recorded once Pixi submits a frame, so browser proofs observe its paint: a mark
 * per remote token preview sequence, and each scene redraw's latency from its update to that frame
 * (PERF-6.3). Both are cleared as they are recorded, so a long session keeps no entries and only a
 * PerformanceObserver sees them.
 */
export function createVttFrameEntries(
  previews: ReadonlyMap<string, RenderedPreview>,
  sceneId: () => string | undefined
) {
  let redrawStartedAt: number | null = null
  return {
    /** A redraw's start; redraws before one frame share it, so the measure covers the first. */
    redrawStarted(startedAt: number): void {
      redrawStartedAt ??= startedAt
    },
    frameRendered(): void {
      for (const preview of previews.values()) {
        if (preview.renderedSequence === preview.sequence) continue
        preview.renderedSequence = preview.sequence
        performance.mark('artificer:vtt-token-preview-rendered', {
          detail: {
            sceneId: sceneId(),
            tokenId: preview.tokenId,
            sequence: preview.sequence,
            position: preview.target
          }
        })
        performance.clearMarks('artificer:vtt-token-preview-rendered')
      }
      if (redrawStartedAt === null) return
      performance.measure(CLIENT_PERFORMANCE_MEASURE.VTT_SCENE_RENDER, { start: redrawStartedAt })
      performance.clearMeasures(CLIENT_PERFORMANCE_MEASURE.VTT_SCENE_RENDER)
      redrawStartedAt = null
    }
  }
}
