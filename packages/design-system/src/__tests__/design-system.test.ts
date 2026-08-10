import { describe, expect, it } from 'vitest'

import {
  actionAppearancePresets,
  actionDisplay,
  actionEmphasis,
  actionPresentationPresets,
  actionWidth,
  breakpoints,
  controlDensity,
  darkColorTokens,
  fontWeightScale,
  radiusScale,
  lightColorTokens,
  semanticSurfaceRoles,
  semanticTextStyles,
  semanticTextTones,
  spacingScale,
  motionScale,
  typographyScale
} from '../index.js'

describe('design-system semantic tuples', () => {
  it('keeps runtime semantic values unique', () => {
    const unique = <T>(items: readonly T[]): boolean => new Set(items).size === items.length

    expect(unique(actionDisplay)).toBe(true)
    expect(unique(actionEmphasis)).toBe(true)
    expect(unique(actionWidth)).toBe(true)
    expect(unique(controlDensity)).toBe(true)
    expect(unique(semanticTextStyles)).toBe(true)
    expect(unique(semanticTextTones)).toBe(true)
    expect(unique(semanticSurfaceRoles)).toBe(true)
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
    expect(
      Object.values(typographyScale).every((value) => typeof value.fontSize === 'number')
    ).toBe(true)
  })

  it('keeps portable primitive keys aligned to web foundation contracts', () => {
    expect(Object.keys(spacingScale).map(Number)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 13, 14
    ])
    expect(Object.keys(radiusScale)).toEqual(['sm', 'md', 'lg', 'xl', 'xxl', 'pill'])
    expect(Object.keys(typographyScale)).toEqual([
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

  it('keeps light primary actions filled and dark primary actions outlined', () => {
    expect(lightColorTokens.color.button.primary).toMatchObject({
      background: '#ec8c06',
      text: '#241002'
    })
    expect(darkColorTokens.color.button.primary).toEqual({
      background: 'transparent',
      border: '#ec8c06',
      hover: 'rgba(236, 106, 6, 0.18)',
      active: '#262a2f',
      text: '#ffb690'
    })
    expect(darkColorTokens.color.button.secondary.background).toBe('#121517')
    expect(darkColorTokens.color.status.danger).toBe('#e8795f')
  })

  it('builds global dark surfaces from the same Black Forge scale as authoring', () => {
    expect(darkColorTokens.color.surface).toMatchObject({
      canvas: '#101315',
      panel: '#171a1d',
      sidebar: '#121517',
      header: '#07090b'
    })
    expect(darkColorTokens.color.authoring).toMatchObject({
      canvas: '#101315',
      panel: '#171a1d',
      rail: '#121517'
    })
    expect(darkColorTokens.color.border).toEqual({
      subtle: 'rgba(255, 255, 255, 0.07)',
      strong: '#343a40'
    })
  })

  it('exports shared authoring workspace roles for both themes', () => {
    expect(lightColorTokens.color.authoring).toMatchObject({
      band: '#ffffff',
      border: '#dfe4ea',
      dock: '#ffffff',
      field: '#ffffff',
      fieldBorder: '#b5b9c6',
      header: '#ffffff',
      notice: '#fff8e8',
      preview: '#fffaf1',
      previewBorder: '#d6b67a'
    })
    expect(darkColorTokens.color.authoring).toMatchObject({
      band: '#101214',
      border: 'rgba(255, 255, 255, 0.07)',
      canvas: '#101315',
      dock: '#171a1d',
      field: '#101315',
      fieldBorder: '#343a40',
      header: '#101214',
      notice: '#191917',
      panel: '#171a1d',
      preview: '#15181a',
      previewBorder: 'rgba(214, 182, 122, 0.16)'
    })
  })
})
