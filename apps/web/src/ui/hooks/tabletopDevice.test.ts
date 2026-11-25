import { describe, expect, it } from 'vitest'

import { classifyTabletopDevice } from './tabletopDevice'

const classify = (screenWidth: number, screenHeight: number, viewportWidth: number) =>
  classifyTabletopDevice({ screenHeight, screenWidth, viewportWidth })

describe('classifyTabletopDevice', () => {
  it('treats a phone as unsupported in either orientation', () => {
    expect(classify(390, 844, 390)).toBe('unsupported')
    expect(classify(844, 390, 844)).toBe('unsupported')
  })

  it('treats a small tablet whose longer side is under 1024 as unsupported', () => {
    expect(classify(768, 1023, 768)).toBe('unsupported')
    expect(classify(1023, 768, 1023)).toBe('unsupported')
  })

  it('treats a screen whose longer side is exactly 1024 as capable', () => {
    expect(classify(1024, 768, 1024)).toBe('ready')
    expect(classify(768, 1024, 768)).toBe('too-narrow')
  })

  it('covers a large tablet in portrait and a narrowed desktop window', () => {
    expect(classify(1024, 1366, 1024)).toBe('ready')
    expect(classify(1024, 1366, 1023)).toBe('too-narrow')
    expect(classify(1920, 1080, 800)).toBe('too-narrow')
  })

  it('shows the tabletop at any wide window on a capable screen', () => {
    expect(classify(1920, 1080, 1920)).toBe('ready')
    expect(classify(1366, 1024, 1366)).toBe('ready')
  })
})
