import type { ScenePoint } from '@artificer-toolkit/shared/vtt'

/** A press held this long without moving pings the map (Q19). */
export const vttPingHoldMs = 500
/** Screen pixels a held press may drift, such as a finger's jitter, and still ping. */
export const vttPingMoveTolerancePx = 8
/** How long a ping ring shows. */
export const vttPingLifetimeMs = 1_500

export interface VttPingPress {
  /** Starts a press at a screen point; the ping lands on `mapPoint`. */
  start: (screenPoint: ScenePoint, mapPoint: ScenePoint) => void
  /** Cancels the press once the pointer drifts past the tolerance. */
  move: (screenPoint: ScenePoint) => void
  /** Ends the press on release or when another gesture takes over. */
  end: () => void
}

/** Detects long presses: each press held for `vttPingHoldMs` in place sends exactly one ping. */
export function createVttPingPress(onPing: (mapPoint: ScenePoint) => void): VttPingPress {
  let press: { screenPoint: ScenePoint; timer: ReturnType<typeof setTimeout> } | null = null
  const end = () => {
    if (press) clearTimeout(press.timer)
    press = null
  }
  return {
    start(screenPoint, mapPoint) {
      end()
      press = {
        screenPoint,
        timer: setTimeout(() => {
          press = null
          onPing(mapPoint)
        }, vttPingHoldMs)
      }
    },
    move(screenPoint) {
      if (
        press &&
        Math.hypot(screenPoint.x - press.screenPoint.x, screenPoint.y - press.screenPoint.y) >
          vttPingMoveTolerancePx
      )
        end()
    },
    end
  }
}

/** Whether a key press asks to ping: P, without a command modifier or auto-repeat. */
export function isVttPingKey(
  event: Pick<KeyboardEvent, 'altKey' | 'ctrlKey' | 'key' | 'metaKey' | 'repeat'>
): boolean {
  return (
    event.key.toLowerCase() === 'p' &&
    !event.altKey &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.repeat
  )
}

/**
 * The ping ring `elapsedMs` into its lifetime, in screen pixels, or null once it has faded. The ring
 * eases outwards while it fades; with reduced motion it holds its size and only fades.
 */
export function vttPingRingFrame(
  elapsedMs: number,
  reducedMotion: boolean
): { alpha: number; radius: number } | null {
  if (elapsedMs >= vttPingLifetimeMs) return null
  const progress = Math.max(0, elapsedMs) / vttPingLifetimeMs
  return {
    alpha: 1 - progress ** 2,
    radius: reducedMotion ? 28 : 10 + 30 * (1 - (1 - progress) ** 3)
  }
}
