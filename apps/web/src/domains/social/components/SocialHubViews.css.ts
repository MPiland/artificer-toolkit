import { style } from '@vanilla-extract/css'
import { foundationVars, media } from '#app/css/foundations.css'
import { app } from '#app/css/layers.css'

export const rows = style({
  '@layer': { [app]: { display: 'grid', gap: foundationVars.space[3] } }
})

export const row = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gridTemplateColumns: 'minmax(0, 1fr) auto',
      gap: foundationVars.space[4],
      padding: foundationVars.space[5],
      border: `1px solid ${foundationVars.color.border.subtle}`,
      borderRadius: foundationVars.radius.lg,
      background: foundationVars.color.surface.panel,
      selectors: {
        '&[data-highlighted]': {
          borderColor: foundationVars.color.accent.border,
          boxShadow: foundationVars.shadow.focus
        },
        '&[data-highlighted]:focus': {
          outline: 'none'
        }
      },
      '@media': { [media.mobile]: { gridTemplateColumns: '1fr', padding: foundationVars.space[4] } }
    }
  }
})

export const rowBody = style({
  '@layer': {
    [app]: {
      display: 'grid',
      alignContent: 'start',
      gap: foundationVars.space[2],
      minInlineSize: 0
    }
  }
})

export const rowActions = style({
  '@layer': {
    [app]: {
      display: 'flex',
      alignItems: 'flex-start',
      flexWrap: 'wrap',
      justifyContent: 'flex-end',
      gap: foundationVars.space[2],
      '@media': { [media.mobile]: { justifyContent: 'flex-start' } }
    }
  }
})

export const metadata = style({
  '@layer': { [app]: { display: 'flex', flexWrap: 'wrap', gap: foundationVars.space[2] } }
})

export const panel = style({
  '@layer': {
    [app]: {
      display: 'grid',
      alignContent: 'start',
      gap: foundationVars.space[4],
      padding: foundationVars.space[5],
      border: `1px solid ${foundationVars.color.border.subtle}`,
      borderRadius: foundationVars.radius.lg,
      background: foundationVars.color.surface.panel,
      '@media': { [media.mobile]: { padding: foundationVars.space[4] } }
    }
  }
})

export const prose = style({
  '@layer': {
    [app]: {
      whiteSpace: 'pre-wrap',
      overflowWrap: 'anywhere',
      color: foundationVars.color.text.secondary
    }
  }
})

export const empty = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: foundationVars.space[2],
      paddingBlock: foundationVars.space[6],
      color: foundationVars.color.text.secondary,
      textAlign: 'center'
    }
  }
})

export const clickableTitle = style({
  color: foundationVars.color.text.primary,
  textDecoration: 'none',
  ':hover': { color: foundationVars.color.text.accent },
  ':focus-visible': { outline: 0, boxShadow: foundationVars.shadow.focus }
})
