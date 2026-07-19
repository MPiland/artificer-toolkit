import { describe, expect, it } from 'vitest'
import { foundationVars } from '../../css/foundations.css'
import {
  resolveActionAppearance,
  resolveAuthoringSurfaceStyle,
  resolveAuthoringTextStyle
} from './authoringPresentationAdapter'

describe('authoring presentation adapter', () => {
  it('uses complete compact and wide semantic overrides', () => {
    expect(
      resolveAuthoringTextStyle(
        {
          default: { style: 'heading', tone: 'primary' },
          compact: { style: 'label', tone: 'accent' }
        },
        'compact'
      )
    ).toMatchObject({
      color: foundationVars.color.text.accent,
      fontWeight: foundationVars.typography.label.fontWeight
    })

    expect(
      resolveAuthoringSurfaceStyle(
        {
          default: { role: 'panel' },
          wide: { role: 'raised' }
        },
        'wide'
      )
    ).toMatchObject({
      backgroundColor: foundationVars.color.surface.raised,
      borderRadius: foundationVars.radius.lg
    })
  })

  it('falls back to the default recipe in regular contexts', () => {
    expect(
      resolveAuthoringSurfaceStyle({ default: { role: 'recessed' } }, 'regular')
    ).toMatchObject({ backgroundColor: foundationVars.color.surface.recessed })
  })

  it('resolves complete action recipes for compact, regular, and wide contexts', () => {
    const presentation = {
      default: {
        display: 'text',
        emphasis: 'quiet',
        width: 'content',
        density: 'compact'
      },
      compact: {
        display: 'button',
        emphasis: 'primary',
        width: 'full',
        density: 'comfortable'
      },
      wide: {
        display: 'icon',
        emphasis: 'secondary',
        width: 'content',
        density: 'compact'
      }
    } as const

    expect(resolveActionAppearance(presentation, 'compact')).toEqual(presentation.compact)
    expect(resolveActionAppearance(presentation, 'regular')).toEqual(presentation.default)
    expect(resolveActionAppearance(presentation, 'wide')).toEqual(presentation.wide)
  })
})
