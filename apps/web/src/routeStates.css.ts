import { keyframes, style } from '@vanilla-extract/css'
import { foundationVars } from './css/foundations.css.ts'
import { app } from './css/layers.css.ts'

const loadingSpin = keyframes({
  to: {
    transform: 'rotate(360deg)'
  }
})

export const loadingOverlay = style({
  '@layer': {
    [app]: {
      position: 'fixed',
      inset: 0,
      zIndex: 900,
      display: 'grid',
      placeItems: 'center',
      padding: foundationVars.space[4],
      backgroundColor: 'rgba(7, 16, 20, 0.22)',
      pointerEvents: 'none'
    }
  }
})

export const loadingPanel = style({
  '@layer': {
    [app]: {
      display: 'grid',
      justifyItems: 'center',
      gap: foundationVars.space[3],
      width: 'min(20rem, 100%)',
      padding: `${foundationVars.space[6]} ${foundationVars.space[5]}`,
      border: `1px solid ${foundationVars.color.border.subtle}`,
      borderRadius: foundationVars.radius.xl,
      backgroundColor: foundationVars.color.surface.panel,
      boxShadow: foundationVars.shadow.card
    }
  }
})

export const loadingSpinner = style({
  '@layer': {
    [app]: {
      width: '3rem',
      height: '3rem',
      border: `3px solid ${foundationVars.color.border.subtle}`,
      borderTopColor: foundationVars.color.accent.solid,
      borderRadius: foundationVars.radius.pill,
      animation: `${loadingSpin} 800ms linear infinite`
    }
  }
})

export const loadingCopy = style({
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
