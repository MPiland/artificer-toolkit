import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createVttPingPress,
  isVttPingKey,
  vttPingHoldMs,
  vttPingLifetimeMs,
  vttPingMoveTolerancePx,
  vttPingRingFrame
} from './vttPing'

const mapPoint = { x: 400, y: 300 }

describe('tabletop ping', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('sends exactly one ping for a long press, however long it is held', () => {
    const onPing = vi.fn()
    const press = createVttPingPress(onPing)

    press.start({ x: 10, y: 10 }, mapPoint)
    vi.advanceTimersByTime(vttPingHoldMs - 1)
    expect(onPing).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(onPing).toHaveBeenCalledExactlyOnceWith(mapPoint)

    vi.advanceTimersByTime(vttPingHoldMs * 4)
    press.move({ x: 11, y: 10 })
    press.end()
    expect(onPing).toHaveBeenCalledOnce()
  })

  it('keeps a long press through touch jitter within the tolerance', () => {
    const onPing = vi.fn()
    const press = createVttPingPress(onPing)

    press.start({ x: 10, y: 10 }, mapPoint)
    press.move({ x: 10 + vttPingMoveTolerancePx, y: 10 })
    vi.advanceTimersByTime(vttPingHoldMs)
    expect(onPing).toHaveBeenCalledExactlyOnceWith(mapPoint)
  })

  it('sends no ping for a short press or a drag', () => {
    const onPing = vi.fn()
    const press = createVttPingPress(onPing)

    press.start({ x: 10, y: 10 }, mapPoint)
    vi.advanceTimersByTime(vttPingHoldMs - 100)
    press.end()
    press.start({ x: 10, y: 10 }, mapPoint)
    press.move({ x: 10 + vttPingMoveTolerancePx + 1, y: 10 })
    vi.advanceTimersByTime(vttPingHoldMs * 2)
    expect(onPing).not.toHaveBeenCalled()
  })

  it('pings from the keyboard with P, but not with a command modifier or auto-repeat', () => {
    const key = { altKey: false, ctrlKey: false, key: 'p', metaKey: false, repeat: false }
    expect(isVttPingKey(key)).toBe(true)
    expect(isVttPingKey({ ...key, key: 'P' })).toBe(true)
    expect(isVttPingKey({ ...key, ctrlKey: true })).toBe(false)
    expect(isVttPingKey({ ...key, metaKey: true })).toBe(false)
    expect(isVttPingKey({ ...key, altKey: true })).toBe(false)
    expect(isVttPingKey({ ...key, repeat: true })).toBe(false)
    expect(isVttPingKey({ ...key, key: 'o' })).toBe(false)
  })

  it('renders a ring that grows and fades over its lifetime, and only fades with reduced motion', () => {
    const start = vttPingRingFrame(0, false)
    const middle = vttPingRingFrame(vttPingLifetimeMs / 2, false)
    expect(start).toEqual({ alpha: 1, radius: 10 })
    expect(middle!.radius).toBeGreaterThan(start!.radius)
    expect(middle!.alpha).toBeLessThan(1)
    expect(vttPingRingFrame(vttPingLifetimeMs, false)).toBeNull()

    expect(vttPingRingFrame(0, true)?.radius).toBe(vttPingRingFrame(1_000, true)?.radius)
    expect(vttPingRingFrame(1_000, true)!.alpha).toBeLessThan(1)
    expect(vttPingRingFrame(vttPingLifetimeMs, true)).toBeNull()
  })
})
