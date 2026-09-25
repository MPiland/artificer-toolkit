import { globalStyle, style } from '@vanilla-extract/css'
import { foundationVars } from '#css/foundations.css'
import { app } from '#css/layers.css'

export const diceCanvas = style({
  '@layer': {
    [app]: {
      inset: 0,
      overflow: 'hidden',
      pointerEvents: 'none',
      position: 'absolute',
      zIndex: 20
    }
  }
})

globalStyle(`${diceCanvas} canvas`, {
  pointerEvents: 'none'
})

export const staticDiceOverlay = style({
  '@layer': {
    [app]: {
      alignItems: 'center',
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
      inset: 0,
      justifyContent: 'center',
      padding: '24px',
      pointerEvents: 'none',
      position: 'absolute',
      zIndex: 20
    }
  }
})

export const staticDiceList = style({
  '@layer': {
    [app]: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: '8px',
      justifyContent: 'center',
      maxWidth: 'min(720px, 90%)'
    }
  }
})

export const staticDie = style({
  '@layer': {
    [app]: {
      alignItems: 'center',
      background: foundationVars.color.surface.raised,
      border: `2px solid ${foundationVars.color.border.strong}`,
      borderRadius: foundationVars.radius.md,
      boxShadow: foundationVars.shadow.card,
      color: foundationVars.color.text.primary,
      display: 'grid',
      height: '58px',
      justifyItems: 'center',
      opacity: 0.46,
      padding: '5px',
      width: '58px',
      selectors: {
        '&[data-kept="true"]': {
          borderColor: foundationVars.color.accent.solid,
          opacity: 1
        }
      }
    }
  }
})

globalStyle(`${staticDie} small`, {
  color: foundationVars.color.text.muted,
  fontSize: '0.62rem',
  lineHeight: 1
})

globalStyle(`${staticDie} strong`, {
  fontSize: '1.35rem',
  lineHeight: 1
})

export const staticRollSummary = style({
  '@layer': {
    [app]: {
      background: foundationVars.color.surface.raised,
      border: `1px solid ${foundationVars.color.border.subtle}`,
      borderRadius: foundationVars.radius.pill,
      boxShadow: foundationVars.shadow.card,
      display: 'flex',
      flexWrap: 'wrap',
      gap: '4px 10px',
      justifyContent: 'center',
      maxWidth: 'min(680px, 92%)',
      padding: '8px 14px',
      textAlign: 'center'
    }
  }
})

globalStyle(`${staticRollSummary} span`, {
  color: foundationVars.color.text.secondary,
  fontSize: '0.76rem'
})
