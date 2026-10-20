import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { maximumVttZoomScale, minimumVttZoomScale } from './vttSceneRenderer.model'
import {
  clampVttZoomScale,
  formatVttZoomPercent,
  parseVttZoomPercent,
  readStoredVttZoom,
  stepVttZoomScale,
  vttZoomStorageKey,
  writeStoredVttZoom
} from './vttZoom.model'

describe('typed zoom percentages', () => {
  it('reads a number with or without a percent sign as a scale', () => {
    expect(parseVttZoomPercent('150')).toBe(1.5)
    expect(parseVttZoomPercent(' 150 % ')).toBe(1.5)
    expect(parseVttZoomPercent('62.5%')).toBeCloseTo(0.625, 12)
  })

  it('clamps typed values to the zoom range', () => {
    expect(parseVttZoomPercent('1')).toBe(minimumVttZoomScale)
    expect(parseVttZoomPercent('99999')).toBe(maximumVttZoomScale)
  })

  it('rejects text that is not a positive number', () => {
    for (const text of ['', 'abc', '-50', '0', '1e3', '12px', '1,5']) {
      expect(parseVttZoomPercent(text)).toBeNull()
    }
  })

  it('formats a scale as a whole percentage', () => {
    expect(formatVttZoomPercent(1.5)).toBe('150%')
    expect(formatVttZoomPercent(0.3333)).toBe('33%')
    expect(formatVttZoomPercent(clampVttZoomScale(100))).toBe('800%')
  })
})

describe('zoom steps', () => {
  it('moves to the next stop beyond the current zoom', () => {
    expect(stepVttZoomScale(1, 'IN')).toBeCloseTo(1.1, 12)
    expect(stepVttZoomScale(1, 'OUT')).toBeCloseTo(0.9, 12)
  })

  it('snaps an off-stop zoom to the neighbouring stop in each direction', () => {
    expect(stepVttZoomScale(1.03, 'IN')).toBeCloseTo(1.1, 12)
    expect(stepVttZoomScale(1.03, 'OUT')).toBe(1)
  })

  it('stays at the ends of the range', () => {
    expect(stepVttZoomScale(maximumVttZoomScale, 'IN')).toBe(maximumVttZoomScale)
    expect(stepVttZoomScale(minimumVttZoomScale, 'OUT')).toBe(minimumVttZoomScale)
  })

  it('reaches every stop from the bottom to the top and back', () => {
    let scale = minimumVttZoomScale
    const seen = [scale]
    for (let guard = 0; guard < 100; guard += 1) {
      const next = stepVttZoomScale(scale, 'IN')
      if (next === scale) break
      seen.push(next)
      scale = next
    }
    expect(scale).toBe(maximumVttZoomScale)
    expect(seen).toEqual([...seen].sort((a, b) => a - b))
    for (let guard = 0; guard < 100 && scale > minimumVttZoomScale; guard += 1) {
      scale = stepVttZoomScale(scale, 'OUT')
    }
    expect(scale).toBe(minimumVttZoomScale)
  })
})

describe('per-device zoom storage', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => vi.restoreAllMocks())

  it('keys the zoom by Campaign and Scene', () => {
    expect(vttZoomStorageKey('c1', 's1')).not.toBe(vttZoomStorageKey('c1', 's2'))
    expect(vttZoomStorageKey('c1', 's1')).not.toBe(vttZoomStorageKey('c2', 's1'))
  })

  it('reads back what was written', () => {
    const key = vttZoomStorageKey('c1', 's1')
    expect(readStoredVttZoom(key)).toBeNull()
    writeStoredVttZoom(key, 1.25)
    expect(readStoredVttZoom(key)).toBe(1.25)
  })

  it('ignores a corrupt or out-of-range stored value', () => {
    const key = vttZoomStorageKey('c1', 's1')
    localStorage.setItem(key, 'banana')
    expect(readStoredVttZoom(key)).toBeNull()
    localStorage.setItem(key, '-3')
    expect(readStoredVttZoom(key)).toBeNull()
    localStorage.setItem(key, '500')
    expect(readStoredVttZoom(key)).toBe(maximumVttZoomScale)
  })

  it('degrades safely when storage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError')
    })
    expect(readStoredVttZoom('any')).toBeNull()
    expect(() => writeStoredVttZoom('any', 2)).not.toThrow()
  })
})
