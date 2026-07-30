import { describe, expect, it } from 'vitest'

import {
  actionAppearancePresets,
  actionDisplay,
  actionEmphasis,
  actionPresentationPresets,
  actionWidth,
  blackForgeSurfaceScale,
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
    expect(
      Object.values(typographyScale).every((value) => typeof value.fontSize === 'number')
    ).toBe(true)
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

  it('keeps light primary actions filled and dark primary actions outlined', () => {
    expect(lightColorTokens.color.button.primary).toMatchObject({
      background: '#ec8c06',
      text: '#241002'
    })
    expect(darkColorTokens.color.button.primary).toEqual({
      background: 'transparent',
      border: '#ec8c06',
      hover: 'rgba(236, 106, 6, 0.18)',
      active: blackForgeSurfaceScale.raised,
      text: '#ffb690'
    })
    expect(darkColorTokens.color.button.secondary.background).toBe(blackForgeSurfaceScale.rail)
    expect(darkColorTokens.color.status.danger).toBe('#e8795f')
  })

  it('builds global dark surfaces from the same Black Forge scale as authoring', () => {
    expect(darkColorTokens.color.surface).toMatchObject({
      canvas: blackForgeSurfaceScale.canvas,
      panel: blackForgeSurfaceScale.panel,
      sidebar: blackForgeSurfaceScale.rail,
      header: blackForgeSurfaceScale.header
    })
    expect(darkColorTokens.color.authoring).toMatchObject({
      canvas: blackForgeSurfaceScale.canvas,
      panel: blackForgeSurfaceScale.panel,
      rail: blackForgeSurfaceScale.rail
    })
    expect(darkColorTokens.color.border).toEqual({
      subtle: blackForgeSurfaceScale.structuralBorder,
      strong: blackForgeSurfaceScale.fieldBorder
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
