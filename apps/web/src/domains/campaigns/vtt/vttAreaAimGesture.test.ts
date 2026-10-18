import { describe, expect, it, vi } from 'vitest'
import type { SpatialDirectedAreaSize } from '@artificer-toolkit/shared/vtt'
import { createVttAreaAimGesture } from './vttAreaAimGesture'
import type { VttAreaSize } from './vttSceneRenderer.model'

const cell = 100
/** One square at (500, 500): its east edge is x = 550, its north edge y = 450. */
const caster = { id: 'caster', position: { x: 500, y: 500 }, width: cell, height: cell }
const cone: SpatialDirectedAreaSize = { kind: 'CONE', length: 3 * cell }
const line: SpatialDirectedAreaSize = { kind: 'LINE', length: 6 * cell, width: cell }
const cube: SpatialDirectedAreaSize = {
  kind: 'CUBE_FROM_SIDE',
  edgeLength: 3 * cell,
  cellSize: cell,
  gridOrigin: { x: 0, y: 0 }
}

function gestureFor(size: VttAreaSize) {
  const onPoint = vi.fn()
  const onDirection = vi.fn()
  const gesture = createVttAreaAimGesture(() => ({ caster, size }), { onPoint, onDirection })
  return { gesture, onDirection, onPoint }
}

describe('aiming an area on the map', () => {
  it.each([
    ['a cone', cone],
    ['a line', line],
    ['a Self cube', cube]
  ] as const)(
    'commits %s from the edge where the press began toward where it was released',
    (_name, size) => {
      const { gesture, onDirection, onPoint } = gestureFor(size)
      expect(gesture.press({ x: 600, y: 520 })).toBe(true)
      expect(onDirection).not.toHaveBeenCalled()
      expect(gesture.release({ x: 800, y: 560 })).toBe(true)
      expect(onDirection).toHaveBeenCalledExactlyOnceWith({
        origin: { x: 550, y: 520 },
        toward: { x: 800, y: 560 }
      })
      expect(onPoint).not.toHaveBeenCalled()
    }
  )

  it('keeps the origin where the press began while the pointer moves around the caster', () => {
    const { gesture } = gestureFor(cone)
    gesture.press({ x: 600, y: 520 })
    expect(gesture.aimAt({ x: 700, y: 200 })).toEqual({
      origin: { x: 550, y: 520 },
      toward: { x: 700, y: 200 }
    })
  })

  it('previews the origin nearest the pointer before any press', () => {
    const { gesture } = gestureFor(cone)
    expect(gesture.aimAt({ x: 900, y: 520 })).toEqual({
      origin: { x: 550, y: 520 },
      toward: { x: 900, y: 520 }
    })
  })

  it('commits a point area on the press, with no direction', () => {
    const { gesture, onDirection, onPoint } = gestureFor({ kind: 'RADIUS', radius: 4 * cell })
    expect(gesture.press({ x: 900, y: 300 })).toBe(true)
    expect(onPoint).toHaveBeenCalledExactlyOnceWith({ x: 900, y: 300 })
    expect(gesture.release({ x: 910, y: 310 })).toBe(false)
    expect(onDirection).not.toHaveBeenCalled()
  })

  it('previews a point area at the pointer with no direction', () => {
    const { gesture } = gestureFor({ kind: 'CUBE', edgeLength: 3 * cell })
    expect(gesture.aimAt({ x: 700, y: 500 })).toEqual({ origin: { x: 700, y: 500 }, toward: null })
  })

  it('commits a wall drawn from the press to the release, pulled in to its longest length', () => {
    const { gesture, onDirection, onPoint } = gestureFor({
      kind: 'WALL',
      maximum: 12 * cell,
      thickness: 20
    })
    expect(gesture.aimAt({ x: 900, y: 300 })).toEqual({ origin: { x: 900, y: 300 }, toward: null })
    expect(gesture.press({ x: 0, y: 0 })).toBe(true)
    expect(gesture.aimAt({ x: 300, y: 400 })).toEqual({
      origin: { x: 0, y: 0 },
      toward: { x: 300, y: 400 }
    })
    expect(gesture.release({ x: 3000, y: 4000 })).toBe(true)
    expect(onDirection).toHaveBeenCalledExactlyOnceWith({
      origin: { x: 0, y: 0 },
      toward: { x: 720, y: 960 }
    })
    expect(onPoint).not.toHaveBeenCalled()
  })

  it('commits a ring around the press out to the release, and nothing for one no wider than its wall', () => {
    const { gesture, onDirection } = gestureFor({ kind: 'RING', maximum: 2 * cell, thickness: 20 })
    gesture.press({ x: 500, y: 500 })
    gesture.release({ x: 510, y: 500 })
    expect(onDirection).not.toHaveBeenCalled()
    gesture.press({ x: 500, y: 500 })
    gesture.release({ x: 650, y: 500 })
    expect(onDirection).toHaveBeenCalledExactlyOnceWith({
      origin: { x: 500, y: 500 },
      toward: { x: 650, y: 500 }
    })
  })

  it('commits nothing for a release the rules would refuse, and ends the press', () => {
    const { gesture, onDirection } = gestureFor(cone)
    // Pressed on the east edge and released straight along it.
    gesture.press({ x: 550, y: 500 })
    expect(gesture.release({ x: 550, y: 100 })).toBe(true)
    expect(onDirection).not.toHaveBeenCalled()
    expect(gesture.release({ x: 800, y: 500 })).toBe(false)
  })

  it('commits nothing for a Self cube released off the side it was pressed on', () => {
    const { gesture, onDirection } = gestureFor(cube)
    gesture.press({ x: 550, y: 500 })
    gesture.release({ x: 700, y: 100 })
    expect(onDirection).not.toHaveBeenCalled()
  })

  it('drops a press on cancel, so the next release commits nothing', () => {
    const { gesture, onDirection } = gestureFor(cone)
    gesture.press({ x: 600, y: 520 })
    gesture.cancel()
    expect(gesture.release({ x: 800, y: 560 })).toBe(false)
    expect(onDirection).not.toHaveBeenCalled()
  })

  it('leaves a press alone when no area is being aimed', () => {
    const onPoint = vi.fn()
    const onDirection = vi.fn()
    const gesture = createVttAreaAimGesture(() => null, { onPoint, onDirection })
    expect(gesture.press({ x: 600, y: 520 })).toBe(false)
    expect(gesture.release({ x: 800, y: 560 })).toBe(false)
    expect(gesture.aimAt({ x: 800, y: 560 })).toBeNull()
    expect(onPoint).not.toHaveBeenCalled()
    expect(onDirection).not.toHaveBeenCalled()
  })

  it('previews and commits nothing for a directed area whose caster is not on the map', () => {
    const onDirection = vi.fn()
    const gesture = createVttAreaAimGesture(() => ({ caster: null, size: cone }), { onDirection })
    gesture.press({ x: 600, y: 520 })
    expect(gesture.aimAt({ x: 800, y: 560 })).toBeNull()
    gesture.release({ x: 800, y: 560 })
    expect(onDirection).not.toHaveBeenCalled()
  })
})
