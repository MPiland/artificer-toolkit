import { globalStyle, style } from '@vanilla-extract/css'
import { foundationVars } from '#css/foundations.css'
import { app } from '#css/layers.css'

export const reviewReadinessHeader = style({
  '@layer': {
    [app]: {
      alignItems: 'start',
      display: 'flex',
      gap: '16px',
      justifyContent: 'space-between'
    }
  }
})

export const reviewReadinessTitle = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.primary,
      fontSize: '1.25rem',
      fontWeight: 750,
      margin: '0 0 4px'
    }
  }
})

export const reviewSummary = style({
  '@layer': {
    [app]: {
      background: foundationVars.color.surface.subtle,
      border: `1px solid ${foundationVars.color.border.subtle}`,
      borderRadius: foundationVars.radius.lg,
      display: 'grid',
      gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
      margin: 0,
      '@media': {
        '(max-width: 900px)': {
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))'
        },
        '(max-width: 520px)': {
          gridTemplateColumns: '1fr'
        }
      }
    }
  }
})

export const reviewFact = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: '4px',
      padding: '14px 16px'
    }
  }
})

export const reviewBlockers = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: '10px'
    }
  }
})

export const reviewBlockerGroup = style({
  '@layer': {
    [app]: {
      border: `1px solid ${foundationVars.color.border.subtle}`,
      borderRadius: foundationVars.radius.lg,
      padding: '12px 14px'
    }
  }
})

export const reviewBlockerHeader = style({
  '@layer': {
    [app]: {
      alignItems: 'center',
      display: 'flex',
      gap: '12px',
      justifyContent: 'space-between'
    }
  }
})

export const reviewMessageList = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: '6px',
      margin: '8px 0 0',
      paddingLeft: '20px'
    }
  }
})

export const reviewMessageBlocking = style({
  '@layer': { [app]: { color: foundationVars.color.status.danger } }
})

export const reviewMessageWarning = style({
  '@layer': { [app]: { color: foundationVars.color.status.warning } }
})

globalStyle(`${reviewFact} dt`, {
  color: foundationVars.color.text.secondary,
  fontSize: '0.75rem',
  fontWeight: foundationVars.fontWeight.semibold
})

globalStyle(`${reviewFact} dd`, {
  color: foundationVars.color.text.primary,
  margin: 0
})
