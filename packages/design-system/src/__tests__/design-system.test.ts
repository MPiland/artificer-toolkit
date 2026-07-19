import { describe, expect, it } from 'vitest'

import {
  actionAppearancePresets,
  actionDisplay,
  actionEmphasis,
  actionPresentationPresets,
  actionWidth,
  breakpoints,
  breakpointsKeys,
  darkColorTokens,
  fontWeightScale,
  radiusScale,
  radiusScaleKeys,
  lightColorTokens,
  presentationContexts,
  semanticSurfaceRoles,
  semanticTextStyles,
  semanticTextTones,
  semanticVisualRoles,
  spacingScale,
  spacingScaleKeys,
  motionScale,
  typographyScale,
  typographyScaleKeys
} from '../index.js'

describe('design-system primitive tuples', () => {
  it('keeps primitive key lists and primitive role tuples unique', () => {
    const unique = <T>(items: readonly T[]): boolean => new Set(items).size === items.length

    expect(unique(spacingScaleKeys)).toBe(true)
    expect(unique(radiusScaleKeys)).toBe(true)
    expect(unique(typographyScaleKeys)).toBe(true)
    expect(unique(breakpointsKeys)).toBe(true)
    expect(unique(actionDisplay)).toBe(true)
    expect(unique(actionEmphasis)).toBe(true)
    expect(unique(actionWidth)).toBe(true)
    expect(unique(presentationContexts)).toBe(true)
    expect(unique(semanticTextStyles)).toBe(true)
    expect(unique(semanticTextTones)).toBe(true)
    expect(unique(semanticSurfaceRoles)).toBe(true)
    expect(unique(semanticVisualRoles)).toBe(true)
  })

  it('provides complete portable appearances for every common action preset', () => {
    expect(Object.keys(actionPresentationPresets)).toEqual(['icon', 'text', 'button'])
    expect(actionAppearancePresets.primaryButton.emphasis).toBe('primary')
  })
})

describe('portable primitive values', () => {
  it('keeps numeric scales unitless for platform adapters', () => {
    expect(Object.values(spacingScale).every((value) => typeof value === 'number')).toBe(true)
    expect(Object.values(radiusScale).every((value) => typeof value === 'number')).toBe(true)
    expect(Object.values(breakpoints).every((value) => typeof value === 'number')).toBe(true)
    expect(Object.values(motionScale).every((value) => typeof value === 'number')).toBe(true)
    expect(Object.values(typographyScale).every((value) => typeof value.fontSize === 'number')).toBe(
      true
    )
  })

  it('keeps portable primitive keys aligned to web foundation contracts', () => {
    expect(spacingScaleKeys).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 13, 14])
    expect(radiusScaleKeys).toEqual(['sm', 'md', 'lg', 'xl', 'xxl', 'pill'])
    expect(typographyScaleKeys).toEqual([
      'display',
      'title',
      'heading',
      'body',
      'bodySm',
      'label',
      'caption'
    ])
    expect(Object.keys(fontWeightScale)).toEqual(['regular', 'medium', 'semibold', 'bold', 'heavy'])
    expect(Object.keys(breakpoints)).toEqual(['tablet', 'tabletPortrait', 'mobile'])
    expect(Object.keys(motionScale)).toEqual(['fast', 'base', 'slow'])
  })
})

describe('semantic color tokens', () => {
  it('exports complete light and dark color token roots', () => {
    expect(lightColorTokens.color).toBeDefined()
    expect(darkColorTokens.color).toBeDefined()
  })
})
