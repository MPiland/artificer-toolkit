import { style } from '@vanilla-extract/css'
import { foundationVars, media } from '#app/css/foundations.css'
import { app } from '#app/css/layers.css'

const portrait = 'screen and (max-width: 64rem) and (orientation: portrait)'

export const page = style({
  '@layer': {
    [app]: {
      boxSizing: 'border-box',
      display: 'grid',
      alignContent: 'start',
      gap: foundationVars.space[5],
      inlineSize: '100%',
      maxInlineSize: '76rem',
      marginInline: 'auto'
    }
  }
})

export const header = style({
  '@layer': {
    [app]: {
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: foundationVars.space[4],
      '@media': { [media.mobile]: { flexDirection: 'column' } }
    }
  }
})

export const headerCopy = style({
  '@layer': { [app]: { display: 'grid', gap: foundationVars.space[1], maxInlineSize: '68ch' } }
})

export const detailGrid = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gridTemplateColumns: 'minmax(0, 1.65fr) minmax(16rem, 0.75fr)',
      alignItems: 'start',
      gap: foundationVars.space[4],
      '@media': { [portrait]: { gridTemplateColumns: '1fr' } }
    }
  }
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

export const metadata = style({
  '@layer': { [app]: { display: 'flex', flexWrap: 'wrap', gap: foundationVars.space[2] } }
})
