import {
  isDirectedAreaShape,
  type ScenePoint,
  type SpatialTokenFootprint
} from '@artificer-toolkit/shared/vtt'
import {
  directedAreaAim,
  drawnAreaAim,
  isDrawnAreaSize,
  pickedSquare,
  type VttAreaAim,
  type VttAreaSize,
  type VttSquarePick
} from './vttSceneRenderer.model'

interface VttAreaAimGesture {
  /** A primary press on the map; true when the aim consumed it. */
  press: (point: ScenePoint) => boolean
  /** A release; true when it ended a press that began a directed or drawn aim, even if the rules refuse it. */
  release: (point: ScenePoint) => boolean
  /** What the pointer aims at now, for the preview; null when the rules would refuse that aim. */
  aimAt: (pointer: ScenePoint) => VttAreaAim | null
  /** Drops a press without committing, such as on Escape. */
  cancel: () => void
}

/**
 * The press, drag and release that aim an area on the map. A point area is picked on the press. A
 * directed area starts at the edge of the caster's footprint nearest the press and extends toward
 * the release, and is committed only when the rules would accept that origin and direction. A
 * wall or ring (D154) is drawn from the press, its first endpoint or center, to the release. A
 * forced movement's destination (D157) is picked on the press too, but only inside a legal square,
 * which the pick snaps to.
 */
export function createVttAreaAimGesture(
  /**
   * The area being aimed and its caster's footprint (null when the caster is not on the map), or
   * the legal squares being picked from.
   */
  aiming: () =>
    | { caster: SpatialTokenFootprint | null; size: VttAreaSize }
    | { squares: VttSquarePick }
    | null,
  callbacks: {
    onPoint?: (point: ScenePoint) => void
    onDirection?: (aim: { origin: ScenePoint; toward: ScenePoint }) => void
    onSquare?: (center: ScenePoint) => void
  }
): VttAreaAimGesture {
  let pressedAt: ScenePoint | null = null
  const aimAt: VttAreaAimGesture['aimAt'] = (pointer) => {
    const aim = aiming()
    if (!aim || 'squares' in aim) return null
    if (isDrawnAreaSize(aim.size))
      return pressedAt
        ? drawnAreaAim({ pointer, pressedAt, size: aim.size })
        : { origin: pointer, toward: null }
    if (!isDirectedAreaShape(aim.size)) return { origin: pointer, toward: null }
    return aim.caster
      ? directedAreaAim({ caster: aim.caster, pointer, pressedAt, size: aim.size })
      : null
  }
  return {
    press(point) {
      const aim = aiming()
      if (!aim) return false
      if ('squares' in aim) {
        const square = pickedSquare(aim.squares, point)
        if (square) callbacks.onSquare?.(square)
      } else if (isDrawnAreaSize(aim.size) || isDirectedAreaShape(aim.size)) pressedAt = point
      else callbacks.onPoint?.(point)
      return true
    },
    release(point) {
      if (!pressedAt) return false
      const aimed = aimAt(point)
      pressedAt = null
      if (aimed?.toward) callbacks.onDirection?.({ origin: aimed.origin, toward: aimed.toward })
      return true
    },
    aimAt,
    cancel() {
      pressedAt = null
    }
  }
}
