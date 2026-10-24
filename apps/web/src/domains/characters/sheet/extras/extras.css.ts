import { style } from '@vanilla-extract/css'
import { foundationVars } from '#css/foundations.css'
import { app } from '#css/layers.css'

export const extrasList = style({
  '@layer': { [app]: { display: 'grid', gap: '14px' } }
})

export const extraGroup = style({
  '@layer': { [app]: { display: 'grid', minWidth: 0 } }
})

export const extraGroupTitle = style({
  '@layer': {
    [app]: {
      borderBottom: `1px solid ${foundationVars.color.border.subtle}`,
      color: foundationVars.color.text.accent,
      fontSize: '0.74rem',
      letterSpacing: '0.03em',
      margin: 0,
      padding: '3px 8px 6px',
      textTransform: 'uppercase'
    }
  }
})

export const extraGroupRows = style({
  '@layer': { [app]: { display: 'grid', minWidth: 0 } }
})

export const extraDataRow = style({
  '@layer': {
    [app]: {
      appearance: 'none',
      background: 'transparent',
      border: 0,
      borderBottom: `1px solid ${foundationVars.color.border.subtle}`,
      borderRadius: 0,
      color: foundationVars.color.text.primary,
      cursor: 'pointer',
      display: 'grid',
      font: 'inherit',
      gap: '6px',
      minHeight: '52px',
      minWidth: 0,
      padding: '8px',
      textAlign: 'left',
      width: '100%',
      ':disabled': { cursor: 'default', opacity: 0.7 },
      ':focus-visible': { boxShadow: foundationVars.shadow.focus, outline: 'none' },
      '@media': {
        '(max-width: 760px)': {
          minHeight: '44px',
          padding: '7px 6px'
        }
      },
      selectors: {
        '&:hover:not(:disabled)': { background: foundationVars.color.surface.subtle },
        '&:last-child': { borderBottom: 0 }
      }
    }
  }
})

export const extraIdentity = style({
  '@layer': { [app]: { display: 'grid', gap: '2px', minWidth: 0, overflowWrap: 'anywhere' } }
})

export const extraStatBlock = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: '8px',
      gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
      minWidth: 0,
      '@media': {
        '(max-width: 760px)': {
          gap: '6px',
          gridTemplateColumns: 'repeat(auto-fit, minmax(52px, 1fr))'
        }
      }
    }
  }
})

export const extraMetric = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: '1px',
      minWidth: 0,
      overflowWrap: 'anywhere',
      '@media': { '(max-width: 760px)': { paddingTop: '1px' } }
    }
  }
})

export const extraMetricMobileHidden = style([
  extraMetric,
  {
    '@layer': {
      [app]: {
        '@media': {
          '(max-width: 760px)': {
            display: 'none'
          }
        }
      }
    }
  }
])

export const extraMetricLabel = style({
  '@layer': { [app]: { color: foundationVars.color.text.secondary, fontSize: '0.68rem' } }
})

export const extraDrawerBody = style({
  '@layer': { [app]: { display: 'grid', gap: '16px', paddingBottom: '16px' } }
})

export const extraDrawerActions = style({
  '@layer': { [app]: { display: 'flex', gap: '8px', justifyContent: 'flex-end' } }
})

export const summonRow = style({
  '@layer': {
    [app]: {
      alignItems: 'end',
      borderBottom: `1px solid ${foundationVars.color.border.subtle}`,
      display: 'grid',
      gap: '6px',
      minWidth: 0,
      padding: '8px',
      '@media': { '(max-width: 760px)': { padding: '7px 6px' } },
      selectors: { '&:last-child': { borderBottom: 0 } }
    }
  }
})
