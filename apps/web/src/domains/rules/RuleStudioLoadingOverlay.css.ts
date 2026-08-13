import { style } from '@vanilla-extract/css'
import { foundationVars } from '../../css/foundations.css'
import { app } from '../../css/layers.css'

export const overlay = style({
  '@layer': {
    [app]: {
      inset: 0,
      zIndex: 10,
      display: 'grid',
      placeItems: 'center',
      padding: foundationVars.space[4],
      backgroundColor: `color-mix(in srgb, ${foundationVars.color.surface.canvas} 76%, transparent)`,
      backdropFilter: 'blur(2px)'
    }
  }
})

export const viewport = style({
  '@layer': {
    [app]: {
      position: 'fixed',
      zIndex: 900
    }
  }
})

export const contained = style({
  '@layer': {
    [app]: {
      position: 'absolute'
    }
  }
})

export const panel = style({
  '@layer': {
    [app]: {
      display: 'grid',
      justifyItems: 'center',
      gap: foundationVars.space[3],
      inlineSize: 'min(18rem, 100%)',
      padding: `${foundationVars.space[5]} ${foundationVars.space[4]}`,
      border: `1px solid ${foundationVars.color.border.subtle}`,
      borderRadius: foundationVars.radius.xl,
      backgroundColor: foundationVars.color.surface.panel,
      boxShadow: foundationVars.shadow.floatingControl
    }
  }
})

export const copy = style({
  '@layer': {
    [app]: {
      margin: 0,
      color: foundationVars.color.text.primary,
      fontSize: foundationVars.typography.bodySm.fontSize,
      fontWeight: foundationVars.fontWeight.semibold,
      lineHeight: foundationVars.typography.bodySm.lineHeight,
      textAlign: 'center'
    }
  }
})
