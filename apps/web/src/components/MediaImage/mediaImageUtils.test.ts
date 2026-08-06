import { describe, expect, it } from 'vitest'
import {
  createCenteredSquareCrop,
  maxImageBytes,
  toNormalizedCrop,
  validateImageFile
} from './mediaImageUtils'

describe('media image utilities', () => {
  it('rejects unsupported and oversized files', () => {
    expect(validateImageFile(new File(['text'], 'notes.txt', { type: 'text/plain' }))).toMatch(
      /JPEG, PNG, or WebP/
    )
    expect(
      validateImageFile(
        new File([new Uint8Array(maxImageBytes + 1)], 'large.png', { type: 'image/png' })
      )
    ).toMatch(/smaller than 6 MB/)
  })

  it('centers a square crop and normalizes percent coordinates', () => {
    expect(createCenteredSquareCrop(1200, 800)).toEqual({
      x: 1 / 6,
      y: 0,
      width: 2 / 3,
      height: 1
    })
    expect(toNormalizedCrop({ unit: '%', x: 25, y: 10, width: 50, height: 50 })).toEqual({
      x: 0.25,
      y: 0.1,
      width: 0.5,
      height: 0.5
    })
  })
})
