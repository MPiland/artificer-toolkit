import { maximumVttZoomScale, minimumVttZoomScale } from './vttSceneRenderer.model'

/** The percentages the zoom steps move through, like a browser's zoom; typing allows any value in range. */
const zoomStepPercents = [
  2, 5, 10, 25, 33, 50, 67, 75, 80, 90, 100, 110, 125, 150, 175, 200, 250, 300, 400, 500, 600, 800
]

const zoomStorageKeyPrefix = 'artificer:tabletop-zoom'

export function clampVttZoomScale(scale: number): number {
  return Math.min(maximumVttZoomScale, Math.max(minimumVttZoomScale, scale))
}

export function formatVttZoomPercent(scale: number): string {
  return `${Math.round(scale * 100)}%`
}

/** Reads a typed percentage ("150", "150%") as a zoom scale clamped to the range; null when it is not a number. */
export function parseVttZoomPercent(text: string): number | null {
  const match = /^\s*(\d+(?:\.\d+)?)\s*%?\s*$/.exec(text)
  if (!match) return null
  const percent = Number(match[1])
  return percent > 0 ? clampVttZoomScale(percent / 100) : null
}

/** The next step stop beyond the current zoom in the given direction; the ends stay put. */
export function stepVttZoomScale(scale: number, direction: 'IN' | 'OUT'): number {
  const percent = scale * 100
  const epsilon = 0.01
  const stop =
    direction === 'IN'
      ? zoomStepPercents.find((candidate) => candidate > percent + epsilon)
      : zoomStepPercents.filter((candidate) => candidate < percent - epsilon).at(-1)
  return clampVttZoomScale((stop ?? percent) / 100)
}

export function vttZoomStorageKey(campaignId: string, sceneId: string): string {
  return `${zoomStorageKeyPrefix}:${campaignId}:${sceneId}`
}

/** The zoom this device saved for the scene, or null when none is saved or storage is unavailable. */
export function readStoredVttZoom(key: string): number | null {
  try {
    const value = Number(globalThis.localStorage.getItem(key))
    return Number.isFinite(value) && value > 0 ? clampVttZoomScale(value) : null
  } catch {
    return null
  }
}

export function writeStoredVttZoom(key: string, scale: number): void {
  try {
    globalThis.localStorage.setItem(key, String(scale))
  } catch {
    // Storage can be blocked or full; the zoom then lasts only for this window.
  }
}
